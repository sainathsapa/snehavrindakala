/**
 * Partner business-data export and erasure *request* (partner portal only).
 *
 * `exportPartnerData` returns ONLY the authenticated partner's own business
 * data: its profile, its members (never their password hashes), its products
 * and its earnings ledger. Every read goes through the tenant-scoped repository
 * helpers, so the `partner_id` predicate is always injected from the trusted
 * server-side `PartnerContext` — a caller cannot supply a tenant id, and
 * customer PII / fulfilment records / other partners' rows are never read.
 *
 * `buildErasureRequest` records an explicit, append-only request for a platform
 * administrator to action. It NEVER deletes anything: partner accounts cannot
 * self-delete business or financial records (orders, earnings, statutory records
 * must be retained). Erasure here is a request, not an automatic operation.
 */

import { randomUUID } from "node:crypto";
import { query as defaultQuery } from "@/lib/db";
import { recordPartnerAudit } from "@/lib/partner-audit/audit";
import {
  getPartnerEarnings,
  getPartnerProfile,
  listPartnerMembers,
  listPartnerProducts,
  type QueryExecutor,
} from "@/lib/partner/repository";
import type { PartnerContext } from "@/lib/partner/types";

export interface PartnerDataExport {
  exported_at: string;
  partner_id: string;
  profile: Record<string, unknown> | null;
  members: Record<string, unknown>[];
  products: Record<string, unknown>[];
  earnings: Record<string, unknown>[];
  note: string;
}

/** Member fields safe to export. password_hash / token_version are never included. */
const EXPORT_MEMBER_KEYS = [
  "id",
  "email",
  "full_name",
  "role",
  "status",
  "last_login_at",
  "created_at",
] as const;

function projectMembers(rows: any[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const key of EXPORT_MEMBER_KEYS) {
      if (row && key in row) out[key] = row[key];
    }
    return out;
  });
}

/**
 * Collect this partner's own business data. No customer PII and no other
 * partner's data is ever included: the repository helpers are all tenant-scoped
 * and their column lists exclude password hashes and customer fields.
 */
export async function exportPartnerData(
  ctx: PartnerContext,
  ex?: QueryExecutor
): Promise<PartnerDataExport> {
  if (!ctx?.partnerId) throw new Error("Partner context required");
  const executor = ex ?? defaultQuery;

  const [profileRows, members, products, earnings] = await Promise.all([
    getPartnerProfile(ctx, executor),
    listPartnerMembers(ctx, executor),
    listPartnerProducts(ctx, executor),
    getPartnerEarnings(ctx, executor),
  ]);

  return {
    exported_at: new Date().toISOString(),
    partner_id: ctx.partnerId,
    profile: profileRows[0] ?? null,
    // Explicit allow-list: even if a driver returned extra columns, credential
    // fields such as password_hash could never reach the exported payload.
    members: projectMembers(members),
    products,
    earnings,
    note:
      "This export contains only your partner business records (profile, members, " +
      "products and earnings). Customer personal data and other partners' records " +
      "are never included. To ask for erasure, submit a separate request for the " +
      "studio owner to review.",
  };
}

export interface PartnerErasureRequest {
  request_id: string;
  partner_id: string;
  status: "pending";
  reason: string | null;
  requested_at: string;
  message: string;
}

/**
 * Record a partner's erasure request for admin action. This is an append-only
 * audit row, not a deletion: business and financial records are retained, and
 * only a platform administrator may decide what (if anything) to erase.
 */
export async function buildErasureRequest(
  ctx: PartnerContext,
  reason: unknown,
  ex?: QueryExecutor
): Promise<PartnerErasureRequest> {
  if (!ctx?.partnerId) throw new Error("Partner context required");

  const requestId = `erase_${randomUUID().slice(0, 8)}`;
  const cleanReason =
    typeof reason === "string" && reason.trim() ? reason.trim().slice(0, 1000) : null;
  const requestedAt = new Date().toISOString();
  const message =
    "Your erasure request has been recorded for the studio owner to review. " +
    "No data has been deleted: business, membership and financial records must be " +
    "retained and cannot be erased by a partner account.";

  await recordPartnerAudit(
    {
      partnerId: ctx.partnerId,
      actorEmail: ctx.email,
      actorRole: ctx.role,
      action: "ERASURE_REQUESTED",
      entityType: "data_erasure_request",
      entityId: requestId,
      metadata: {
        request_id: requestId,
        status: "pending",
        reason: cleanReason,
        requested_at: requestedAt,
        note: "Erasure is a request for admin action only; no records were deleted.",
      },
    },
    ex ?? defaultQuery
  );

  return {
    request_id: requestId,
    partner_id: ctx.partnerId,
    status: "pending",
    reason: cleanReason,
    requested_at: requestedAt,
    message,
  };
}
