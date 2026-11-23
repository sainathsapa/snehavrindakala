import { describe, it, expect } from "vitest";
import {
  computeCommission,
  validatePolicy,
  activatePolicy,
  policyConfigured,
  isPolicyEffective,
  round2,
} from "@/lib/finance/commission-policy";
import type { CommissionPolicy } from "@/lib/finance/types";

const configuredPolicy: CommissionPolicy = {
  id: "policy-1",
  name: "Standard marketplace commission",
  scope: "global",
  scope_ref: null,
  rate_basis: "gross_item_value",
  tax_included: false,
  shipping_included: false,
  rate_percent: 10,
  fixed_amount: null,
  currency: "INR",
  refund_effect: "reverse_earnings",
  payable_when: "order_delivered",
  status: "active",
  version: 1,
  effective_from: "2020-01-01T00:00:00Z",
  effective_to: null,
  approved_by: "finance@test",
};

describe("computeCommission — deterministic, no invented rates", () => {
  it("computes percent commission on the gross basis", () => {
    expect(computeCommission(configuredPolicy, { gross: 1000 })).toEqual({
      gross_basis: 1000,
      commission: 100,
      payable: 900,
    });
  });

  it("computes a fixed per-item amount instead of a percent", () => {
    const policy: CommissionPolicy = {
      ...configuredPolicy,
      rate_percent: null,
      fixed_amount: 150,
    };
    expect(computeCommission(policy, { gross: 1000 })).toEqual({
      gross_basis: 1000,
      commission: 150,
      payable: 850,
    });
  });

  it("honours gross vs discounted basis", () => {
    const amounts = { gross: 1000, discount: 200 };
    expect(computeCommission(configuredPolicy, amounts).commission).toBe(100);
    const discounted: CommissionPolicy = {
      ...configuredPolicy,
      rate_basis: "discounted_item_value",
    };
    const result = computeCommission(discounted, amounts);
    expect(result.gross_basis).toBe(800);
    expect(result.commission).toBe(80);
    expect(result.payable).toBe(720);
  });

  it("includes tax and shipping only when the policy flags say so", () => {
    const policy: CommissionPolicy = {
      ...configuredPolicy,
      rate_basis: "discounted_item_value",
      tax_included: true,
      shipping_included: true,
    };
    const result = computeCommission(policy, {
      gross: 1000,
      discount: 200,
      tax: 50,
      shipping: 100,
    });
    // (1000 - 200) + 50 + 100 = 950, 10% = 95
    expect(result.gross_basis).toBe(950);
    expect(result.commission).toBe(95);
    expect(result.payable).toBe(855);
  });

  it("rounds half-up to 2 decimal places", () => {
    const policy: CommissionPolicy = { ...configuredPolicy, rate_percent: 5 };
    const result = computeCommission(policy, { gross: 99.99 });
    expect(result.commission).toBe(5.0);
    expect(result.payable).toBe(94.99);
    expect(round2(1.005)).toBe(1.01);
    expect(round2(-1.005)).toBe(-1.01);
  });

  it("never invents a rate when neither or both rate fields are set", () => {
    const none: CommissionPolicy = {
      ...configuredPolicy,
      rate_percent: null,
      fixed_amount: null,
    };
    const both: CommissionPolicy = {
      ...configuredPolicy,
      rate_percent: 10,
      fixed_amount: 50,
    };
    expect(computeCommission(none, { gross: 1000 }).commission).toBe(0);
    expect(computeCommission(both, { gross: 1000 }).commission).toBe(0);
  });
});

describe("validatePolicy — explicit business fields only", () => {
  it("accepts a fully configured policy", () => {
    expect(validatePolicy(configuredPolicy)).toEqual({ valid: true, errors: [] });
  });

  it("requires exactly one rate", () => {
    expect(
      validatePolicy({ ...configuredPolicy, fixed_amount: 50 }).valid
    ).toBe(false);
    expect(
      validatePolicy({ ...configuredPolicy, rate_percent: null }).valid
    ).toBe(false);
  });

  it("rejects invalid status and missing business fields", () => {
    expect(
      validatePolicy({ ...configuredPolicy, status: "paid" as any }).valid
    ).toBe(false);
    expect(
      validatePolicy({ ...configuredPolicy, currency: undefined as any }).valid
    ).toBe(false);
    expect(
      validatePolicy({ ...configuredPolicy, tax_included: undefined as any })
        .valid
    ).toBe(false);
    expect(
      validatePolicy({ ...configuredPolicy, name: "" }).valid
    ).toBe(false);
  });

  it("requires effective_from and a sensible effective_to", () => {
    expect(
      validatePolicy({ ...configuredPolicy, effective_from: null }).valid
    ).toBe(false);
    expect(
      validatePolicy({
        ...configuredPolicy,
        effective_from: "2022-01-01T00:00:00Z",
        effective_to: "2021-01-01T00:00:00Z",
      }).valid
    ).toBe(false);
  });

  it("requires scope_ref for a non-global policy", () => {
    expect(
      validatePolicy({ ...configuredPolicy, scope: "partner", scope_ref: null })
        .valid
    ).toBe(false);
  });
});

describe("activatePolicy and policyConfigured", () => {
  it("activates only an approved policy that names its approver", () => {
    const approved: CommissionPolicy = {
      ...configuredPolicy,
      status: "approved",
      approved_by: "finance@test",
    };
    expect(activatePolicy(approved).status).toBe("active");
    expect(() =>
      activatePolicy({ ...approved, status: "draft" })
    ).toThrow(/Only an approved policy/);
    expect(() =>
      activatePolicy({ ...approved, approved_by: null })
    ).toThrow(/approved_by/);
  });

  it("reports configured only for a valid, active, effective policy", () => {
    expect(policyConfigured([configuredPolicy])).toBe(true);
    expect(policyConfigured([{ ...configuredPolicy, status: "draft" }])).toBe(
      false
    );
    expect(
      policyConfigured([
        { ...configuredPolicy, effective_to: "2021-01-01T00:00:00Z" },
      ])
    ).toBe(false);
    expect(
      policyConfigured([{ ...configuredPolicy, effective_from: "2099-01-01T00:00:00Z" }])
    ).toBe(false);
    expect(
      policyConfigured([
        { ...configuredPolicy, rate_percent: null, fixed_amount: null },
      ])
    ).toBe(false);
    expect(policyConfigured([])).toBe(false);
    expect(policyConfigured(null)).toBe(false);
  });

  it("isPolicyEffective applies the date window", () => {
    expect(isPolicyEffective(configuredPolicy)).toBe(true);
    expect(
      isPolicyEffective(configuredPolicy, new Date("2019-01-01T00:00:00Z"))
    ).toBe(false);
  });
});
