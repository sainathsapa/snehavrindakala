import { afterEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * `/api/store/payment/verify` answers one question — did Razorpay sign this
 * handshake — and its response used to say `paid: true` while writing nothing at
 * all. Two endpoints both claiming to decide whether money arrived is how a shop
 * ends up trusting the wrong one, so the field is now `signature_valid` and the
 * response says what it did not do.
 */

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const SECRET = "test_secret_key";

function sign(orderId: string, paymentId: string, secret = SECRET) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
}

async function call(body: unknown): Promise<{ status: number; json: any }> {
  const { POST } = await import("../app/api/store/payment/verify/route");
  const response = await POST(
    new Request("http://localhost/api/store/payment/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
  return { status: response.status, json: await response.json() };
}

afterEach(() => {
  delete process.env.RAZORPAY_KEY_SECRET;
});

describe("payment verify", () => {
  it("accepts a signature Razorpay would have produced", async () => {
    process.env.RAZORPAY_KEY_SECRET = SECRET;
    const result = await call({
      razorpay_order_id: "order_ABC",
      razorpay_payment_id: "pay_XYZ",
      razorpay_signature: sign("order_ABC", "pay_XYZ"),
    });
    expect(result.status).toBe(200);
    expect(result.json.signature_valid).toBe(true);
    // The honest part: it never claims the payment was recorded.
    expect(result.json).not.toHaveProperty("paid");
    expect(result.json.note).toMatch(/order is created by/i);
  });

  it("refuses a forged signature", async () => {
    process.env.RAZORPAY_KEY_SECRET = SECRET;
    const result = await call({
      razorpay_order_id: "order_ABC",
      razorpay_payment_id: "pay_XYZ",
      razorpay_signature: sign("order_ABC", "pay_XYZ", "someone_elses_secret"),
    });
    expect(result.status).toBe(400);
    expect(result.json.signature_valid).toBe(false);
  });

  it("refuses a signature for a different payment", async () => {
    process.env.RAZORPAY_KEY_SECRET = SECRET;
    const result = await call({
      razorpay_order_id: "order_ABC",
      razorpay_payment_id: "pay_OTHER",
      razorpay_signature: sign("order_ABC", "pay_XYZ"),
    });
    expect(result.status).toBe(400);
  });

  it("says the shop is unconfigured rather than blaming the buyer", async () => {
    delete process.env.RAZORPAY_KEY_SECRET;
    const result = await call({
      razorpay_order_id: "order_ABC",
      razorpay_payment_id: "pay_XYZ",
      razorpay_signature: sign("order_ABC", "pay_XYZ"),
    });
    expect(result.status).toBe(503);
    expect(result.json.error).toMatch(/not configured/i);
  });

  it("requires all three parameters", async () => {
    process.env.RAZORPAY_KEY_SECRET = SECRET;
    const result = await call({ razorpay_order_id: "order_ABC" });
    expect(result.status).toBe(400);
  });

  it("compares in constant time, like the completion route", () => {
    const source = read("app/api/store/payment/verify/route.ts");
    expect(source).toMatch(/timingSafeEqual/);
    expect(source).not.toMatch(/generatedSignature !==/);
  });

  it("the pay button reads the field the route actually returns", () => {
    const client = read("components/razorpay-checkout.tsx");
    expect(client).toMatch(/signature_valid/);
    expect(client).not.toMatch(/verifyBody\.paid/);
  });
});