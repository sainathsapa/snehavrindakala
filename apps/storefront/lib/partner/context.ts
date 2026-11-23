/**
 * Server-side partner identity resolution. This is the ONLY trusted source of
 * tenant context. It re-reads membership + partner status from the database on
 * every call, so suspension, role changes and session revocation take effect
 * immediately even though the cookie itself is signed.
 */

import { cookies } from "next/headers";
import {
  PARTNER_SESSION_COOKIE,
  verifyPartnerToken,
} from "./session";
import { findMembershipById, findPartnerById, type QueryExecutor } from "./repository";
import { partnerHasPermission, type PartnerPermission } from "./rbac";
import { partnerRoleOrNull, type PartnerContext } from "./types";

export async function resolvePartnerContext(
  token: string | undefined | null,
  executor?: QueryExecutor
): Promise<PartnerContext | null> {
  const payload = verifyPartnerToken(token ?? "");
  if (!payload) return null;

  // Namespace-aware canonicalisation: both the signed claim and the DB row are
  // mapped through the partner-only role guard. A platform role, a legacy
  // ambiguous value that cannot be mapped, or any unknown value fails closed
  // (null) here — before it can reach a permission check.
  const claimedRole = partnerRoleOrNull(payload.role);
  if (!claimedRole) return null;

  const membership = await findMembershipById(payload.mid, executor);
  if (!membership || membership.status !== "active") return null;
  const actualRole = partnerRoleOrNull(membership.role);
  if (!actualRole) return null;
  if (membership.partner_id !== payload.pid) return null;
  if (membership.token_version !== payload.ver) return null;
  if (actualRole !== claimedRole) return null;

  const partner = await findPartnerById(payload.pid, executor);
  if (!partner || partner.account_status !== "active") return null;

  return {
    partnerId: payload.pid,
    membershipId: payload.mid,
    email: payload.email,
    role: actualRole,
    tokenVersion: payload.ver,
    displayName: partner.display_name,
  };
}

/** Next.js wrapper: reads the signed cookie and resolves the context. */
export async function requirePartnerContext(): Promise<PartnerContext | null> {
  const cookieStore = await cookies();
  return resolvePartnerContext(cookieStore.get(PARTNER_SESSION_COOKIE)?.value);
}

/** Permission gate for partner API routes / server actions. */
export async function requirePartnerPermission(
  permission: PartnerPermission
): Promise<PartnerContext | null> {
  const ctx = await requirePartnerContext();
  if (!ctx || !partnerHasPermission(ctx.role, permission)) return null;
  return ctx;
}
