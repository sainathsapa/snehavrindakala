import { describe, expect, it } from "vitest";
import {
  assertProductionConfig,
  BASELINE_KEYS,
  validateProductionConfig,
  type StartupEnv,
} from "../lib/startup-validation";

/**
 * The gate's whole purpose is to be safe to print. These canaries are unique
 * strings that must never appear in a result or a thrown message: if one does,
 * a deployment log has just published a credential.
 */
const CANARIES = [
  "CANARY-cookie-4f9a2b",
  "CANARY-admin-pw-7d1e08",
  "CANARY-db-pass-2c7bb4",
  "CANARY-rzp-secret-91aa3f",
  "CANARY-ses-secret-5e60cd",
  "CANARY-shiprocket-pw-83ff12",
];

const baseline: StartupEnv = {
  NODE_ENV: "production",
  COOKIE_SECRET: CANARIES[0],
  DATABASE_URL: `postgresql://svk:${CANARIES[2]}@db:5432/svk`,
  ADMIN_EMAIL: "canary-admin@example.test",
  ADMIN_PASSWORD: CANARIES[1],
  STOREFRONT_BASE_URL: "https://canary.example.test",
};

const noCanaries = (text: string) => {
  for (const canary of CANARIES) {
    expect(text, `leaked ${canary}`).not.toContain(canary);
  }
};

describe("validateProductionConfig — production", () => {
  it("fails when nothing is configured, naming every baseline setting", () => {
    const result = validateProductionConfig({ NODE_ENV: "production" });
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual([...BASELINE_KEYS]);
    noCanaries(JSON.stringify(result));
  });

  it("accepts a complete baseline", () => {
    const result = validateProductionConfig(baseline);
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    noCanaries(JSON.stringify(result));
  });

  it("accepts JWT_SECRET and the MEDUSA_* admin pair as alternatives", () => {
    const env: StartupEnv = {
      NODE_ENV: "production",
      JWT_SECRET: CANARIES[0],
      DATABASE_URL: baseline.DATABASE_URL,
      MEDUSA_ADMIN_EMAIL: "canary-medusa@example.test",
      MEDUSA_ADMIN_PASSWORD: CANARIES[1],
      STOREFRONT_BASE_URL: baseline.STOREFRONT_BASE_URL,
    };
    expect(validateProductionConfig(env)).toMatchObject({ ok: true, missing: [] });
  });

  it("still requires both halves of the alternative admin pair", () => {
    const env: StartupEnv = { ...baseline, MEDUSA_ADMIN_EMAIL: "medusa@example.test" };
    delete env.ADMIN_EMAIL;
    delete env.ADMIN_PASSWORD;
    const result = validateProductionConfig(env);
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("MEDUSA_ADMIN_PASSWORD");
    expect(result.missing).not.toContain("ADMIN_PASSWORD");
  });

  it("treats blank and explicit-off values as missing", () => {
    const env: StartupEnv = {
      ...baseline,
      COOKIE_SECRET: "   ",
      DATABASE_URL: "off",
    };
    const result = validateProductionConfig(env);
    expect(result.missing).toContain("COOKIE_SECRET/JWT_SECRET");
    expect(result.missing).toContain("DATABASE_URL");
  });
});

describe("validateProductionConfig — feature gates", () => {
  it("requires all Razorpay settings when payments are opted in", () => {
    const result = validateProductionConfig({
      ...baseline,
      FEATURE_RAZORPAY: "1",
    });
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual([
      "RAZORPAY_KEY_ID",
      "RAZORPAY_KEY_SECRET",
      "RAZORPAY_WEBHOOK_SECRET",
    ]);
  });

  it("detects a half-configured feature even without an explicit flag", () => {
    const result = validateProductionConfig({
      ...baseline,
      RAZORPAY_KEY_ID: "rzp_test_canary",
    });
    expect(result.missing).toContain("RAZORPAY_KEY_SECRET");
    expect(result.missing).toContain("RAZORPAY_WEBHOOK_SECRET");
    expect(result.missing).not.toContain("RAZORPAY_KEY_ID");
  });

  it("does not require Razorpay when the provider flag is explicitly off", () => {
    const result = validateProductionConfig({
      ...baseline,
      CHECKOUT_RAZORPAY_PROVIDER: "0",
    });
    expect(result).toMatchObject({ ok: true, missing: [] });
  });

  it("requires a sender and the Resend key for e-mail", () => {
    const result = validateProductionConfig({ ...baseline, FEATURE_EMAIL: "1" });
    expect(result.missing).toContain("FROM_EMAIL");
    expect(result.missing).toContain("RESEND_API_KEY");
  });

  it("boots with Resend alone, and ignores leftover SES variables", () => {
    const ok = validateProductionConfig({
      ...baseline,
      FEATURE_EMAIL: "1",
      FROM_EMAIL: "orders@example.test",
      RESEND_API_KEY: "re_test",
    });
    expect(ok).toMatchObject({ ok: true, missing: [] });

    // SES was removed from the transport. Credentials for it must not satisfy
    // the gate, or production starts a mail path that cannot send.
    const stale = validateProductionConfig({
      ...baseline,
      FEATURE_EMAIL: "1",
      FROM_EMAIL: "orders@example.test",
      AWS_SES_ROLE_ARN: "arn:aws:iam::123456789012:role/ses",
    });
    expect(stale.missing).toContain("RESEND_API_KEY");
  });

  it("requires Shiprocket credentials when fulfilment is enabled", () => {
    const result = validateProductionConfig({
      ...baseline,
      FEATURE_SHIPROCKET: "1",
    });
    expect(result.missing).toEqual(["SHIPROCKET_EMAIL", "SHIPROCKET_PASSWORD"]);
  });

  it("warns about (but does not fail on) a missing pickup postcode", () => {
    const result = validateProductionConfig({
      ...baseline,
      SHIPROCKET_EMAIL: "ship@example.test",
      SHIPROCKET_PASSWORD: CANARIES[5],
    });
    expect(result.ok).toBe(true);
    expect(result.warnings.join(" ")).toContain("SHIPROCKET_PICKUP_POSTCODE");
    noCanaries(JSON.stringify(result));
  });

  it("never enables unrelated features", () => {
    const result = validateProductionConfig({ ...baseline, RAZORPAY_KEY_SECRET: CANARIES[3] });
    // A lone Razorpay secret auto-enables payments, but not e-mail or shipping.
    expect(result.missing).not.toContain("FROM_EMAIL");
    expect(result.missing).not.toContain("SHIPROCKET_EMAIL");
  });
});

describe("validateProductionConfig — non-production", () => {
  it("is always ok outside production, but reports what production needs", () => {
    const result = validateProductionConfig({
      NODE_ENV: "test",
      FEATURE_SHIPROCKET: "1",
    });
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    const warnings = result.warnings.join(" ");
    expect(warnings).toContain("NODE_ENV is not production");
    expect(warnings).toContain("DATABASE_URL");
    expect(warnings).toContain("SHIPROCKET_PASSWORD");
  });

  it("does not promote advisory warnings into failures", () => {
    const result = validateProductionConfig({ ...baseline, NODE_ENV: "development" });
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
  });
});

describe("assertProductionConfig", () => {
  it("throws with names only when production config is incomplete", () => {
    const env: StartupEnv = {
      ...baseline,
      DATABASE_URL: `postgresql://svk:${CANARIES[2]}@db:5432/svk`,
      RAZORPAY_KEY_SECRET: CANARIES[3],
      AWS_SES_SECRET_ACCESS_KEY: CANARIES[4],
      SHIPROCKET_PASSWORD: CANARIES[5],
      FEATURE_EMAIL: "1",
      FEATURE_SHIPROCKET: "1",
    };
    delete env.COOKIE_SECRET;
    delete env.ADMIN_PASSWORD;

    let thrown = "";
    try {
      assertProductionConfig(env);
      throw new Error("assertProductionConfig did not throw");
    } catch (error) {
      thrown = (error as Error).message;
    }
    expect(thrown).toContain("COOKIE_SECRET/JWT_SECRET");
    expect(thrown).toContain("ADMIN_PASSWORD");
    expect(thrown).toContain("RAZORPAY_KEY_ID");
    noCanaries(thrown);
  });

  it("does not throw when the configuration is complete", () => {
    expect(() => assertProductionConfig(baseline)).not.toThrow();
  });
});
