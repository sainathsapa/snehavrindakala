/**
 * Transactional email tests.
 *
 * These cover the parts that silently broke before: an unknown template, a
 * missing recipient, an unconfigured transport, and the payload for an order
 * confirmation (which used to arrive with no items and no address).
 */

import { describe, expect, it, beforeEach } from "vitest";
import {
  formatMoney,
  hasTemplate,
  renderTemplate,
  type TemplateContext,
} from "../src/modules/notification/templates";
import {
  isValidEmail,
  readTransportConfig,
  resetTransport,
  sendEmail,
} from "../src/modules/notification/transport";

const ctx: TemplateContext = {
  storefrontUrl: "https://snehavrinda.in",
  contactEmail: "hello@snehavrinda.in",
  currency: "INR",
};

describe("formatMoney", () => {
  it("formats minor units as INR", () => {
    expect(formatMoney(125000)).toBe("₹1,250");
  });

  it("does not crash on a missing or non-numeric amount", () => {
    expect(formatMoney(undefined)).toBe("—");
    expect(formatMoney("not a number")).toBe("—");
  });
});

describe("renderTemplate", () => {
  it("renders an order confirmation with items, total and address", () => {
    const email = renderTemplate("order_confirmation", ctx, {
      order: {
        display_id: 1042,
        currency_code: "inr",
        total: 125000,
        email: "asha@example.com",
        items: [
          { title: "Madhubani Celebration", quantity: 2, total: 100000 },
          { title: "Warli Panel", quantity: 1, total: 25000 },
        ],
        shipping_address: {
          first_name: "Asha",
          last_name: "Rao",
          address_1: "12 Temple Road",
          city: "Bengaluru",
          province: "Karnataka",
          postal_code: "560001",
        },
      },
    });

    expect(email.subject).toContain("1042");
    expect(email.html).toContain("Madhubani Celebration");
    expect(email.html).toContain("Warli Panel");
    expect(email.html).toContain("Temple Road");
    expect(email.text).toContain("₹1,250");
    expect(email.text).toContain("Madhubani Celebration");
  });

  it("omits the address block when no address was supplied", () => {
    const email = renderTemplate("order_confirmation", ctx, {
      order: { display_id: 7, items: [], total: 0 },
    });
    expect(email.html).not.toContain("Delivering to");
    expect(email.text).not.toContain("Delivering to");
  });

  it("escapes HTML in user-supplied content", () => {
    const email = renderTemplate("order_confirmation", ctx, {
      order: {
        display_id: 1,
        items: [{ title: '<script>alert("x")</script>', quantity: 1, total: 100 }],
      },
    });
    expect(email.html).not.toContain("<script>alert");
    expect(email.html).toContain("&lt;script&gt;");
  });

  it("links a commission acknowledgement to its reference", () => {
    const email = renderTemplate("commission_request_received", ctx, {
      reference_id: "SVK-2026-0007",
    });
    expect(email.subject).toContain("SVK-2026-0007");
    expect(email.html).toContain(
      "https://snehavrinda.in/commission-status/SVK-2026-0007"
    );
  });

  it("renders a tracking link for a shipment", () => {
    const email = renderTemplate("shipment_confirmed", ctx, {
      tracking_number: "AWB12345",
      courier_name: "Bluedart",
    });
    expect(email.html).toContain("Bluedart");
    expect(email.html).toContain("https://shiprocket.co/tracking/AWB12345");
    expect(email.text).toContain("AWB12345");
  });

  it("falls back rather than throwing on an unknown template", () => {
    // A missing template must never drop a customer notification silently.
    const email = renderTemplate("some_future_template", ctx, {});
    expect(email.subject).toContain("some future template");
    expect(email.html).toContain("hello@snehavrinda.in");
    expect(email.text.length).toBeGreaterThan(0);
  });

  it("knows which templates are registered", () => {
    expect(hasTemplate("order_confirmation")).toBe(true);
    expect(hasTemplate("no_such_template")).toBe(false);
  });
});

describe("transport configuration", () => {
  beforeEach(() => resetTransport());

  it("is unconfigured when FROM_EMAIL is missing", () => {
    expect(readTransportConfig({} as any)).toBeNull();
  });

  it("rejects a malformed FROM_EMAIL", () => {
    expect(readTransportConfig({ FROM_EMAIL: "not-an-email" } as any)).toBeNull();
  });

  it("reads region and sender when configured", () => {
    const config = readTransportConfig({
      FROM_EMAIL: "orders@snehavrinda.in",
      AWS_SES_REGION: "ap-south-1",
      FROM_NAME: "SnehaVrinda Kala",
    } as any);
    expect(config).toMatchObject({
      fromEmail: "orders@snehavrinda.in",
      region: "ap-south-1",
    });
  });
});

describe("sendEmail", () => {
  beforeEach(() => resetTransport());

  it("skips instead of failing when no transport is configured", async () => {
    // Development must not look like an outage: this returns "skipped".
    const outcome = await sendEmail(
      { to: "a@b.co", subject: "hi", html: "<p>hi</p>", text: "hi" },
      { FROM_EMAIL: "orders@snehavrinda.in" } as any
    );
    expect(outcome).toBe("skipped");
  });

  it("throws on an invalid recipient when a transport is configured", async () => {
    await expect(
      sendEmail(
        { to: "nope", subject: "hi", html: "<p>hi</p>", text: "hi" },
        {
          FROM_EMAIL: "orders@snehavrinda.in",
          AWS_SES_ACCESS_KEY_ID: "key",
          AWS_SES_SECRET_ACCESS_KEY: "secret",
        } as any
      )
    ).rejects.toThrow(/Invalid recipient/);
  });
});

describe("isValidEmail", () => {
  it("accepts normal addresses and rejects junk", () => {
    expect(isValidEmail("asha@example.com")).toBe(true);
    expect(isValidEmail("a.b+c@sub.example.co.in")).toBe(true);
    expect(isValidEmail("asha@")).toBe(false);
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("asha example.com")).toBe(false);
  });
});
