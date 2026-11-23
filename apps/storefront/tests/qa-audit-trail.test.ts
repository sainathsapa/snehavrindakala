import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A108 (QA) — FINAL GO audit-trail verification.
 *
 * Two halves:
 *  1. STATIC: read the privileged routes / mutation libraries from disk and
 *     assert they actually call an audit writer before returning success. A
 *     privileged operation that is merely permission-gated but never recorded
 *     is invisible to an incident review, so the presence of the write is the
 *     business outcome under test here.
 *  2. PURE: `auditPayload` must never persist secrets or customer PII. This is
 *     the last line of defence for the partner audit log: even if a caller
 *     hands it a raw entity, nothing sensitive reaches the JSONB column.
 *
 * No database, network, cookies or clock are touched.
 */

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

// ---------------------------------------------------------------------------
// Static wiring: every in-scope privileged operation must write an audit row.
// ---------------------------------------------------------------------------

const AUDIT_WRITERS =
  /recordAdminAction|recordPartnerAudit|auditFinanceAction|writeAudit|INSERT INTO audit_log|INSERT INTO partner_audit_log/;

describe("audit writers exist and target the durable tables", () => {
  it("recordAdminAction inserts into the admin audit_log table", () => {
    const src = read("lib/audit.ts");
    expect(src).toMatch(/export async function recordAdminAction/);
    expect(src).toMatch(/INSERT INTO audit_log/);
  });

  it("recordPartnerAudit inserts into the append-only partner_audit_log table", () => {
    const src = read("lib/partner-audit/audit.ts");
    expect(src).toMatch(/export async function recordPartnerAudit/);
    expect(src).toMatch(/INSERT INTO partner_audit_log/);
  });

  it("auditFinanceAction inserts into partner_audit_log for finance actions", () => {
    const src = read("lib/finance/commission-policy.ts");
    expect(src).toMatch(/export async function auditFinanceAction/);
    expect(src).toMatch(/INSERT INTO partner_audit_log/);
  });
});

describe("refund decisions are audited", () => {
  const decisionRoute = "app/api/admin/refunds/route.ts";
  const executeRoute = "app/api/admin/refunds/execute/route.ts";

  it("approve/reject endpoint records an admin action for the decision", () => {
    const src = read(decisionRoute);
    expect(src, decisionRoute).toMatch(/requirePermission\(["']refunds:approve["']\)/);
    expect(src, decisionRoute).toMatch(/recordAdminAction\s*\(/);
    expect(src, decisionRoute).toMatch(/refund\.approve/);
    expect(src, decisionRoute).toMatch(/refund\.reject/);
    expect(src, decisionRoute).toMatch(/entityType:\s*["']order_refund["']/);
  });

  it("release/execute endpoint records an admin action after moving money", () => {
    const src = read(executeRoute);
    expect(src, executeRoute).toMatch(/requirePermission\(["']refunds:approve["']\)/);
    expect(src, executeRoute).toMatch(/recordAdminAction\s*\(/);
    expect(src, executeRoute).toMatch(/["']refund\.execute["']/);
    expect(src, executeRoute).toMatch(/entityType:\s*["']refund_execution["']/);
  });
});

describe("admin user management is audited", () => {
  const route = "app/api/admin/users/route.ts";

  it("create, update and delete each write an admin audit action", () => {
    const src = read(route);
    expect(src, route).toMatch(/requirePermission\(["']users:write["']\)/);
    expect(src, route).toMatch(/requirePermission\(["']users:delete["']\)/);
    const auditCalls = src.match(/recordAdminAction\s*\(/g) ?? [];
    expect(auditCalls.length, `${route} should audit all three mutations`).toBeGreaterThanOrEqual(3);
    for (const action of ["admin_user.create", "admin_user.update", "admin_user.delete"]) {
      expect(src, `${route} must record ${action}`).toContain(action);
    }
    expect(src, route).toMatch(/entityType:\s*["']admin_user["']/);
  });

  it("never puts the password hash into the audit payload", () => {
    const src = read(route);
    expect(src, route).toMatch(/never audit the password hash/);
    // The only newValues on create carries email/role, not the hash.
    expect(src, route).toMatch(/newValues:\s*\{\s*email,\s*role\s*\}/);
  });
});

describe("partner platform mutations write partner_audit_log", () => {
  const platform = "lib/admin-partners/platform.ts";

  it("the platform mutation library has a single append-only audit writer", () => {
    const src = read(platform);
    expect(src, platform).toMatch(/INSERT INTO partner_audit_log/);
    const writes = src.match(/writeAudit\s*\(/g) ?? [];
    // setAccountStatus, setVerification and linkArtist each append one row.
    expect(writes.length, `${platform} must audit every lifecycle mutation`).toBeGreaterThanOrEqual(3);
    for (const action of ["set_account_status", "set_verification", "link_artist"]) {
      expect(src, `${platform} must record ${action}`).toContain(action);
    }
  });

  it("each marketplace-partners privileged route calls the audited platform mutation", () => {
    const cases: Array<[string, string]> = [
      ["app/api/admin/marketplace-partners/[id]/status/route.ts", "setAccountStatus"],
      ["app/api/admin/marketplace-partners/[id]/verify/route.ts", "setVerification"],
      ["app/api/admin/marketplace-partners/[id]/link-artist/route.ts", "linkArtist"],
    ];
    for (const [path, fn] of cases) {
      const src = read(path);
      expect(src, `${path} must call ${fn}`).toMatch(new RegExp(`${fn}\\s*\\(`));
    }
  });

  it("a partner's erasure request is recorded as an auditable row", () => {
    const dataLib = read("lib/partner-portal/data.ts");
    expect(dataLib).toMatch(/recordPartnerAudit\s*\(/);
    expect(dataLib).toMatch(/ERASURE_REQUESTED/);
    const dataRoute = read("app/api/partner/data/route.ts");
    expect(dataRoute).toMatch(/buildErasureRequest/);
  });
});

describe("settlement approvals are audited", () => {
  it("transition endpoint audits every finance transition under settlements:write", () => {
    const route = "app/api/admin/settlements/[id]/route.ts";
    const src = read(route);
    expect(src, route).toMatch(/requirePermission\(["']settlements:write["']\)/);
    expect(src, route).toMatch(/auditFinanceAction\s*\(/);
    for (const action of [
      "settlement.approved",
      "settlement.payment_initiated",
      "settlement.payment_completed",
      "settlement.payment_failed",
    ]) {
      expect(src, `${route} must record ${action}`).toContain(action);
    }
    expect(src, route).toMatch(/entityType:\s*["']settlement_batch["']/);
  });

  it("batch creation is audited too", () => {
    const route = "app/api/admin/settlements/route.ts";
    const src = read(route);
    expect(src, route).toMatch(/auditFinanceAction\s*\(/);
    expect(src, route).toMatch(/["']settlement\.created["']/);
  });
});

describe("order cancellation is audited", () => {
  it("cancel endpoint records order.cancel after restoring stock", () => {
    const route = "app/api/admin/orders/[id]/cancel/route.ts";
    const src = read(route);
    expect(src, route).toMatch(/requirePermission\(["']orders:write["']\)/);
    expect(src, route).toMatch(/recordAdminAction\s*\(/);
    expect(src, route).toMatch(/["']order\.cancel["']/);
    expect(src, route).toMatch(/entityType:\s*["']order["']/);
  });
});

// ---------------------------------------------------------------------------
// Pure: auditPayload redaction (A77). No secrets or customer PII are persisted.
// ---------------------------------------------------------------------------

vi.mock("@/lib/db", () => ({
  query: vi.fn(async () => []),
  queryResult: vi.fn(async () => ({ rows: [] })),
  transaction: vi.fn(),
  getPool: vi.fn(),
}));

import { REDACTED, auditPayload } from "@/lib/partner-audit/audit";
import type { PartnerContext } from "@/lib/partner/types";

const ctx: PartnerContext = {
  partnerId: "partner-QA",
  membershipId: "member-QA",
  email: "owner@partner-qa.test",
  role: "owner",
  tokenVersion: 1,
};

function entityOf(payload: Record<string, unknown>): Record<string, any> {
  return payload.entity as Record<string, any>;
}

describe("auditPayload — secrets are redacted at any depth", () => {
  it("redacts every known sensitive key, including normalised and spaced names", () => {
    const payload = auditPayload("TEST", ctx, {
      password: "pw-value",
      passwd: "pw2",
      pwd: "pw3",
      apiKey: "api-key-value",
      "API KEY": "api-key-value-2",
      secret: "secret-value",
      authorization: "Bearer abc.def.ghi",
      "auth header": "Bearer jkl",
      cookie: "session=xyz",
      session_id: "s-123",
      private_key: "-----BEGIN-----",
      cvv: "123",
      cvc: "456",
      ssn: "111-22-3333",
      aadhaar: "123456789012",
      iban: "GB82WEST12345698765432",
      routing_number: "021000021",
      bank_account: "000123456789",
      credentials: { anything: "hidden" },
      safeField: "keep-me",
    });
    const entity = entityOf(payload);
    for (const key of [
      "password",
      "passwd",
      "pwd",
      "apiKey",
      "API KEY",
      "secret",
      "authorization",
      "auth header",
      "cookie",
      "session_id",
      "private_key",
      "cvv",
      "cvc",
      "ssn",
      "aadhaar",
      "iban",
      "routing_number",
      "bank_account",
      "credentials",
    ]) {
      expect(entity[key], `${key} must be redacted`).toBe(REDACTED);
    }
    expect(entity.safeField).toBe("keep-me");
    const serialised = JSON.stringify(payload);
    for (const secret of [
      "pw-value",
      "api-key-value",
      "secret-value",
      "abc.def.ghi",
      "-----BEGIN-----",
      "123456789012",
    ]) {
      expect(serialised, `${secret} must never be persisted`).not.toContain(secret);
    }
  });

  it("redacts secret keys nested in objects and inside arrays", () => {
    const payload = auditPayload("TEST", ctx, {
      history: [
        { password_hash: "hash-1", changedBy: "admin-a" },
        { token: "tok-2", note: "role changed" },
      ],
      deep: { level2: { level3: { session_token: "deep-token", ok: 1 } } },
    });
    const entity = entityOf(payload);
    expect(entity.history[0].password_hash).toBe(REDACTED);
    expect(entity.history[0].changedBy).toBe("admin-a");
    expect(entity.history[1].token).toBe(REDACTED);
    expect(entity.history[1].note).toBe("role changed");
    expect(entity.deep.level2.level3.session_token).toBe(REDACTED);
    expect(entity.deep.level2.level3.ok).toBe(1);
    const serialised = JSON.stringify(payload);
    expect(serialised).not.toContain("hash-1");
    expect(serialised).not.toContain("tok-2");
    expect(serialised).not.toContain("deep-token");
  });
});

describe("auditPayload — customer PII is redacted", () => {
  it("redacts email keys and scrubs raw email addresses in innocent strings", () => {
    const payload = auditPayload("ORDER_FULFILLED", ctx, {
      customerEmail: "buyer@shopper.example",
      customer: { email: "other@shopper.example", fullName: "A Customer" },
      note: "Ship to buyer@shopper.example and cc accounts@shopper.example",
    });
    const entity = entityOf(payload);
    expect(entity.customerEmail).toBe(REDACTED);
    expect(entity.customer.email).toBe(REDACTED);
    // Safe identity fields inside the customer object survive.
    expect(entity.customer.fullName).toBe("A Customer");
    const serialised = JSON.stringify(payload);
    expect(serialised).not.toContain("buyer@shopper.example");
    expect(serialised).not.toContain("other@shopper.example");
    expect(serialised).not.toContain("accounts@shopper.example");
    expect(entity.note).toContain(REDACTED);
  });

  it("redacts PAN/card-number keys and scrubs raw 13-19 digit numbers", () => {
    const payload = auditPayload("ORDER_FULFILLED", ctx, {
      orderId: "order-42",
      card: { pan: "4111111111111111", cvv: "999" },
      "card number": "5500005555555559",
      note: "Ref 5500005555555559 and 4111111111111111",
      status: "dispatched",
    });
    const entity = entityOf(payload);
    expect(entity.card.pan).toBe(REDACTED);
    expect(entity.card.cvv).toBe(REDACTED);
    expect(entity["card number"]).toBe(REDACTED);
    const serialised = JSON.stringify(payload);
    expect(serialised).not.toContain("4111111111111111");
    expect(serialised).not.toContain("5500005555555559");
    expect(entity.note).toBe(`Ref ${REDACTED} and ${REDACTED}`);
    expect(entity.orderId).toBe("order-42");
    expect(entity.status).toBe("dispatched");
  });

  it("does not duplicate the actor's email or any email into metadata", () => {
    const payload = auditPayload("PROFILE_UPDATED", ctx, { displayName: "New Name" });
    expect(payload).not.toHaveProperty("actorEmail");
    expect(JSON.stringify(payload)).not.toContain(ctx.email);
    expect(entityOf(payload).displayName).toBe("New Name");
  });
});

describe("auditPayload — pure and bounded", () => {
  it("is deterministic and never mutates the caller's entity", () => {
    const entity = {
      title: "A",
      count: 2,
      active: true,
      nested: { token: "t" },
      items: [1, 2],
    };
    const snapshot = JSON.stringify(entity);
    const first = auditPayload("PRODUCT_SUBMITTED", ctx, entity);
    const second = auditPayload("PRODUCT_SUBMITTED", ctx, entity);
    expect(first).toEqual(second);
    expect(JSON.stringify(entity)).toBe(snapshot);
  });

  it("preserves safe scalars and serialises dates", () => {
    const when = new Date("2026-01-01T00:00:00.000Z");
    const payload = auditPayload("TEST", ctx, {
      when,
      amount: 1234,
      ok: false,
      nothing: null,
    });
    const entity = entityOf(payload);
    expect(entity.when).toBe("2026-01-01T00:00:00.000Z");
    expect(entity.amount).toBe(1234);
    expect(entity.ok).toBe(false);
    expect(entity.nothing).toBeNull();
  });

  it("caps over-deep structures and refuses functions", () => {
    let nested: Record<string, unknown> = { leaf: "bottom" };
    for (let i = 0; i < 12; i += 1) nested = { child: nested };
    const payload = auditPayload("TEST", ctx, {
      deep: nested,
      handler: () => "nope",
    });
    expect(JSON.stringify(payload)).toContain("[TRUNCATED]");
    expect(entityOf(payload).handler).toBe(REDACTED);
    expect(JSON.stringify(payload)).not.toContain("bottom");
  });

  it("carries the canonical action and server-derived identity fields", () => {
    const payload = auditPayload("SETTLEMENT_VIEWED", ctx, { batchId: "b-1" });
    expect(payload).toMatchObject({
      action: "SETTLEMENT_VIEWED",
      partnerId: "partner-QA",
      actorRole: "owner",
    });
    expect(payload).not.toHaveProperty("actorEmail");
  });
});

describe("in-scope privileged mutations all reference an audit writer", () => {
  // Guard against future regressions: these specific files must keep a call to
  // one of the audit writers. (Coverage of the rest of /admin and /partner is
  // reported separately; it is outside this agent's owned assertions.)
  const mustAudit: Array<[string, RegExp]> = [
    ["app/api/admin/refunds/route.ts", AUDIT_WRITERS],
    ["app/api/admin/refunds/execute/route.ts", AUDIT_WRITERS],
    ["app/api/admin/users/route.ts", AUDIT_WRITERS],
    ["app/api/admin/settlements/route.ts", AUDIT_WRITERS],
    ["app/api/admin/settlements/[id]/route.ts", AUDIT_WRITERS],
    ["app/api/admin/orders/[id]/cancel/route.ts", AUDIT_WRITERS],
    ["lib/admin-partners/platform.ts", AUDIT_WRITERS],
    ["lib/partner-portal/data.ts", AUDIT_WRITERS],
  ];

  it.each(mustAudit)("%s writes an audit row", (path, writer) => {
    expect(read(path), `${path} has no audit writer`).toMatch(writer);
  });
});
