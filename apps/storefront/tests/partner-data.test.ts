/**
 * Partner business-data export + erasure request.
 *
 * Real library logic runs against an in-memory fake DB shared by two tenants.
 * The fake executor refuses any SELECT without a tenant predicate and filters
 * every row by the bound tenant parameter, so a test passes only if the
 * production code genuinely scopes every read through tenantQuery.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildErasureRequest,
  exportPartnerData,
} from "@/lib/partner-portal/data";
import type { QueryExecutor } from "@/lib/partner/repository";
import type { PartnerContext } from "@/lib/partner/types";

const root = join(__dirname, "..");
const routeSource = readFileSync(
  join(root, "app/api/partner/data/route.ts"),
  "utf8"
);

const CUSTOMER_EMAIL = "buyer@shopper.example";
const CUSTOMER_ADDRESS = "123 Secret Street";
const HASH_A = "scrypt$SECRETHASHA";
const HASH_B = "scrypt$SECRETHASHB";

const ctx: PartnerContext = {
  partnerId: "partner-A",
  membershipId: "member-A",
  email: "owner@partner-A.test",
  role: "owner",
  tokenVersion: 1,
};

interface QueryCall {
  sql: string;
  params: any[];
}

function seed() {
  return {
    partner: [
      {
        id: "partner-A",
        legal_name: "A Crafts LLP",
        display_name: "Partner A",
        contact_email: "owner@partner-A.test",
      },
      {
        id: "partner-B",
        legal_name: "B Crafts LLP",
        display_name: "Partner B",
        contact_email: "owner@partner-B.test",
      },
    ],
    partner_membership: [
      {
        id: "member-A",
        partner_id: "partner-A",
        email: "owner@partner-A.test",
        full_name: "Owner A",
        role: "owner",
        status: "active",
        password_hash: HASH_A,
        token_version: 1,
        last_login_at: null,
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "member-B",
        partner_id: "partner-B",
        email: "owner@partner-B.test",
        full_name: "Owner B",
        role: "owner",
        status: "active",
        password_hash: HASH_B,
        token_version: 1,
        last_login_at: null,
        created_at: "2026-01-01T00:00:00Z",
      },
    ],
    partner_product: [
      { id: "prod-A", partner_id: "partner-A", product_id: "medusa-A", submission_status: "approved" },
      { id: "prod-B", partner_id: "partner-B", product_id: "medusa-B", submission_status: "draft" },
    ],
    partner_earnings_ledger: [
      { id: "earn-A", partner_id: "partner-A", order_id: "order-A", payable_amount: "900.00" },
      { id: "earn-B", partner_id: "partner-B", order_id: "order-B", payable_amount: "100.00" },
    ],
    // Never read by the export: it carries customer PII.
    fulfilment_group: [
      {
        id: "fg-A",
        partner_id: "partner-A",
        customer_order_id: "order-A",
        customer_email: CUSTOMER_EMAIL,
        customer_address: CUSTOMER_ADDRESS,
      },
    ],
    audit: [] as any[],
  };
}

type State = ReturnType<typeof seed>;

const clone = (row: any) => JSON.parse(JSON.stringify(row));

function fakeDb(state: State) {
  const calls: QueryCall[] = [];
  const executor: QueryExecutor = async (sql: string, params: any[] = []) => {
    const flat = sql.replace(/\s+/g, " ").trim();
    calls.push({ sql: flat, params });
    // tenantQuery always appends ctx.partnerId as the last bound parameter.
    const tenant = params[params.length - 1];

    if (/^SELECT/i.test(flat)) {
      if (!/partner_id = \$\d+|WHERE id = \$\d+/.test(flat)) {
        throw new Error("Unscoped SELECT rejected by fake DB");
      }
      if (!tenant) throw new Error("SELECT without a tenant parameter");
      if (flat.includes("FROM partner_membership")) {
        return state.partner_membership.filter((r) => r.partner_id === tenant).map(clone);
      }
      if (flat.includes("FROM partner_product")) {
        return state.partner_product.filter((r) => r.partner_id === tenant).map(clone);
      }
      if (flat.includes("FROM partner_earnings_ledger")) {
        return state.partner_earnings_ledger.filter((r) => r.partner_id === tenant).map(clone);
      }
      if (flat.includes("FROM partner ")) {
        return state.partner.filter((r) => r.id === tenant).map(clone);
      }
      throw new Error("Unexpected SELECT: " + flat);
    }

    if (/^INSERT INTO partner_audit_log/i.test(flat)) {
      const [partnerId, actorEmail, actorRole, action, entityType, entityId, metadata] = params;
      state.audit.push({
        partner_id: partnerId,
        actor_email: actorEmail,
        actor_role: actorRole,
        action,
        entity_type: entityType,
        entity_id: entityId,
        metadata: JSON.parse(metadata),
      });
      return [];
    }

    throw new Error("Unexpected / destructive SQL: " + flat);
  };
  return { executor, calls };
}

describe("exportPartnerData — tenant scope", () => {
  it("scopes every read to ctx.partnerId through tenantQuery", async () => {
    const state = seed();
    const { executor, calls } = fakeDb(state);
    await exportPartnerData(ctx, executor);

    // profile + members + products + earnings, no more.
    expect(calls).toHaveLength(4);
    for (const call of calls) {
      expect(call.sql).toMatch(/partner_id = \$\d+|WHERE id = \$\d+/);
      expect(call.params[call.params.length - 1]).toBe("partner-A");
    }
  });

  it("exports only this partner's profile, members, products and earnings", async () => {
    const state = seed();
    const { executor } = fakeDb(state);
    const data = await exportPartnerData(ctx, executor);

    expect(data.partner_id).toBe("partner-A");
    expect(data.profile?.display_name).toBe("Partner A");
    expect(data.members.map((m: any) => m.id)).toEqual(["member-A"]);
    expect(data.products.map((p: any) => p.id)).toEqual(["prod-A"]);
    expect(data.earnings.map((e: any) => e.id)).toEqual(["earn-A"]);

    const json = JSON.stringify(data);
    expect(json).not.toContain("partner-B");
    expect(json).not.toContain("owner@partner-B.test");
    expect(json).not.toContain("medusa-B");
    expect(json).not.toContain("earn-B");
  });

  it("contains no password hashes and no customer PII", async () => {
    const state = seed();
    const { executor, calls } = fakeDb(state);
    const data = await exportPartnerData(ctx, executor);
    const json = JSON.stringify(data);

    expect(json).not.toContain("password_hash");
    expect(json).not.toContain(HASH_A);
    expect(json).not.toContain(HASH_B);
    expect(json).not.toContain(CUSTOMER_EMAIL);
    expect(json).not.toContain(CUSTOMER_ADDRESS);
    expect(Object.keys(data.members[0]!)).not.toContain("password_hash");
    expect(Object.keys(data.members[0]!)).not.toContain("token_version");

    // No customer / fulfilment table is ever queried by the export.
    expect(
      calls.every((c) => !/fulfilment_group|customer_order_id|support_tickets|newsletter/i.test(c.sql))
    ).toBe(true);
  });

  it("fails closed if the context is missing (no query executed)", async () => {
    const { executor, calls } = fakeDb(seed());
    await expect(exportPartnerData(null as any, executor)).rejects.toThrow(
      /Partner context required/
    );
    expect(calls).toHaveLength(0);
  });
});

describe("buildErasureRequest — recorded, not executed", () => {
  it("records a pending admin-action request, deleting nothing", async () => {
    const state = seed();
    const { executor, calls } = fakeDb(state);
    const result = await buildErasureRequest(ctx, "Closing the business", executor);

    expect(result.status).toBe("pending");
    expect(result.partner_id).toBe("partner-A");
    expect(result.request_id).toMatch(/^erase_/);
    expect(result.reason).toBe("Closing the business");

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.sql).toContain("INSERT INTO partner_audit_log");
    expect(call.params[0]).toBe("partner-A"); // tenant from server context
    expect(call.params[3]).toBe("ERASURE_REQUESTED");
    expect(call.params[4]).toBe("data_erasure_request");
    expect(call.params[5]).toBe(result.request_id);
    const metadata = JSON.parse(call.params[6]);
    expect(metadata.status).toBe("pending");
    expect(metadata.reason).toBe("Closing the business");
    expect(metadata.note).toMatch(/no records were deleted/i);

    // No destructive statement, and every business table is intact.
    expect(calls.some((c) => /\bDELETE\b|\bTRUNCATE\b|\bDROP\b|\bUPDATE\b/i.test(c.sql))).toBe(
      false
    );
    expect(state.partner).toHaveLength(2);
    expect(state.partner_membership).toHaveLength(2);
    expect(state.partner_product).toHaveLength(2);
    expect(state.partner_earnings_ledger).toHaveLength(2);
    expect(state.audit).toHaveLength(1);
  });

  it("cannot be pointed at another tenant through the reason text", async () => {
    const state = seed();
    const { executor } = fakeDb(state);
    await buildErasureRequest(ctx, "partner-B", executor);
    expect(state.audit[0]!.partner_id).toBe("partner-A");
  });

  it("truncates an overlong reason and tolerates a missing one", async () => {
    const state = seed();
    const { executor } = fakeDb(state);
    const long = await buildErasureRequest(ctx, "x".repeat(2000), executor);
    expect(long.reason).toHaveLength(1000);
    const none = await buildErasureRequest(ctx, undefined, executor);
    expect(none.reason).toBeNull();
  });

  it("fails closed if the context is missing (no request recorded)", async () => {
    const state = seed();
    const { executor, calls } = fakeDb(state);
    await expect(buildErasureRequest(null as any, "x", executor)).rejects.toThrow(
      /Partner context required/
    );
    expect(calls).toHaveLength(0);
    expect(state.audit).toHaveLength(0);
  });
});

describe("/api/partner/data route contract", () => {
  it("gates GET on profile:read and POST on profile:write", () => {
    expect(routeSource).toMatch(/export async function GET\(/);
    expect(routeSource).toMatch(/export async function POST\(/);
    expect(routeSource).toMatch(/requirePartnerPermission\("profile:read"\)/);
    expect(routeSource).toMatch(/requirePartnerPermission\("profile:write"\)/);
    expect(routeSource).toMatch(/status: 401/);
  });

  it("exports own data and records a pending erasure request without deleting", () => {
    expect(routeSource).toMatch(/exportPartnerData\(ctx\)/);
    expect(routeSource).toMatch(/buildErasureRequest\(ctx, reason\)/);
    expect(routeSource).toMatch(/hasTenantIdField\(body\)/);
    expect(routeSource).toMatch(/status: 202/);
    expect(routeSource).not.toMatch(/DELETE FROM|TRUNCATE|DROP TABLE/i);
  });
});
