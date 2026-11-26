import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  backupStatus,
  checkoutIsPossible,
  configurationChecklist,
  cronStatus,
  emailStatus,
  fulfilmentStatus,
  paymentStatus,
  socialStatus,
} from "../lib/config-status";

/**
 * These report what a deployment can do. Two rules matter more than the copy:
 * a missing secret must never be reported as ready, and no secret value may be
 * returned — only whether it is set.
 */

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const RAZORPAY = {
  RAZORPAY_KEY_ID: "rzp_test_key",
  RAZORPAY_KEY_SECRET: "secret-value-123",
  RAZORPAY_WEBHOOK_SECRET: "webhook-secret-456",
};

describe("paymentStatus", () => {
  it("is missing without keys, and says so", () => {
    const status = paymentStatus({});
    expect(status.level).toBe("missing");
    expect(status.detail).toMatch(/Razorpay keys are not set/);
  });

  it("is partial with keys but no webhook secret", () => {
    const status = paymentStatus(RAZORPAY);
    expect(status.level).toBe("ready");

    const noWebhook = paymentStatus({
      RAZORPAY_KEY_ID: RAZORPAY.RAZORPAY_KEY_ID,
      RAZORPAY_KEY_SECRET: RAZORPAY.RAZORPAY_KEY_SECRET,
    });
    expect(noWebhook.level).toBe("partial");
    expect(noWebhook.keys).toContain("RAZORPAY_WEBHOOK_SECRET");
  });

  it("accepts the public key id form used by the browser", () => {
    const status = paymentStatus({
      NEXT_PUBLIC_RAZORPAY_KEY_ID: "rzp_test_public",
      RAZORPAY_KEY_SECRET: "secret",
      RAZORPAY_WEBHOOK_SECRET: "webhook",
    });
    expect(status.level).toBe("ready");
  });
});

describe("emailStatus", () => {
  it("separates 'no transport at all' from 'half configured'", () => {
    expect(emailStatus({}).level).toBe("missing");
    expect(emailStatus({ FROM_EMAIL: "orders@shop.test" }).level).toBe("partial");
    expect(emailStatus({ RESEND_API_KEY: "re_x" }).level).toBe("partial");
    expect(
      emailStatus({ FROM_EMAIL: "orders@shop.test", RESEND_API_KEY: "re_x" }).level
    ).toBe("ready");
  });

  it("does not count SES variables, because that transport is gone", () => {
    // The transport is Resend only. Reporting "ready" because AWS_SES_* exists
    // would tell an operator mail works when nothing reads those variables.
    expect(
      emailStatus({ FROM_EMAIL: "orders@shop.test", AWS_SES_ROLE_ARN: "arn:aws:iam::1:role/x" })
        .level
    ).toBe("partial");
  });
});

describe("other statuses", () => {
  it("reports shipping as partial when the pickup postcode is missing", () => {
    expect(fulfilmentStatus({}).level).toBe("missing");
    expect(
      fulfilmentStatus({ SHIPROCKET_EMAIL: "a", SHIPROCKET_PASSWORD: "b" }).level
    ).toBe("partial");
  });

  it("reports cron as missing until CRON_SECRET exists", () => {
    expect(cronStatus({}).level).toBe("missing");
    expect(cronStatus({ CRON_SECRET: "x" }).level).toBe("ready");
  });

  it("never calls backups ready, because the service is opt-in", () => {
    expect(backupStatus({}).level).toBe("partial");
    expect(backupStatus({ BACKUP_RETENTION_DAYS: "14" }).level).toBe("partial");
  });

  it("counts social links and names the ones still missing", () => {
    const status = socialStatus({ NEXT_PUBLIC_SOCIAL_INSTAGRAM: "https://ig.test/x" });
    expect(status.level).toBe("partial");
    expect(status.keys).toContain("NEXT_PUBLIC_SOCIAL_FACEBOOK");
    expect(status.keys).not.toContain("NEXT_PUBLIC_SOCIAL_INSTAGRAM");
  });
});

describe("checkoutIsPossible", () => {
  it("is false without payment keys, which is what the checkout page renders on", () => {
    expect(checkoutIsPossible({})).toBe(false);
    expect(checkoutIsPossible({ RAZORPAY_KEY_ID: "a", RAZORPAY_KEY_SECRET: "b" })).toBe(true);
  });
});

describe("no secrets leak", () => {
  it("never returns a value, only presence", () => {
    const configured = JSON.stringify(configurationChecklist(RAZORPAY));
    expect(configured).not.toContain("secret-value-123");
    expect(configured).not.toContain("webhook-secret-456");

    // What it does say, when something is missing, is which variable to set —
    // names are not secrets.
    const empty = JSON.stringify(configurationChecklist({}));
    expect(empty).toContain("RAZORPAY_KEY_SECRET");
    expect(empty).not.toContain("secret-value-123");
  });

  it("lists every documented gap, so the checklist cannot silently shrink", () => {
    const ids = configurationChecklist({}).map((item) => item.id);
    expect(ids).toEqual([
      "payments",
      "email",
      "fulfilment",
      "cron",
      "backups",
      "social",
    ]);
  });
});

describe("wiring", () => {
  it("is shown on the settings page and served to admins only", () => {
    expect(read("app/admin/settings/page.tsx")).toMatch(/api\/admin\/config-status/);
    expect(read("app/api/admin/config-status/route.ts")).toMatch(/requireAdmin/);
  });

  it("stops the checkout before an address is filled in", () => {
    expect(read("app/api/store/checkout/payment-session/route.ts")).toMatch(
      /checkoutIsPossible\(\)/
    );
    expect(read("app/[locale]/checkout/page.tsx")).toMatch(/paymentsAvailable=/);
  });
});
