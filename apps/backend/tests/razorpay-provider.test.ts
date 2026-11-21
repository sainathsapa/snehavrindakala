/**
 * Tests for the Medusa v2 Razorpay provider.
 *
 * The provider talks to Razorpay over `fetch`, so a stubbed `fetch` is enough
 * to exercise the whole lifecycle without a network or a database. The cases
 * that matter are the ones the v1 adapter got wrong or never had: the v2 method
 * names, the rupee/paise conversion, and the rule that a payment is only
 * reported as captured when Razorpay's own API says so.
 */

import { createHmac } from "crypto";
import {
  RazorpayPaymentProvider,
  toMinorUnits,
  fromMinorUnits,
  currencyMultiplier,
} from "../src/providers/payment/razorpay/razorpay.provider";

const KEY_ID = "rzp_test_key";
const KEY_SECRET = "rzp_test_secret";
const WEBHOOK_SECRET = "whsec_test";

function provider() {
  return new RazorpayPaymentProvider(
    { logger: { warn() {}, error() {} } },
    { key_id: KEY_ID, key_secret: KEY_SECRET, webhook_secret: WEBHOOK_SECRET }
  );
}

type Call = { url: string; method: string; body: any };

function stubFetch(
  handler: (call: Call) => { status?: number; body?: any; text?: string }
) {
  const calls: Call[] = [];
  (globalThis as any).fetch = async (url: string, init: any = {}) => {
    const call: Call = {
      url,
      method: init.method || "GET",
      body: init.body ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    const result = handler(call);
    const status = result.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      async json() {
        return result.body;
      },
      async text() {
        return result.text ?? JSON.stringify(result.body ?? {});
      },
    };
  };
  return calls;
}

afterEach(() => {
  delete (globalThis as any).fetch;
});

describe("currency conversion", () => {
  it("treats the rupee as two decimals", () => {
    expect(currencyMultiplier("INR")).toBe(100);
    expect(toMinorUnits(1250.5, "inr")).toBe(125050);
    expect(fromMinorUnits(125050, "INR")).toBe(1250.5);
  });

  it("does not invent decimals for a zero-decimal currency", () => {
    expect(currencyMultiplier("JPY")).toBe(1);
    expect(toMinorUnits(1250, "JPY")).toBe(1250);
  });

  it("rounds three-decimal currencies to the nearest ten, as the gateway requires", () => {
    expect(toMinorUnits(1.234, "KWD")).toBe(1240);
  });
});

describe("initiatePayment", () => {
  it("creates a Razorpay order and returns its id as the session id", async () => {
    const calls = stubFetch(() => ({
      body: {
        id: "order_ABC",
        amount: 125050,
        currency: "INR",
        status: "created",
      },
    }));

    const result = await provider().initiatePayment({
      amount: 1250.5,
      currency_code: "inr",
      data: { metadata: { medusa_cart_id: "cart_1" } },
      context: { idempotency_key: "idem_1" } as any,
    });

    expect(result.id).toBe("order_ABC");
    expect(result.data?.razorpay_order_id).toBe("order_ABC");

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.razorpay.com/v1/orders");
    expect(calls[0].body.amount).toBe(125050);
    expect(calls[0].body.currency).toBe("INR");
    expect(calls[0].body.notes.medusa_cart_id).toBe("cart_1");
    expect(calls[0].body.notes.idempotency_key).toBe("idem_1");
  });

  it("never puts the key secret in the payload", async () => {
    const calls = stubFetch(() => ({
      body: { id: "order_X", amount: 100, currency: "INR", status: "created" },
    }));

    await provider().initiatePayment({
      amount: 1,
      currency_code: "inr",
      data: {},
    });

    expect(JSON.stringify(calls[0].body)).not.toContain(KEY_SECRET);
  });
});

describe("authorizePayment", () => {
  it("reports captured only when Razorpay says the money is captured", async () => {
    stubFetch((call) => {
      if (call.url.endsWith("/payments")) {
        return {
          body: {
            items: [
              {
                id: "pay_1",
                order_id: "order_1",
                amount: 125050,
                currency: "INR",
                status: "captured",
              },
            ],
          },
        };
      }
      return {
        body: {
          id: "order_1",
          amount: 125050,
          currency: "INR",
          status: "paid",
        },
      };
    });

    const result = await provider().authorizePayment({
      data: { razorpay_order_id: "order_1" },
    });

    expect(result.status).toBe("captured");
    expect(result.data?.razorpay_payment_id).toBe("pay_1");
  });

  it("reports authorized when the payment is authorized but not captured", async () => {
    stubFetch((call) => {
      if (call.url.endsWith("/payments")) {
        return {
          body: {
            items: [
              {
                id: "pay_1",
                order_id: "order_1",
                amount: 100,
                currency: "INR",
                status: "authorized",
              },
            ],
          },
        };
      }
      return {
        body: { id: "order_1", amount: 100, currency: "INR", status: "attempted" },
      };
    });

    const result = await provider().authorizePayment({
      data: { razorpay_order_id: "order_1" },
    });
    expect(result.status).toBe("authorized");
  });

  it("does not claim a payment that never happened", async () => {
    stubFetch((call) => {
      if (call.url.endsWith("/payments")) return { body: { items: [] } };
      return {
        body: { id: "order_1", amount: 100, currency: "INR", status: "created" },
      };
    });

    const result = await provider().authorizePayment({
      data: { razorpay_order_id: "order_1" },
    });
    // Unpaid stays unpaid: Medusa will refuse to complete the cart rather than
    // create an order nobody has paid for.
    expect(result.status).toBe("pending");
    expect(result.data?.razorpay_payment_id).toBeNull();
  });

  it("gives up gracefully when there is no order to read", async () => {
    stubFetch(() => ({ status: 500, text: "boom" }));
    const result = await provider().authorizePayment({ data: {} });
    expect(result.status).toBe("pending_authorization");
  });
});

describe("capturePayment", () => {
  it("captures the provider payment, not the order", async () => {
    const calls = stubFetch(() => ({
      body: {
        id: "pay_1",
        order_id: "order_1",
        amount: 125050,
        currency: "INR",
        status: "captured",
      },
    }));

    const result = await provider().capturePayment({
      data: {
        razorpay_order_id: "order_1",
        razorpay_payment_id: "pay_1",
        amount: 125050,
        currency: "INR",
      },
    });

    expect(calls[0].url).toBe("https://api.razorpay.com/v1/payments/pay_1/capture");
    expect(calls[0].body).toEqual({ amount: 125050, currency: "INR" });
    expect(result.data?.payment_status).toBe("captured");
  });

  it("treats an already-captured payment as success", async () => {
    stubFetch(() => ({
      status: 400,
      text: '{"error":{"description":"This payment has already been captured"}}',
    }));

    const result = await provider().capturePayment({
      data: { razorpay_payment_id: "pay_1", currency: "INR", amount: 100 },
    });

    expect(result.data?.razorpay_payment_id).toBe("pay_1");
  });
});

describe("refundPayment", () => {
  it("sends the refund in paise", async () => {
    const calls = stubFetch(() => ({ body: { id: "rfnd_1", status: "processed" } }));

    await provider().refundPayment({
      amount: 250.25,
      data: { razorpay_payment_id: "pay_1", currency: "INR" },
    });

    expect(calls[0].url).toBe("https://api.razorpay.com/v1/payments/pay_1/refund");
    expect(calls[0].body.amount).toBe(25025);
  });

  it("refuses to guess which payment to refund", async () => {
    stubFetch(() => ({ body: {} }));
    await expect(
      provider().refundPayment({ amount: 10, data: {} })
    ).rejects.toThrow(/provider payment id/);
  });
});

describe("getPaymentStatus", () => {
  it("shows a failed payment as an error rather than pending", async () => {
    stubFetch((call) => {
      if (call.url.endsWith("/payments")) {
        return {
          body: {
            items: [
              {
                id: "pay_1",
                order_id: "order_1",
                amount: 100,
                currency: "INR",
                status: "failed",
              },
            ],
          },
        };
      }
      return {
        body: { id: "order_1", amount: 100, currency: "INR", status: "attempted" },
      };
    });

    const result = await provider().getPaymentStatus({
      data: { razorpay_order_id: "order_1" },
    });
    expect(result.status).toBe("error");
  });
});

describe("webhooks", () => {
  const raw = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_1",
          order_id: "order_1",
          amount: 125050,
          currency: "INR",
          notes: { session_id: "payses_1" },
        },
      },
    },
  });

  it("verifies the signature over the raw body", () => {
    const signature = createHmac("sha256", WEBHOOK_SECRET)
      .update(raw)
      .digest("hex");
    expect(provider().verifyWebhookSignature(raw, signature)).toBe(true);
    expect(provider().verifyWebhookSignature(raw, "deadbeef")).toBe(false);
  });

  it("maps a captured payment to the captured action with the amount in major units", async () => {
    const signature = createHmac("sha256", WEBHOOK_SECRET)
      .update(raw)
      .digest("hex");

    const result = await provider().getWebhookActionAndData({
      data: JSON.parse(raw),
      rawData: Buffer.from(raw),
      headers: { "x-razorpay-signature": signature },
    });

    expect(result.action).toBe("captured");
    expect(result.data?.session_id).toBe("payses_1");
    expect(result.data?.amount.numeric).toBe(1250.5);
  });

  it("ignores even a correctly signed event when no secret is configured", async () => {
    // Fail closed. A deployment that never pasted the dashboard secret must not
    // act on webhooks, or the "verification" is a comment.
    const unconfigured = new RazorpayPaymentProvider(
      { logger: { warn() {}, error() {} } },
      { key_id: KEY_ID, key_secret: KEY_SECRET }
    );
    const signature = createHmac("sha256", "").update(raw).digest("hex");

    for (const headers of [
      { "x-razorpay-signature": signature },
      { "x-razorpay-signature": createHmac("sha256", WEBHOOK_SECRET).update(raw).digest("hex") },
      {},
    ]) {
      const result = await unconfigured.getWebhookActionAndData({
        data: JSON.parse(raw),
        rawData: Buffer.from(raw),
        headers: headers as Record<string, string>,
      });
      expect(result.action).toBe("not_supported");
    }
  });

  it("ignores a payload whose signature does not match", async () => {
    const result = await provider().getWebhookActionAndData({
      data: JSON.parse(raw),
      rawData: Buffer.from(raw),
      headers: { "x-razorpay-signature": "deadbeef" },
    });
    expect(result.action).toBe("not_supported");
  });
});
