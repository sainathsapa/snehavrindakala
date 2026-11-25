/**
 * The commercial activation gate.
 *
 * `partner.account_status = 'active'` unlocks portal access, listing and
 * settlement. These tests pin the rule that it cannot be set without a signed,
 * in-force agreement AND an approved commission/payout configuration — and that
 * every refusal names a machine-readable reason an admin can act on.
 */

import { describe, it, expect } from "vitest";
import {
  evaluateCommercialReadiness,
  type PartnerAgreementRecord,
  type PartnerCommercialConfigRecord,
} from "@/lib/admin-partners/commercial";
import {
  PlatformValidationError,
  setAccountStatus,
  type Partner,
  type QueryExecutor,
} from "@/lib/admin-partners/platform";

const TODAY = "2026-03-01";

const agreement = (
  overrides: Partial<PartnerAgreementRecord> = {}
): PartnerAgreementRecord => ({
  id: "agr-1",
  partner_id: "p-1",
  agreement_reference: "AGR-2026-001",
  status: "signed",
  signed_on: "2026-01-10",
  effective_from: "2026-01-10",
  effective_to: null,
  ...overrides,
});

const commercial = (
  overrides: Partial<PartnerCommercialConfigRecord> = {}
): PartnerCommercialConfigRecord => ({
  id: "cc-1",
  partner_id: "p-1",
  commission_policy_id: "policy-1",
  payout_frequency: "monthly",
  payout_terms: "Net 15 days after delivery confirmation",
  effective_from: "2026-01-10",
  approved_by: "owner@example.com",
  approved_at: "2026-01-10T09:00:00.000Z",
  ...overrides,
});

describe("evaluateCommercialReadiness — the happy path", () => {
  it("is ready with a signed in-force agreement and an approved config", () => {
    const r = evaluateCommercialReadiness(
      { agreement: agreement(), commercial: commercial() },
      TODAY
    );
    expect(r.ready).toBe(true);
    expect(r.blockers).toEqual([]);
    expect(r.messages).toEqual([]);
  });

  it("stays ready on the first day of the effective period and the last", () => {
    expect(
      evaluateCommercialReadiness(
        {
          agreement: agreement({ effective_from: TODAY }),
          commercial: commercial({ effective_from: TODAY }),
        },
        TODAY
      ).ready
    ).toBe(true);

    expect(
      evaluateCommercialReadiness(
        {
          agreement: agreement({ effective_from: "2026-01-10", effective_to: TODAY }),
          commercial: commercial(),
        },
        TODAY
      ).ready
    ).toBe(true);
  });
});

describe("evaluateCommercialReadiness — agreement blockers", () => {
  const cases: Array<[string, PartnerAgreementRecord | null, string]> = [
    ["no agreement at all", null, "agreement_missing"],
    ["a draft agreement", agreement({ status: "draft" }), "agreement_not_signed"],
    ["a terminated agreement", agreement({ status: "terminated" }), "agreement_expired"],
    ["an expired agreement", agreement({ status: "expired" }), "agreement_expired"],
    ["a signed agreement with no reference", agreement({ agreement_reference: "" }), "agreement_reference_missing"],
    ["a signed agreement with no signing date", agreement({ signed_on: null }), "agreement_signed_on_missing"],
    ["an agreement that starts in the future", agreement({ effective_from: "2026-04-01" }), "agreement_not_yet_effective"],
  ];

  for (const [label, record, expected] of cases) {
    it(`refuses: ${label} → ${expected}`, () => {
      const r = evaluateCommercialReadiness(
        { agreement: record, commercial: commercial() },
        TODAY
      );
      expect(r.ready).toBe(false);
      expect(r.blockers).toContain(expected);
      expect(r.messages.length).toBeGreaterThan(0);
    });
  }

  it("treats a past effective_to as expired even when status still says signed", () => {
    // A stale status column must not keep a lapsed agreement alive.
    const r = evaluateCommercialReadiness(
      {
        agreement: agreement({ status: "signed", effective_to: "2026-02-01" }),
        commercial: commercial(),
      },
      TODAY
    );
    expect(r.ready).toBe(false);
    expect(r.blockers).toContain("agreement_expired");
  });
});

describe("evaluateCommercialReadiness — commercial configuration blockers", () => {
  it("refuses when there is no commercial configuration", () => {
    const r = evaluateCommercialReadiness(
      { agreement: agreement(), commercial: null },
      TODAY
    );
    expect(r.ready).toBe(false);
    expect(r.blockers).toContain("commercial_config_missing");
  });

  it("refuses an unapproved configuration (no approver)", () => {
    const r = evaluateCommercialReadiness(
      { agreement: agreement(), commercial: commercial({ approved_by: null, approved_at: null }) },
      TODAY
    );
    expect(r.blockers).toContain("commercial_config_not_approved");
  });

  it("refuses when the commission policy is not named", () => {
    const r = evaluateCommercialReadiness(
      { agreement: agreement(), commercial: commercial({ commission_policy_id: null }) },
      TODAY
    );
    expect(r.blockers).toContain("commission_policy_missing");
  });

  it("refuses when payout frequency is missing or not an accepted value", () => {
    for (const freq of [null, "daily" as any]) {
      const r = evaluateCommercialReadiness(
        { agreement: agreement(), commercial: commercial({ payout_frequency: freq }) },
        TODAY
      );
      expect(r.blockers).toContain("payout_frequency_missing");
    }
  });

  it("refuses when payout terms are empty", () => {
    const r = evaluateCommercialReadiness(
      { agreement: agreement(), commercial: commercial({ payout_terms: "   " }) },
      TODAY
    );
    expect(r.blockers).toContain("payout_terms_missing");
  });

  it("refuses a configuration that only takes effect later", () => {
    const r = evaluateCommercialReadiness(
      { agreement: agreement(), commercial: commercial({ effective_from: "2026-06-01" }) },
      TODAY
    );
    expect(r.blockers).toContain("commercial_config_not_yet_effective");
  });

  it("reports every missing item at once instead of stopping at the first", () => {
    const r = evaluateCommercialReadiness({ agreement: null, commercial: null }, TODAY);
    expect(r.ready).toBe(false);
    expect(r.blockers).toEqual(
      expect.arrayContaining(["agreement_missing", "commercial_config_missing"])
    );
  });
});

/* ── the gate is enforced by setAccountStatus, not just by the evaluator ── */

function gateDb(opts: { agreement: any | null; commercial: any | null; status?: string }) {
  const calls: { sql: string; params: any[] }[] = [];
  const partner = {
    id: "p-1",
    legal_name: "Vidya Handicrafts LLP",
    display_name: "Vidya Handicrafts",
    slug: "vidya-handicrafts",
    contact_email: "owner@vidya.example",
    contact_phone: null,
    business_profile: {},
    registration_details: {},
    account_status: opts.status ?? "pending",
    verification_status: "unverified",
    approval_history: [],
    artist_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  } as unknown as Partner;

  const exec: QueryExecutor = async (sql, params = []) => {
    const t = sql.replace(/\s+/g, " ").trim();
    calls.push({ sql: t, params });
    if (/^SELECT \* FROM marketplace_partner_agreement\b/i.test(t)) return opts.agreement ? [opts.agreement] : [];
    if (/^SELECT \* FROM partner_commercial_config\b/i.test(t)) return opts.commercial ? [opts.commercial] : [];
    if (/^SELECT .* FROM partner\b/i.test(t)) return [partner];
    if (/^UPDATE partner\b/i.test(t)) {
      return [{ ...partner, account_status: params[0] }];
    }
    if (/^INSERT INTO partner_audit_log\b/i.test(t)) return [{ id: "audit-1" }];
    return [];
  };

  return {
    exec,
    calls,
    deps: { executor: exec, now: () => new Date(`${TODAY}T10:00:00.000Z`) },
    updates: () => calls.filter((c) => /^UPDATE partner\b/i.test(c.sql)),
  };
}

describe("setAccountStatus refuses commercial activation without the terms", () => {
  it("refuses 'active' when nothing is recorded, and writes no UPDATE", async () => {
    const db = gateDb({ agreement: null, commercial: null });
    await expect(
      setAccountStatus("p-1", "active", "admin@example.com", db.deps as any)
    ).rejects.toBeInstanceOf(PlatformValidationError);

    expect(db.updates()).toHaveLength(0);
  });

  it("includes machine-readable blockers so the UI can explain the refusal", async () => {
    const db = gateDb({ agreement: null, commercial: null });
    try {
      await setAccountStatus("p-1", "active", "admin@example.com", db.deps as any);
      throw new Error("expected the activation to be refused");
    } catch (err) {
      expect(err).toBeInstanceOf(PlatformValidationError);
      expect((err as PlatformValidationError).blockers).toEqual(
        expect.arrayContaining(["agreement_missing", "commercial_config_missing"])
      );
    }
  });

  it("allows 'active' once a signed agreement and approved config exist", async () => {
    const db = gateDb({ agreement: agreement(), commercial: commercial() });
    const updated = await setAccountStatus(
      "p-1",
      "active",
      "admin@example.com",
      db.deps as any
    );
    expect(updated.account_status).toBe("active");
    expect(db.updates()).toHaveLength(1);
  });

  it("still allows non-commercial statuses without any terms (suspend/offboard)", async () => {
    for (const status of ["suspended", "rejected", "pending"] as const) {
      const db = gateDb({ agreement: null, commercial: null, status: "active" });
      const updated = await setAccountStatus(
        "p-1",
        status,
        "admin@example.com",
        db.deps as any
      );
      expect(updated.account_status).toBe(status);
    }
  });

  it("re-gates an already-active partner, so a lapsed agreement is not ignored", async () => {
    const db = gateDb({
      agreement: agreement({ status: "expired" }),
      commercial: commercial(),
      status: "active",
    });
    await expect(
      setAccountStatus("p-1", "active", "admin@example.com", db.deps as any)
    ).rejects.toBeInstanceOf(PlatformValidationError);
  });
});
