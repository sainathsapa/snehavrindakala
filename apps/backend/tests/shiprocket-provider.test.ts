/**
 * Tests for the Medusa v2 Shiprocket fulfilment provider.
 *
 * `fetch` is stubbed so the whole order→AWB→label path is exercised without a
 * network. The important behaviours are that a missing AWB does not lose the
 * shipment, that cancelling something never sent is a no-op, and that the v2
 * method names/return shapes are the ones Medusa actually calls.
 */

import { ShiprocketFulfilmentProvider } from "../src/providers/fulfilment/shiprocket/shiprocket.provider";

const OPTIONS = {
  api_token: "sr_token",
  pickup_location: "Primary",
  webhook_token: "hook_secret",
};

function provider() {
  return new ShiprocketFulfilmentProvider({}, OPTIONS);
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

const items = [
  { title: "Madhubani Celebration", sku: "MAD-1", quantity: 1, unit_price: 18000 },
];
const order = {
  id: "order_1",
  email: "buyer@example.com",
  shipping_address: {
    first_name: "Asha",
    last_name: "Rao",
    address_1: "12 Temple Street",
    city: "Bengaluru",
    province: "Karnataka",
    postal_code: "560001",
    phone: "9999999999",
  },
};

describe("shipping options", () => {
  it("offers a standard and a priority service", async () => {
    const options = await provider().getFulfillmentOptions();
    expect(options.map((o: any) => o.id)).toEqual([
      "shiprocket-standard",
      "shiprocket-express",
    ]);
  });

  it("never claims to calculate prices it cannot quote", async () => {
    expect(await provider().canCalculate({} as any)).toBe(false);
  });

  it("stores the chosen service without a network call", async () => {
    const calls = stubFetch(() => ({ body: {} }));
    const data = await provider().validateFulfillmentData(
      { service: "express" },
      { shipping_option: "x" },
      {} as any
    );
    expect(data.shiprocket.service).toBe("express");
    expect(calls).toHaveLength(0);
  });
});

describe("createFulfillment", () => {
  it("creates the ad-hoc order and assigns an AWB", async () => {
    const calls = stubFetch((call) => {
      if (call.url.endsWith("/orders/create/adhoc")) {
        return {
          body: { order_id: 111, shipment_id: 222, status: "NEW" },
        };
      }
      if (call.url.endsWith("/courier/assign/awb")) {
        return {
          body: { awb_code: "AWB123", courier_name: "Delhivery" },
        };
      }
      return { body: {} };
    });

    const result = await provider().createFulfillment(
      { shiprocket: { service: "standard" } },
      items,
      order,
      { id: "ful_1" }
    );

    expect(calls[0].url).toContain("/orders/create/adhoc");
    expect(calls[0].body.order_id).toBe("medusa_order_1");
    expect(calls[0].body.billing_city).toBe("Bengaluru");
    expect(calls[0].body.order_items[0].selling_price).toBe(18000);
    expect(calls[0].body.order_items[0].hsn).toBe(9701);
    expect(calls[1].url).toContain("/courier/assign/awb");
    expect(calls[1].body.shipment_id).toBe(222);

    expect(result.data).toMatchObject({
      shiprocket_order_id: 111,
      shiprocket_shipment_id: 222,
      awb_code: "AWB123",
      courier_name: "Delhivery",
      service: "standard",
    });
    expect(result.labels[0].tracking_number).toBe("AWB123");
    expect(result.labels[0].tracking_url).toContain("AWB123");
  });

  it("keeps the shipment when the courier cannot be assigned", async () => {
    stubFetch((call) => {
      if (call.url.endsWith("/orders/create/adhoc")) {
        return { body: { order_id: 111, shipment_id: 222, status: "NEW" } };
      }
      return { status: 500, text: "courier unavailable" };
    });

    const result = await provider().createFulfillment(
      {},
      items,
      order,
      { id: "ful_1" }
    );

    // The order exists in Shiprocket; only the AWB is missing.
    expect(result.data.shiprocket_shipment_id).toBe(222);
    expect(result.data.awb_code).toBeNull();
    expect(result.labels[0].tracking_number).toBe("");
  });

  it("does not resend the money as a string", async () => {
    const calls = stubFetch(() => ({
      body: { order_id: 1, shipment_id: 2, awb_code: "A" },
    }));
    await provider().createFulfillment({}, [], order, { id: "f" });
    expect(typeof calls[0].body.sub_total).toBe("number");
    expect(calls[0].body.payment_method).toBe("Prepaid");
  });
});

describe("cancelFulfillment", () => {
  it("is a no-op when nothing was sent to Shiprocket", async () => {
    const calls = stubFetch(() => ({ body: {} }));
    const result = await provider().cancelFulfillment({ status: "pending" });
    expect(result.canceled).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("cancels the real Shiprocket order when one exists", async () => {
    const calls = stubFetch(() => ({ body: { status: "CANCELED" } }));
    const result = await provider().cancelFulfillment({
      shiprocket: { shiprocket_order_id: 111 },
    });
    expect(calls[0].url).toContain("/orders/cancel/111");
    expect(result.canceled).toBe(true);
  });
});

describe("authentication", () => {
  it("logs in when only email and password are configured, and caches the token", async () => {
    const calls = stubFetch(() => ({ body: { token: "fresh" } }));
    const p = new ShiprocketFulfilmentProvider(
      {},
      { email: "a@b.c", password: "pw", pickup_location: "Primary" }
    );

    await p.authenticate();
    await p.authenticate();

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/auth/login");
    expect(calls[0].body).toEqual({ email: "a@b.c", password: "pw" });
  });

  it("re-authenticates once after a 401", async () => {
    let attempt = 0;
    const calls = stubFetch((call) => {
      if (call.url.includes("/auth/login")) return { body: { token: "t" } };
      attempt += 1;
      return attempt === 1
        ? { status: 401, text: "expired" }
        : { body: { ok: true } };
    });

    const p = new ShiprocketFulfilmentProvider(
      {},
      { email: "a@b.c", password: "pw" }
    );
    const result = await p.quote({
      pickup_postcode: "560001",
      delivery_postcode: "110001",
      weight: 0.5,
      cod: false,
    });

    expect(result).toEqual({ ok: true });
    expect(calls.filter((c) => c.url.includes("/auth/login"))).toHaveLength(2);
  });
});

describe("webhook token", () => {
  it("accepts the configured token and rejects anything else", () => {
    expect(provider().verifyWebhookToken("hook_secret")).toBe(true);
    expect(provider().verifyWebhookToken("wrong")).toBe(false);
    expect(provider().verifyWebhookToken(undefined)).toBe(false);
  });

  it("rejects every callback when no token is configured", () => {
    const p = new ShiprocketFulfilmentProvider({}, { api_token: "x" });
    expect(p.verifyWebhookToken("anything")).toBe(false);
  });
});
