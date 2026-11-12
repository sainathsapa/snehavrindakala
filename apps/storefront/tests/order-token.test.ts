/**
 * Order access token tests.
 *
 * The token is the only thing standing between "guest paid" and "guest can see
 * the order", so it must be unforgeable, scoped to one order, and expiring.
 */

import { describe, expect, it, beforeAll } from "vitest";
import { issueOrderToken, verifyOrderToken } from "../lib/order-token";

beforeAll(() => {
  process.env.COOKIE_SECRET = "test-secret-for-order-tokens";
});

describe("order tokens", () => {
  it("accepts a token issued for that order", () => {
    const token = issueOrderToken("order_123");
    expect(verifyOrderToken(token, "order_123")).toBe(true);
  });

  it("rejects a token used against a different order", () => {
    // The whole point: holding one order's link must not unlock another's.
    const token = issueOrderToken("order_123");
    expect(verifyOrderToken(token, "order_456")).toBe(false);
  });

  it("rejects a missing token", () => {
    expect(verifyOrderToken(undefined, "order_123")).toBe(false);
    expect(verifyOrderToken(null, "order_123")).toBe(false);
    expect(verifyOrderToken("", "order_123")).toBe(false);
  });

  it("rejects an expired token", () => {
    const token = issueOrderToken("order_123", -10);
    expect(verifyOrderToken(token, "order_123")).toBe(false);
  });

  it("rejects a tampered payload", () => {
    const token = issueOrderToken("order_123");
    const [, signature] = token.split(".");
    const forgedBody = Buffer.from(
      JSON.stringify({ o: "order_999", exp: Math.floor(Date.now() / 1000) + 600 })
    ).toString("base64url");
    expect(verifyOrderToken(`${forgedBody}.${signature}`, "order_999")).toBe(
      false
    );
  });

  it("rejects a garbage token without throwing", () => {
    expect(verifyOrderToken("not-a-token", "order_123")).toBe(false);
    expect(verifyOrderToken("a.b", "order_123")).toBe(false);
  });

  it("rejects a token signed with a different secret", () => {
    const token = issueOrderToken("order_123");
    process.env.COOKIE_SECRET = "a-different-secret";
    expect(verifyOrderToken(token, "order_123")).toBe(false);
    process.env.COOKIE_SECRET = "test-secret-for-order-tokens";
  });
});
