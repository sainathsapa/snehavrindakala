import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  businessRulesReady,
  OWNER_INPUT_FIELDS,
  OWNER_INPUT_GROUPS,
  validateOwnerInputs,
  type OwnerInputEnv,
} from "../lib/config/owner-inputs";

/**
 * Owner inputs must be reported by NAME only, and must never be invented.
 * A group is configured only when all of its required keys are present;
 * business rules have no defaults.
 */

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

/** A fully populated env, built from the descriptors themselves. */
const fullyConfiguredEnv = (): OwnerInputEnv => {
  const env: OwnerInputEnv = {};
  for (const fields of Object.values(OWNER_INPUT_FIELDS)) {
    for (const field of fields) {
      env[field.envVar ?? field.key] = "configured-value";
      for (const alt of field.alternatives ?? []) env[alt] = "configured-value";
    }
  }
  return env;
};

describe("OWNER_INPUT_FIELDS descriptors", () => {
  it("is grouped into exactly the six owner-input groups", () => {
    expect(OWNER_INPUT_GROUPS).toEqual([
      "Payments",
      "Email",
      "Shipping",
      "PartnerBusiness",
      "FinanceLegal",
      "Production",
    ]);
    expect(Object.keys(OWNER_INPUT_FIELDS)).toEqual([...OWNER_INPUT_GROUPS]);
  });

  it("every descriptor carries key, label and requiredFor (envVar optional)", () => {
    for (const group of OWNER_INPUT_GROUPS) {
      expect(OWNER_INPUT_FIELDS[group].length).toBeGreaterThan(0);
      for (const field of OWNER_INPUT_FIELDS[group]) {
        expect(typeof field.key).toBe("string");
        expect(field.key.length).toBeGreaterThan(0);
        expect(typeof field.label).toBe("string");
        expect(field.label.length).toBeGreaterThan(0);
        expect(["always", "feature"]).toContain(field.requiredFor.kind);
        if (field.envVar !== undefined) expect(typeof field.envVar).toBe("string");
      }
    }
  });
});

describe("validateOwnerInputs — missing groups", () => {
  it("reports every group as unconfigured when nothing is set", () => {
    const result = validateOwnerInputs({});
    for (const group of OWNER_INPUT_GROUPS) {
      expect(result.configuredGroups[group], `${group} must not be configured`).toBe(false);
      expect(
        result.missing.some((item) => item.group === group),
        `${group} must report missing fields`
      ).toBe(true);
    }
  });

  it("a group is configured only when ALL its required keys are present", () => {
    const env: OwnerInputEnv = {
      RAZORPAY_KEY_ID: "rzp_test_x",
      RAZORPAY_KEY_SECRET: "s",
      RAZORPAY_WEBHOOK_SECRET: "w",
      REFUND_POLICY_APPROVED: "yes",
      // CHECKOUT_RAZORPAY_PROVIDER is off, so the live-keys field is not required.
    };
    const before = validateOwnerInputs(env);
    expect(before.configuredGroups.Payments).toBe(true);

    const missingOne = validateOwnerInputs({ ...env, RAZORPAY_KEY_SECRET: undefined });
    expect(missingOne.configuredGroups.Payments).toBe(false);
    expect(missingOne.missing.some((m) => m.name === "RAZORPAY_KEY_SECRET")).toBe(true);
  });

  it("a fully populated env configures every group with no missing fields", () => {
    const result = validateOwnerInputs(fullyConfiguredEnv());
    expect(result.missing).toEqual([]);
    for (const group of OWNER_INPUT_GROUPS) {
      expect(result.configuredGroups[group]).toBe(true);
    }
  });

  it("accepts alternative env vars (public Razorpay key / JWT secret / SES role)", () => {
    const result = validateOwnerInputs({
      NEXT_PUBLIC_RAZORPAY_KEY_ID: "rzp_public",
      JWT_SECRET: "jwt-secret",
      AWS_SES_ROLE_ARN: "arn:aws:iam::1:role/ses",
    });
    expect(result.present.some((p) => p.key === "razorpayKeyId")).toBe(true);
    expect(result.present.some((p) => p.key === "sessionSecret")).toBe(true);
    // The transport group accepts either provider; the key is named for the
    // group rather than for SES, so Resend can satisfy it on its own.
    expect(result.present.some((p) => p.key === "emailTransport")).toBe(true);
  });

  it("accepts a Resend key as a complete email transport", () => {
    const result = validateOwnerInputs({
      FROM_EMAIL: "no-reply@snehavrinda.in",
      RESEND_API_KEY: "re_key",
    });
    expect(result.present.some((p) => p.key === "emailTransport")).toBe(true);
    expect(result.configuredGroups.Email).toBe(true);
  });
});

describe("validateOwnerInputs — no values leak", () => {
  it("reports names only, never the secret values", () => {
    const razorpaySecret = "sk_live_SUPER_SECRET_do_not_print_99887";
    const jwt = "jwt-super-secret-426271";
    const env = fullyConfiguredEnv();
    env.RAZORPAY_KEY_SECRET = razorpaySecret;
    env.JWT_SECRET = jwt;

    const serialized = JSON.stringify(validateOwnerInputs(env));
    expect(serialized).not.toContain(razorpaySecret);
    expect(serialized).not.toContain(jwt);
    // What it does contain are the NAMES to configure.
    expect(serialized).toContain("RAZORPAY_KEY_SECRET");
    expect(serialized).toContain("DATABASE_URL");
  });

  it("missing entries contain no value-bearing fields", () => {
    const missing = validateOwnerInputs({}).missing;
    expect(missing.length).toBeGreaterThan(0);
    for (const item of missing) {
      expect(Object.keys(item).sort()).toEqual(["group", "key", "label", "name"]);
      for (const value of Object.values(item)) {
        expect(value).not.toMatch(/secret[_-]?value|password[_-]?value/i);
      }
    }
  });
});

describe("validateOwnerInputs — feature-gated keys", () => {
  it("a gated key is not required while its flag and indicators are off", () => {
    const result = validateOwnerInputs({});
    expect(result.missing.some((m) => m.name === "RAZORPAY_LIVE_KEYS_AUTHORIZED")).toBe(false);
    expect(result.missing.some((m) => m.name === "SHIPROCKET_WEBHOOK_TOKEN")).toBe(false);
    expect(result.missing.some((m) => m.name === "EMAIL_TEST_RECIPIENT")).toBe(false);
  });

  it("a gated key becomes required when its flag is switched on", () => {
    const result = validateOwnerInputs({ CHECKOUT_RAZORPAY_PROVIDER: "1" });
    expect(result.missing.some((m) => m.name === "RAZORPAY_LIVE_KEYS_AUTHORIZED")).toBe(true);

    const shipping = validateOwnerInputs({ FEATURE_SHIPROCKET_WEBHOOK: "1" });
    expect(shipping.missing.some((m) => m.name === "SHIPROCKET_WEBHOOK_TOKEN")).toBe(true);
  });

  it("an indicator variable also switches a gated key on (half-configured counts as on)", () => {
    const monitoringOff = validateOwnerInputs({});
    expect(monitoringOff.missing.some((m) => m.name === "MONITORING_CONFIG")).toBe(false);

    const monitoringOn = validateOwnerInputs({ SENTRY_DSN: "https://key@sentry.test/1" });
    expect(monitoringOn.missing.some((m) => m.name === "MONITORING_CONFIG")).toBe(true);
  });
});

describe("businessRulesReady — no defaults, no guesses", () => {
  const complete = {
    partnerIdentities: { partnerA: "Legal Name Pvt Ltd" },
    commissionRates: 12.5,
    commissionBasis: "gross_item_value",
    payoutTerms: "monthly_bank_transfer",
  };

  it("is false with an empty or non-object config", () => {
    expect(businessRulesReady({})).toBe(false);
    expect(businessRulesReady(null)).toBe(false);
    expect(businessRulesReady(undefined)).toBe(false);
  });

  it("is false when any one of the four required facts is missing", () => {
    expect(businessRulesReady({ ...complete, partnerIdentities: undefined })).toBe(false);
    expect(businessRulesReady({ ...complete, commissionRates: undefined })).toBe(false);
    expect(businessRulesReady({ ...complete, commissionBasis: undefined })).toBe(false);
    expect(businessRulesReady({ ...complete, payoutTerms: undefined })).toBe(false);
    expect(
      businessRulesReady({ partnerIdentities: complete.partnerIdentities })
    ).toBe(false);
  });

  it("is true only when all four required business fields are supplied", () => {
    expect(businessRulesReady(complete)).toBe(true);
  });

  it("rejects placeholder / zero values instead of inventing a default", () => {
    expect(businessRulesReady({ ...complete, commissionRates: 0 })).toBe(false);
    expect(businessRulesReady({ ...complete, commissionRates: "default" })).toBe(false);
    expect(businessRulesReady({ ...complete, commissionBasis: "tbd" })).toBe(false);
    expect(businessRulesReady({ ...complete, payoutTerms: [] })).toBe(false);
    expect(businessRulesReady({ ...complete, partnerIdentities: {} })).toBe(false);
  });

  it("accepts the finance module's snake_case shapes", () => {
    expect(
      businessRulesReady({
        partner_identities: ["partner-a"],
        rate_percent: 10,
        rate_basis: "discounted_item_value",
        payout_terms: "fortnightly_upi",
      })
    ).toBe(true);
  });
});

describe("status API wiring", () => {
  it("gates the owner-input status route on settings:read and returns only the validation result", () => {
    const source = read("app/api/admin/owner-input-status/route.ts");
    expect(source).toMatch(/requirePermission\(["']settings:read["']\)/);
    expect(source).toMatch(/status: 401/);
    expect(source).toMatch(/validateOwnerInputs\(\)/);
    // The route must not read raw env itself — values stay in the validator,
    // which reports names only.
    expect(source).not.toMatch(/process\.env/);
  });
});
