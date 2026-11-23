/**
 * A10 INDEPENDENT QA — A02 audit coverage (pure + static only).
 *
 * Independently verifies that every in-scope mutation route calls an audit
 * primitive, that the two Lead-wired writes are present, and that PII/free text
 * is redacted. No database, cookies or network are used.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  AUDIT_ACTIONS,
  REDACTED,
  auditPayload,
  redactAuditText,
} from "@/lib/partner-audit/audit";
import type { PartnerContext } from "@/lib/partner/types";

const app = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(app, rel), "utf8");

const ctx: PartnerContext = {
  partnerId: "p_qa",
  membershipId: "m_qa",
  email: "partner@example.test",
  role: "partner_owner",
  tokenVersion: 1,
};

/** Routes in the A02 contract scope that mutate tenant/finance state. */
const MUTATION_ROUTES = [
  "app/api/partner/team/route.ts",
  "app/api/partner/team/[id]/route.ts",
  "app/api/partner/products/route.ts",
  "app/api/partner/products/[id]/route.ts",
  "app/api/partner/orders/[id]/accept/route.ts",
  "app/api/partner/orders/[id]/reject/route.ts",
  "app/api/partner/orders/[id]/fulfil/route.ts",
  "app/api/partner/profile/route.ts",
  "app/api/admin/refunds/route.ts",
  "app/api/admin/refunds/execute/route.ts",
  "app/api/admin/partner-applications/review/route.ts",
  "app/api/admin/set-platform-mode/route.ts",
  "app/api/admin/orders/[id]/refund/route.ts",
  "app/api/store/partner-applications/route.ts",
];

describe("A02 — every in-scope mutation route calls an audit primitive", () => {
  it("each mutation route contains a durable audit write call", () => {
    for (const rel of MUTATION_ROUTES) {
      const src = read(rel);
      const hasAudit = /recordMutationAudit|recordAdminAction|auditFinanceAction/.test(src);
      expect(hasAudit, `${rel} is missing an audit primitive`).toBe(true);
    }
  });

  it("mutation audit is NOT best-effort (it throws so a route can 5xx)", () => {
    const src = read("lib/partner-audit/audit.ts");
    const fn = src.match(/export async function recordMutationAudit\([\s\S]*?\n\}/);
    expect(fn).not.toBeNull();
    expect(fn![0]).toMatch(/throw new Error\(/);
  });

  it("canonical audit actions cover team, product and fulfilment mutations", () => {
    for (const action of [
      "MEMBER_INVITED", "MEMBER_ROLE_CHANGED", "MEMBER_SUSPENDED", "SESSIONS_REVOKED",
      "PROFILE_UPDATED", "PRODUCT_SUBMITTED", "ORDER_ACCEPTED", "ORDER_REJECTED",
      "ORDER_FULFILLED", "SETTLEMENT_VIEWED",
    ]) {
      expect(AUDIT_ACTIONS).toHaveProperty(action, action);
    }
  });
});

describe("A02 — the two Lead-wired audit writes", () => {
  it("refund.requested is recorded by the admin refund route with redacted reason", () => {
    const src = read("app/api/admin/orders/[id]/refund/route.ts");
    expect(src).toMatch(/action:\s*["']refund\.requested["']/);
    expect(src).toMatch(/recordAdminAction/);
    expect(src).toMatch(/redactAuditText\(reason\s*\|\|\s*["']{2}\)/);
    expect(src).toMatch(/actorEmail:\s*identity\.email/);
  });

  it("partner_application.submitted is recorded by the public submit route with no PII", () => {
    const src = read("app/api/store/partner-applications/route.ts");
    expect(src).toMatch(/action:\s*["']partner_application\.submitted["']/);
    expect(src).toMatch(/recordAdminAction/);
    expect(src).toMatch(/newValues:\s*\{\s*status:\s*["']pending["']/);
    // No applicant contact detail or document key is copied into the audit row.
    const newValues = src.match(/newValues:\s*\{[^}]*\}/)?.[0] ?? "";
    expect(newValues).not.toMatch(/contact_email|legal_name|document_keys|contact_phone/i);
    expect(newValues).toMatch(/requestId/);
  });
});

describe("A02 — redaction of PII and free text (pure)", () => {
  it("auditPayload redacts secret keys, emails and card numbers but keeps safe scalars", () => {
    const payload = auditPayload("ORDER_ACCEPTED", ctx, {
      contact_email: "buyer@example.test",
      password: "hunter2",
      token: "sk_live_abc",
      card: "4111111111111111",
      note: "reach me at buyer@example.test please",
      safeField: "ok",
      count: 3,
    });
    const entity = payload.entity as Record<string, unknown>;
    expect(entity.contact_email).toBe(REDACTED);
    expect(entity.password).toBe(REDACTED);
    expect(entity.token).toBe(REDACTED);
    expect(entity.card).toBe(REDACTED);
    expect(entity.note).toBe("reach me at [REDACTED] please");
    expect(entity.safeField).toBe("ok");
    expect(entity.count).toBe(3);
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("buyer@example.test");
    expect(serialized).not.toContain("4111111111111111");
    expect(serialized).not.toContain("hunter2");
    expect(payload).toMatchObject({ action: "ORDER_ACCEPTED", partnerId: "p_qa", actorRole: "partner_owner" });
  });

  it("redactAuditText scrubs free-text emails and is null-safe", () => {
    expect(redactAuditText("Email bob@example.test now")).toBe("Email [REDACTED] now");
    expect(redactAuditText("card 4111111111111111")).toBe("card [REDACTED]");
    expect(redactAuditText(null)).toBeNull();
    expect(redactAuditText(undefined)).toBeNull();
  });
});
