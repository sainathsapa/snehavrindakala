/**
 * A108 remediation — audit-write coverage for every in-scope mutation.
 *
 * Static source assertions prove each mutation *calls* an existing audit
 * primitive with the tenant-scoped identity from the verified session (never a
 * client-supplied partner id). A small behavioural half proves the shared
 * helpers redact secrets/PII and fail loudly instead of silently dropping a
 * business-critical audit row. No live DB, network, cookies or clock are used.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

// Controllable fake for the DB boundary used by the audit helper.
const dbState = vi.hoisted(() => ({
  failAudit: false,
  calls: [] as Array<{ sql: string; params: any[] }>,
}));

vi.mock("@/lib/db", () => ({
  query: vi.fn(async () => []),
  queryResult: vi.fn(async (sql: string, params: any[] = []) => {
    dbState.calls.push({ sql, params });
    if (dbState.failAudit) throw new Error("simulated audit DB outage");
    return { rows: [] };
  }),
  transaction: vi.fn(),
  getPool: vi.fn(),
}));

import {
  AUDIT_ACTIONS,
  auditPayload,
  recordMutationAudit,
  redactAuditText,
} from "@/lib/partner-audit/audit";
import type { PartnerContext } from "@/lib/partner/types";

beforeEach(() => {
  dbState.failAudit = false;
  dbState.calls.length = 0;
});

const ctx: PartnerContext = {
  partnerId: "partner-QA",
  membershipId: "member-QA",
  email: "owner@partner-qa.test",
  role: "owner",
  tokenVersion: 1,
};

// ---------------------------------------------------------------------------
// 1. The shared primitive is reused (no second audit system) and fails loudly.
// ---------------------------------------------------------------------------

describe("A108 — one audit system, fail-loud writes", () => {
  const auditSrc = read("lib/partner-audit/audit.ts");

  it("recordMutationAudit delegates to recordPartnerAudit on partner_audit_log", () => {
    expect(auditSrc).toMatch(/export async function recordMutationAudit/);
    expect(auditSrc).toMatch(/recordPartnerAudit\(input, AUDIT_EXECUTOR\)/);
    expect(auditSrc).toMatch(/INSERT INTO partner_audit_log/);
    // The mutation helper never invents its own INSERT statement.
    const body = auditSrc.slice(
      auditSrc.indexOf("export async function recordMutationAudit"),
      auditSrc.indexOf("/** List the authenticated partner")
    );
    expect(body).not.toMatch(/INSERT INTO/);
  });

  it("redactAuditText reuses the single scrubber (no duplicated redaction logic)", () => {
    expect(auditSrc).toMatch(/export function redactAuditText/);
    expect(auditSrc).toMatch(/scrubString\(text\)/);
  });

  it("writes the server-derived actor/partner identity and a redacted payload", async () => {
    await recordMutationAudit({
      partnerId: ctx.partnerId,
      actorEmail: ctx.email,
      actorRole: ctx.role,
      action: "TEST_A108",
      entityType: "partner_membership",
      entityId: "member-QA",
      metadata: auditPayload("TEST_A108", ctx, {
        title: "safe",
        password: "hunter2",
        contact_email: "buyer@shopper.example",
      }),
    });

    expect(dbState.calls).toHaveLength(1);
    const { sql, params } = dbState.calls[0];
    expect(sql).toContain("INSERT INTO partner_audit_log");
    expect(params.slice(0, 6)).toEqual([
      "partner-QA",
      "owner@partner-qa.test",
      "owner",
      "TEST_A108",
      "partner_membership",
      "member-QA",
    ]);
    const metadata = JSON.parse(params[6]);
    expect(metadata.partnerId).toBe("partner-QA");
    expect(metadata.actorRole).toBe("owner");
    expect(metadata.entity.password).toBe("[REDACTED]");
    expect(metadata.entity.contact_email).toBe("[REDACTED]");
    expect(metadata.entity.title).toBe("safe");
    expect(JSON.stringify(params)).not.toContain("hunter2");
    expect(JSON.stringify(params)).not.toContain("buyer@shopper.example");
  });

  it("propagates a clear error when the audit write fails (never silently ignored)", async () => {
    dbState.failAudit = true;
    await expect(
      recordMutationAudit({
        partnerId: ctx.partnerId,
        actorEmail: ctx.email,
        actorRole: ctx.role,
        action: "TEST_A108_FAIL",
        entityType: "partner",
        entityId: ctx.partnerId,
      })
    ).rejects.toThrow(/Audit write failed for action "TEST_A108_FAIL"/);
  });

  it("redactAuditText scrubs emails, PANs and card-like numbers", () => {
    expect(redactAuditText("pay bob@example.com now")).toBe(
      "pay [REDACTED] now"
    );
    expect(redactAuditText("card 4111111111111111 used")).toBe(
      "card [REDACTED] used"
    );
    expect(redactAuditText(null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Partner self-service mutations — tenant identity comes from the session.
// ---------------------------------------------------------------------------

const partnerCases: Array<[string, string, string]> = [
  ["app/api/partner/team/route.ts", "AUDIT_ACTIONS.MEMBER_INVITED", "partner_membership"],
  ["app/api/partner/team/[id]/route.ts", "AUDIT_ACTIONS.MEMBER_ROLE_CHANGED", "partner_membership"],
  ["app/api/partner/products/route.ts", "PRODUCT_CREATED", "partner_product"],
  ["app/api/partner/products/[id]/route.ts", "AUDIT_ACTIONS.PRODUCT_SUBMITTED", "partner_product"],
  ["app/api/partner/orders/[id]/accept/route.ts", "AUDIT_ACTIONS.ORDER_ACCEPTED", "fulfilment_group"],
  ["app/api/partner/orders/[id]/reject/route.ts", "AUDIT_ACTIONS.ORDER_REJECTED", "fulfilment_group"],
  ["app/api/partner/orders/[id]/fulfil/route.ts", "AUDIT_ACTIONS.ORDER_FULFILLED", "fulfilment_group"],
  ["app/api/partner/profile/route.ts", "AUDIT_ACTIONS.PROFILE_UPDATED", "partner"],
];

describe("A108 — partner self-service mutations write an audit row", () => {
  it.each(partnerCases)(
    "%s calls recordMutationAudit with session identity + redaction",
    (path, action, entityType) => {
      const src = read(path);
      expect(src, `${path}: audit call`).toMatch(/recordMutationAudit\s*\(/);
      expect(src, `${path}: redaction builder`).toMatch(/auditPayload\s*\(/);
      expect(src, `${path}: correct action`).toContain(action);
      expect(src, `${path}: correct resource type`).toContain(`entityType: "${entityType}"`);
      // Identity is read from the verified PartnerContext, never the request body.
      expect(src, `${path}: partner id from session`).toMatch(/partnerId:\s*ctx\.partnerId/);
      expect(src, `${path}: actor email from session`).toMatch(/actorEmail:\s*ctx\.email/);
      expect(src, `${path}: actor role from session`).toMatch(/actorRole:\s*ctx\.role/);
      expect(src, `${path}: no client-supplied partner id`).not.toMatch(/partnerId:\s*(body|input|params)/);
      // Mutations never hand a raw request body straight to the audit writer.
      expect(src, `${path}: no raw body audit`).not.toMatch(/recordMutationAudit\(\s*body/);
    }
  );

  it("team member create/update/remove/session-revoke are all covered", () => {
    const create = read("app/api/partner/team/route.ts");
    const member = read("app/api/partner/team/[id]/route.ts");
    for (const action of [
      "AUDIT_ACTIONS.MEMBER_INVITED",
      "AUDIT_ACTIONS.MEMBER_ROLE_CHANGED",
      "AUDIT_ACTIONS.SESSIONS_REVOKED",
      "AUDIT_ACTIONS.MEMBER_SUSPENDED",
    ]) {
      expect(create + member, `missing ${action}`).toContain(action);
    }
    // The one-time invite password is never part of an audit payload.
    expect(create).not.toMatch(/metadata:[\s\S]{0,200}tempPassword/);
  });

  it("product create/update/status-change are all covered", () => {
    const create = read("app/api/partner/products/route.ts");
    const edit = read("app/api/partner/products/[id]/route.ts");
    expect(create).toContain("PRODUCT_CREATED");
    expect(edit).toContain("PRODUCT_UPDATED");
    expect(edit).toContain("AUDIT_ACTIONS.PRODUCT_SUBMITTED");
    // Caller-controlled product prose is not copied into the audit row.
    expect(edit).toContain("changedFields:");
    expect(edit).not.toMatch(/metadata:[\s\S]{0,200}body\.title/);
  });

  it("profile update records changed field names, not PII values", () => {
    const src = read("app/api/partner/profile/route.ts");
    expect(src).toMatch(/changedFields:\s*Object\.keys\(/);
    expect(src).not.toMatch(/metadata:[\s\S]{0,200}(contact_email|contact_phone)/);
  });

  it("order reject does not persist the free-text reason", () => {
    const src = read("app/api/partner/orders/[id]/reject/route.ts");
    expect(src).toContain("reasonProvided: true");
    expect(src).not.toMatch(/metadata:[\s\S]{0,200}reason:\s*reason/);
  });
});

// ---------------------------------------------------------------------------
// 3. Refund mutations — one audit row per decision, execution and failure.
// ---------------------------------------------------------------------------

describe("A108 — refund mutations are audited", () => {
  const decision = read("app/api/admin/refunds/route.ts");
  const execute = read("app/api/admin/refunds/execute/route.ts");

  it("approve/reject is attributable, redacted and correlation-tagged", () => {
    expect(decision).toMatch(/recordAdminAction\s*\(/);
    for (const action of ["refund.approve", "refund.reject"]) {
      expect(decision).toContain(action);
    }
    expect(decision).toContain('entityType: "order_refund"');
    expect(decision).toMatch(/actorEmail:\s*identity\.email/);
    expect(decision).toMatch(/actorRole:\s*identity\.role/);
    expect(decision).toMatch(/redactAuditText\(note\)/);
    expect(decision).toMatch(/correlationIdFrom\(req\)/);
    // The raw admin note never reaches the audit log.
    expect(decision).not.toMatch(/newValues:\s*\{\s*decision,\s*note\s*\}/);
  });

  it("execution success and failure are both audited", () => {
    for (const action of ["refund.execute", "refund.execute_failed"]) {
      expect(execute, `missing ${action}`).toContain(action);
    }
    expect(execute).toContain('entityType: "refund_execution"');
    expect(execute).toMatch(/actorEmail:\s*identity\.email/);
    expect(execute).toMatch(/redactAuditText\(message\)/);
    expect(execute).toMatch(/result:\s*"failure"/);
    expect(execute).toMatch(/correlationIdFrom\(req\)/);
  });

  it("request creation is audited with the signed-in requester, not the raw reason", () => {
    const request = read("app/api/admin/orders/[id]/refund/route.ts");
    expect(request).toContain("refund.requested");
    expect(request).toContain('entityType: "order_refunds"');
    expect(request).toMatch(/actorEmail:\s*identity\.email/);
    expect(request).toMatch(/redactAuditText\(reason/);
    expect(request).toMatch(/correlationIdFrom\(req\)/);
  });
});

// ---------------------------------------------------------------------------
// 4. Partner applications — every review decision is audited.
// ---------------------------------------------------------------------------

describe("A108 — partner-application review mutations are audited", () => {
  const src = read("app/api/admin/partner-applications/review/route.ts");

  it("submission review, approval, rejection and request-for-info write an admin action", () => {
    expect(src).toMatch(/recordAdminAction\s*\(/);
    for (const action of [
      "partner_application.reviewed",
      "partner_application.info_requested",
      "partner_application.approved",
      "partner_application.rejected",
    ]) {
      expect(src, `missing ${action}`).toContain(action);
    }
    expect(src).toContain('entityType: "partner_onboarding_application"');
    expect(src).toMatch(/actorEmail:\s*identity\.email/);
    expect(src).toMatch(/actorRole:\s*identity\.role/);
    expect(src).toMatch(/redactAuditText\(notes\)/);
    expect(src).toMatch(/correlationIdFrom\(req\)/);
  });

  it("public submission is audited by application id only, carrying no applicant PII", () => {
    const submit = read("app/api/store/partner-applications/route.ts");
    expect(submit).toContain("partner_application.submitted");
    expect(submit).toContain('entityType: "partner_onboarding_application"');
    expect(submit).toMatch(/actorEmail:\s*"public"/);
    expect(submit).toMatch(/correlationIdFrom\(req\)/);
    // Applicant contact details and document keys never reach the audit row.
    expect(submit).not.toMatch(/newValues:[\s\S]{0,200}contact_email/);
    expect(submit).not.toMatch(/newValues:[\s\S]{0,200}document_keys/);
  });

  it("never audits the one-time password or applicant PII", () => {
    expect(src).not.toMatch(/recordAdminAction\(\{[\s\S]*temporaryPassword/);
    expect(src).not.toMatch(/recordAdminAction\(\{[\s\S]*contact_email/);
  });
});

// ---------------------------------------------------------------------------
// 5. Platform settings — the mode toggle is attributable.
// ---------------------------------------------------------------------------

describe("A108 — platform mode toggle is audited", () => {
  const src = read("app/api/admin/set-platform-mode/route.ts");

  it("records before/after mode with the signed-in admin", () => {
    expect(src).toMatch(/recordAdminAction\s*\(/);
    expect(src).toContain("platform_mode.changed");
    expect(src).toContain('entityType: "platform_settings"');
    expect(src).toMatch(/actorEmail:\s*identity\.email/);
    expect(src).toMatch(/actorRole:\s*identity\.role/);
    expect(src).toMatch(/oldValues:\s*\{\s*mode:\s*previousMode\s*\}/);
    expect(src).toMatch(/newValues:\s*\{\s*mode:\s*validMode/);
    expect(src).toMatch(/correlationIdFrom\(req\)/);
  });
});

// ---------------------------------------------------------------------------
// 6. Canonical action set is unchanged (no weakening of existing assertions).
// ---------------------------------------------------------------------------

describe("A108 — canonical action vocabulary preserved", () => {
  it("keeps the existing AUDIT_ACTIONS keys intact", () => {
    expect(AUDIT_ACTIONS).toMatchObject({
      MEMBER_INVITED: "MEMBER_INVITED",
      MEMBER_ROLE_CHANGED: "MEMBER_ROLE_CHANGED",
      MEMBER_SUSPENDED: "MEMBER_SUSPENDED",
      SESSIONS_REVOKED: "SESSIONS_REVOKED",
      PROFILE_UPDATED: "PROFILE_UPDATED",
      PRODUCT_SUBMITTED: "PRODUCT_SUBMITTED",
      ORDER_ACCEPTED: "ORDER_ACCEPTED",
      ORDER_REJECTED: "ORDER_REJECTED",
      ORDER_FULFILLED: "ORDER_FULFILLED",
      SETTLEMENT_VIEWED: "SETTLEMENT_VIEWED",
    });
  });
});
