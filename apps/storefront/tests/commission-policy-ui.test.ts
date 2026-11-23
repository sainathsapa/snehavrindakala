import { describe, it, expect } from "vitest";
import { policyConfigured } from "@/lib/finance/commission-policy";
import type { CommissionPolicy } from "@/lib/finance/types";
import {
  DEFAULT_FORM_VALUES,
  buildDraftPolicy,
  parseCommissionFormValues,
  previewCommission,
  validateCommissionForm,
  type CommissionFormValues,
} from "@/lib/finance-ui/preview";

const validValues: CommissionFormValues = {
  ...DEFAULT_FORM_VALUES,
  name: "Standard craft commission",
  scope: "global",
  rate_percent: "10",
  effective_from: "2020-01-01T00:00:00Z",
  confirmation: true,
  approverIdentity: "finance@example.com",
};

function draft(): CommissionPolicy {
  return buildDraftPolicy(validValues, "admin@example.com");
}

describe("previewCommission — pure preview maths, no activation", () => {
  it("computes percent commission and payable on the gross basis", () => {
    const preview = previewCommission(draft(), [{ label: "₹1,000", amounts: { gross: 1000 } }]);
    expect(preview.lines).toHaveLength(1);
    expect(preview.lines[0]).toMatchObject({
      label: "₹1,000",
      gross_basis: 1000,
      commission: 100,
      payable: 900,
    });
  });

  it("computes a fixed per-item amount when no percent is configured", () => {
    const values = { ...validValues, rate_percent: "", fixed_amount: "150" };
    const preview = previewCommission(buildDraftPolicy(values), [{ gross: 1000 }]);
    expect(preview.lines[0].commission).toBe(150);
    expect(preview.lines[0].payable).toBe(850);
  });

  it("honours discounted basis plus explicitly included tax and shipping", () => {
    const values: CommissionFormValues = {
      ...validValues,
      rate_basis: "discounted_item_value",
      tax_included: true,
      shipping_included: true,
    };
    const preview = previewCommission(buildDraftPolicy(values), [
      { gross: 1000, discount: 200, tax: 50, shipping: 100 },
    ]);
    // (1000 - 200) + 50 + 100 = 950; 10% = 95; payable 855.
    expect(preview.lines[0].gross_basis).toBe(950);
    expect(preview.lines[0].commission).toBe(95);
    expect(preview.lines[0].payable).toBe(855);
  });

  it("provides illustrative default samples when none are supplied", () => {
    const preview = previewCommission(draft());
    expect(preview.lines.length).toBeGreaterThan(1);
    for (const line of preview.lines) {
      expect(line.payable).toBe(Number((line.gross_basis - line.commission).toFixed(2)));
    }
  });

  it("never mutates or activates the policy it previews", () => {
    const policy = draft();
    const before = JSON.stringify(policy);
    const preview = previewCommission(policy, [1234.56]);
    expect(JSON.stringify(policy)).toBe(before);
    expect(preview.status).toBe("draft");
    expect(policy.status).toBe("draft");
    expect(policy.approved_by).toBeNull();
  });
});

describe("validateCommissionForm — confirmation and approver are mandatory", () => {
  it("accepts a fully configured, confirmed submission", () => {
    expect(
      validateCommissionForm({
        policy: draft(),
        confirmation: true,
        approverIdentity: "finance@example.com",
      })
    ).toEqual({ valid: true, errors: [] });
  });

  it("requires the explicit signed-agreement confirmation", () => {
    const result = validateCommissionForm({
      policy: draft(),
      confirmation: false,
      approverIdentity: "finance@example.com",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/signed partner agreement/);
  });

  it("requires a named approver identity", () => {
    const missing = validateCommissionForm({
      policy: draft(),
      confirmation: true,
      approverIdentity: "   ",
    });
    expect(missing.valid).toBe(false);
    expect(missing.errors.join(" ")).toMatch(/approver identity/);

    const notEmail = validateCommissionForm({
      policy: draft(),
      confirmation: true,
      approverIdentity: "somebody",
    });
    expect(notEmail.valid).toBe(false);
    expect(notEmail.errors.join(" ")).toMatch(/email address/);
  });

  it("still requires all business inputs even when confirmed", () => {
    const values = { ...validValues, rate_percent: "", fixed_amount: "" };
    const result = validateCommissionForm({
      policy: buildDraftPolicy(values),
      confirmation: true,
      approverIdentity: "finance@example.com",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/Exactly one of rate_percent or fixed_amount/);
  });

  it("refuses a policy that is already stamped as approved", () => {
    const result = validateCommissionForm({
      policy: { ...draft(), status: "approved", approved_by: "finance@example.com" },
      confirmation: true,
      approverIdentity: "finance@example.com",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/draft/);
  });
});

describe("no policy is active by default", () => {
  it("reports UNCONFIGURED with no policies at all", () => {
    expect(policyConfigured([])).toBe(false);
    expect(policyConfigured(null)).toBe(false);
  });

  it("builds a draft with no approver regardless of submitted identity fields", () => {
    const policy = draft();
    expect(policy.status).toBe("draft");
    expect(policy.approved_by).toBeNull();
    expect(policy.version).toBe(1);
    expect(policyConfigured([policy])).toBe(false);
    expect(previewCommission(policy).configured).toBe(false);
    expect(previewCommission(policy).settlementEnabled).toBe(false);
  });

  it("never seeds a rate when both or neither rate field is supplied", () => {
    const none = buildDraftPolicy({ ...validValues, rate_percent: "", fixed_amount: "" });
    expect(none.rate_percent).toBeNull();
    expect(none.fixed_amount).toBeNull();

    const both = buildDraftPolicy({
      ...validValues,
      rate_percent: "10",
      fixed_amount: "50",
    });
    expect(both.rate_percent).not.toBeNull();
    expect(both.fixed_amount).not.toBeNull();
    // Invalid input produces zero commission, never a guessed rate.
    expect(previewCommission(both, [1000]).lines[0].commission).toBe(0);
  });

  it("clears scope_ref for global scope and requires it for non-global", () => {
    const global = buildDraftPolicy({ ...validValues, scope_ref: "ignored" });
    expect(global.scope_ref).toBeNull();

    const partnerMissing = buildDraftPolicy({ ...validValues, scope: "partner" });
    expect(
      validateCommissionForm({
        policy: partnerMissing,
        confirmation: true,
        approverIdentity: "finance@example.com",
      }).errors.join(" ")
    ).toMatch(/scope_ref/);
  });
});

describe("draft cannot settle", () => {
  it("a draft policy never enables settlement, even with large example amounts", () => {
    const preview = previewCommission(draft(), [
      { gross: 1000 },
      { gross: 100000 },
    ]);
    expect(preview.settlementEnabled).toBe(false);
    expect(preview.configured).toBe(false);
    // Numbers are still illustrative — that is the point of a preview.
    expect(preview.lines[0].commission).toBe(100);
  });

  it("an approved-but-not-active policy still cannot settle", () => {
    const approved: CommissionPolicy = {
      ...draft(),
      status: "approved",
      approved_by: "finance@example.com",
    };
    expect(policyConfigured([approved])).toBe(false);
    expect(previewCommission(approved).settlementEnabled).toBe(false);
  });

  it("only a valid, approved, active policy inside its window settles", () => {
    const active: CommissionPolicy = {
      ...draft(),
      status: "active",
      approved_by: "finance@example.com",
    };
    const now = new Date("2026-01-01T00:00:00Z");
    expect(policyConfigured([active], now)).toBe(true);
    expect(previewCommission(active, undefined, now).settlementEnabled).toBe(true);

    const outOfWindow = { ...active, effective_to: "2025-01-01T00:00:00Z" };
    expect(previewCommission(outOfWindow, undefined, now).settlementEnabled).toBe(false);
  });
});

describe("parseCommissionFormValues — checkbox handling", () => {
  it("normalises GET/FormData strings into typed values", () => {
    const values = parseCommissionFormValues({
      name: "Policy",
      scope: "global",
      rate_basis: "gross_item_value",
      tax_included: "on",
      shipping_included: "false",
      rate_percent: "12.5",
      confirmation: "on",
      approverIdentity: "finance@example.com",
      effective_from: "2020-01-01",
    });
    expect(values.tax_included).toBe(true);
    expect(values.shipping_included).toBe(false);
    expect(values.confirmation).toBe(true);
    expect(values.rate_percent).toBe("12.5");
    expect(values.currency).toBe("INR");
  });
});
