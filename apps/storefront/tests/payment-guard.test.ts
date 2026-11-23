import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const queryMock = vi.fn();
vi.mock("../lib/db", () => ({ query: (...args: unknown[]) => queryMock(...args) }));

import { claimPayment, paymentAlreadyProcessed, releasePaymentClaim } from "../lib/payment-guard";

beforeEach(() => queryMock.mockReset());

describe("single-use payment claims", () => {
  it("claims a fresh payment", async () => {
    queryMock.mockResolvedValueOnce([{ payment_id: "pay_1" }]);
    expect(
      await claimPayment({ paymentId: "pay_1", cartId: "cart_1", razorpayOrderId: "order_1" })
    ).toBe(true);
    expect(queryMock.mock.calls[0][0]).toMatch(/ON CONFLICT \(payment_id\) DO NOTHING/);
  });

  it("refuses a replayed payment", async () => {
    queryMock.mockResolvedValueOnce([]); // ON CONFLICT DO NOTHING returned no row
    expect(
      await claimPayment({ paymentId: "pay_1", cartId: "cart_2", razorpayOrderId: "order_2" })
    ).toBe(false);
  });

  it("releases and checks claims", async () => {
    queryMock.mockResolvedValueOnce([]);
    await releasePaymentClaim("pay_1");
    expect(queryMock.mock.calls[0][0]).toMatch(/DELETE FROM processed_payments/);
    queryMock.mockResolvedValueOnce([{ payment_id: "pay_1" }]);
    expect(await paymentAlreadyProcessed("pay_1")).toBe(true);
  });
});

describe("checkout completion cannot be tricked", () => {
  const root = join(__dirname, "..");
  const src = readFileSync(
    join(root, "app/api/store/checkout/complete/route.ts"),
    "utf8"
  );

  it("requires signature + order id unconditionally", () => {
    expect(src).toMatch(/if \(!cart_id \|\| !paymentId \|\| !razorpay_order_id \|\| !razorpay_signature\)/);
    expect(src).not.toMatch(/if \(razorpay_order_id && razorpay_signature\)/);
  });

  it("accepts only captured payments", () => {
    expect(src).toMatch(/payment\.status !== "captured"/);
    expect(src).not.toMatch(/\["captured", "authorized"\]/);
  });

  it("checks Razorpay's order id and claims the payment before completing", () => {
    expect(src).toMatch(/!payment\.order_id \|\| payment\.order_id !== razorpay_order_id/);
    expect(src.indexOf("claimPayment(")).toBeLessThan(src.indexOf("completeOrder("));
    expect(src).toMatch(/releasePaymentClaim\(paymentId\)/);
  });

  it("schema has the single-use table", () => {
    const sql = readFileSync(join(root, "db/schema.sql"), "utf8");
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS processed_payments/);
    expect(sql).toMatch(/PRIMARY KEY \(payment_id\)/);
  });
});
