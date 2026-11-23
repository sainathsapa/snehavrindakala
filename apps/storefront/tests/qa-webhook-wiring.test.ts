import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * FINAL GO — QA wiring audit (agent A93).
 *
 * These are static, source-level checks that the security protections are still
 * wired into the payment and webhook paths. They are deliberately written as
 * "would fail if the guard were removed" assertions: if someone deletes an
 * HMAC check, swaps a timing-safe compare for `===`, drops the single-use claim,
 * or reintroduces a `|| true` audit bypass, the corresponding test goes red.
 *
 * No live payments, refunds or emails are touched. Only files are read.
 */

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("FINAL GO wiring: payment verify route", () => {
  const src = read("app/api/store/payment/verify/route.ts");

  it("guards the handshake with an HMAC-SHA256 built from the configured secret", () => {
    expect(src).toMatch(/createHmac\(\s*["']sha256["']\s*,\s*secret\s*\)/);
    expect(src).toMatch(/process\.env\.RAZORPAY_KEY_SECRET/);
  });

  it("compares the signature in constant time with a length check", () => {
    expect(src).toMatch(/timingSafeEqual/);
    expect(src).toMatch(/a\.length === b\.length && crypto\.timingSafeEqual\(a, b\)/);
    // A plain string comparison is the weakening this guard replaced.
    expect(src).not.toMatch(/expected\s*===\s*signature/);
  });

  it("fails closed when the payment secret is not configured", () => {
    expect(src).toMatch(/if \(!secret\)/);
    expect(src).toMatch(/status: 503/);
  });

  it("actually calls the signature guard in POST and reports signature_valid — never paid", () => {
    expect(src).toMatch(/verifySignature\(\s*razorpay_order_id/);
    expect(src).toMatch(/signature_valid:\s*true/);
    expect(src).not.toMatch(/\bpaid\s*:\s*true\b/);
  });
});

describe("FINAL GO wiring: checkout completion", () => {
  const src = read("app/api/store/checkout/complete/route.ts");

  it("imports the single-use claim guard from payment-guard", () => {
    expect(src).toMatch(
      /import\s*\{[^}]*claimPayment[^}]*\}\s*from\s*["']@\/lib\/payment-guard["']/
    );
    expect(src).toMatch(/releasePaymentClaim/);
  });

  it("requires signature + order id unconditionally, and compares in constant time", () => {
    expect(src).toMatch(
      /if \(!cart_id \|\| !paymentId \|\| !razorpay_order_id \|\| !razorpay_signature\)/
    );
    // The old "only check when the client sent them" hole must stay closed.
    expect(src).not.toMatch(/if \(razorpay_order_id && razorpay_signature\)/);
    expect(src).toMatch(
      /verifySignature\(razorpay_order_id, paymentId, razorpay_signature\)/
    );
    expect(src).toMatch(/timingSafeEqual/);
  });

  it("accepts only a captured payment tied to this checkout with a matching amount", () => {
    expect(src).toMatch(/payment\.status !== "captured"/);
    // "authorized" must not be treated as money in the account.
    expect(src).not.toMatch(/\[\s*["']captured["']\s*,\s*["']authorized["']\s*\]/);
    expect(src).toMatch(/!payment\.order_id \|\| payment\.order_id !== razorpay_order_id/);
    expect(src).toMatch(/Number\(payment\.amount\) < Number\(cart\.total/);
  });

  it("claims the payment once before completing the order and releases it on failure", () => {
    expect(src).toMatch(/const claimed = await claimPayment\(/);
    expect(src).toMatch(/if \(!claimed\)/);
    expect(src).toMatch(/payment_already_used/);
    // The single-use claim must be taken before the order is created.
    expect(src.indexOf("claimPayment(")).toBeGreaterThan(-1);
    expect(src.indexOf("claimPayment(")).toBeLessThan(src.indexOf("completeOrder("));
    // ...and freed if completion throws, so a genuine retry is possible.
    expect(src).toMatch(/releasePaymentClaim\(paymentId\)/);
    expect(src.indexOf("releasePaymentClaim(paymentId)")).toBeGreaterThan(
      src.indexOf("completeOrder(cart_id)")
    );
  });
});

describe("FINAL GO wiring: Shiprocket webhook", () => {
  const src = read("app/api/webhooks/shiprocket/route.ts");

  it("fails closed when the shared webhook token is unset", () => {
    expect(src).toMatch(/process\.env\.SHIPROCKET_WEBHOOK_TOKEN/);
    expect(src).toMatch(/if \(!expected\)/);
    expect(src).toMatch(/status: 503/);
  });

  it("verifies the token with the timing-safe helper before trusting the body", () => {
    expect(src).toMatch(/webhookTokenMatches\(candidate, expected\)/);
    expect(src).toMatch(/status: 401/);
    const tokenCheck = src.indexOf("webhookTokenMatches(");
    const bodyParse = src.indexOf("req.json()");
    expect(tokenCheck).toBeGreaterThan(-1);
    expect(tokenCheck).toBeLessThan(bodyParse);
  });

  it("the token helper compares in constant time (no early byte exit)", () => {
    const helper = read("lib/shipping/status-sync.ts");
    expect(helper).toMatch(/diff \|= a\.charCodeAt\(i\) \^ b\.charCodeAt\(i\)/);
    expect(helper).toMatch(/a\.length !== b\.length/);
    expect(helper).toMatch(/return diff === 0/);
    expect(helper).not.toMatch(/candidate\s*===\s*expected/);
  });
});

describe("FINAL GO wiring: provider event dedupe", () => {
  const events = read("lib/payments/events.ts");

  it("records each provider event once via an atomic UNIQUE-constraint insert", () => {
    expect(events).toMatch(/INSERT INTO payment_event/);
    expect(events).toMatch(/ON CONFLICT \(provider, provider_event_id\) DO NOTHING/);
    // Callers gate side effects on this flag; removing it silently disables dedupe.
    expect(events).toMatch(/isNew/);
  });

  it("exposes a constant-time webhook signature verifier that fails closed", () => {
    expect(events).toMatch(/timingSafeEqual\(expectedBuffer, presentedBuffer\)/);
    expect(events).toMatch(/if \(!secret \|\| !secret\.trim\(\)\) return false/);
  });

  it("the schema backs dedupe with a UNIQUE (provider, provider_event_id) constraint", () => {
    const sql = read("db/migrations/004_payment_reconciliation.sql");
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS payment_event/);
    expect(sql).toMatch(/UNIQUE\s*\([^)]*provider[^)]*provider_event_id[^)]*\)/);
  });
});

describe("FINAL GO wiring: no client-declared paid status is trusted", () => {
  it("completion derives payment truth from the provider, not from the request body", () => {
    const src = read("app/api/store/checkout/complete/route.ts");
    expect(src).not.toMatch(/body\.(paid|payment_status|paymentStatus)/);
    expect(src).not.toMatch(/body\[["'](paid|payment_status|paymentStatus)["']\]/);
    expect(src).toMatch(/const payment = await paymentRes\.json\(\)/);
    expect(src).toMatch(/payment\.status !== "captured"/);
  });

  it("the verify route never emits a paid flag", () => {
    const src = read("app/api/store/payment/verify/route.ts");
    expect(src).not.toMatch(/\bpaid\s*:/);
    expect(src).toMatch(/signature_valid/);
  });
});

describe("FINAL GO wiring: CI dependency audit is not bypassed", () => {
  // A64 owns the CI workflow fix; read whatever is currently on disk rather than
  // assuming it has landed. Comments that merely warn about `|| true` are fine;
  // it is the executed `run:` commands that must never swallow an advisory.
  const ci = read("../../.github/workflows/ci.yml");
  const commands = ci
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => !line.startsWith("#"));
  const auditCommands = commands.filter((line) => /\baudit\b/i.test(line));

  it("has an audit step that runs a real command, with no `|| true`/`|| :` swallow", () => {
    expect(auditCommands.length).toBeGreaterThan(0);
    expect(
      auditCommands.some((line) =>
        /^run:\s*(pnpm audit|node .*audit-deps\.mjs)/.test(line)
      )
    ).toBe(true);
    for (const line of auditCommands) {
      expect(line).not.toMatch(/\|\|\s*(true|:)\b/);
    }
  });

  it("the audit gate script fails closed on unexcepted advisories", () => {
    const script = read("scripts/audit-deps.mjs");
    // The header doc comment explains why `|| true` is forbidden; only judge
    // the executable lines, where such a pattern would be a real bypass.
    const code = script
      .split("\n")
      .filter((line) => {
        const trimmed = line.trim();
        return (
          trimmed &&
          !trimmed.startsWith("*") &&
          !trimmed.startsWith("//") &&
          !trimmed.startsWith("/*") &&
          !trimmed.startsWith("#!")
        );
      })
      .join("\n");
    expect(code).toMatch(/process\.exit\(1\)/);
    expect(code).toMatch(/AUDIT_LEVEL/);
    // No "always succeed" escape hatch may be hiding inside the invoked script.
    expect(code).not.toMatch(/process\.exit\(0\)/);
    expect(code).not.toMatch(/\|\|\s*true/);
  });
});
