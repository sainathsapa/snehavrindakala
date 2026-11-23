import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  extractShipmentUpdate,
  mapShiprocketStatus,
  webhookTokenMatches,
} from "../lib/shipping/status-sync";

const root = join(__dirname, "..");

describe("Shiprocket status mapping", () => {
  it("maps the full delivery lifecycle", () => {
    expect(mapShiprocketStatus("Pending")).toBe("processing");
    expect(mapShiprocketStatus("Picked Up")).toBe("shipped");
    expect(mapShiprocketStatus("In Transit")).toBe("in_transit");
    expect(mapShiprocketStatus("Out for Delivery")).toBe("out_for_delivery");
    expect(mapShiprocketStatus("Delivered")).toBe("delivered");
    expect(mapShiprocketStatus("RTO")).toBe("returned");
  });

  it("normalises casing, whitespace and separators", () => {
    expect(mapShiprocketStatus("  in-transit ")).toBe("in_transit");
    expect(mapShiprocketStatus("OUT FOR DELIVERY")).toBe("out_for_delivery");
  });

  it("rejects unknown statuses instead of guessing", () => {
    expect(mapShiprocketStatus("something new")).toBeNull();
    expect(mapShiprocketStatus(undefined)).toBeNull();
  });
});

describe("webhook token verification", () => {
  it("requires both values and rejects a wrong token", () => {
    expect(webhookTokenMatches("abc", undefined)).toBe(false);
    expect(webhookTokenMatches(undefined, "abc")).toBe(false);
    expect(webhookTokenMatches("abc", "abd")).toBe(false);
    expect(webhookTokenMatches("abc", "abc")).toBe(true);
  });
});

describe("payload extraction", () => {
  it("reads status, AWB and courier from a nested payload", () => {
    const update = extractShipmentUpdate({
      payload: { order_id: "ord_1", awb_code: "AWB123", courier_name: "X", current_status: "Delivered" },
    });
    expect(update).toMatchObject({
      orderId: "ord_1",
      awb: "AWB123",
      courier: "X",
      status: "delivered",
    });
  });
});

describe("route guards", () => {
  const src = readFileSync(
    join(root, "app/api/webhooks/shiprocket/route.ts"),
    "utf8"
  );
  it("fails closed with no token and verifies before trusting the body", () => {
    expect(src).toMatch(/if \(!expected\)/);
    expect(src).toMatch(/status: 503/);
    expect(src).toMatch(/webhookTokenMatches\(candidate, expected\)/);
    expect(src.indexOf("webhookTokenMatches(")).toBeLessThan(src.indexOf("req.json()"));
    expect(src).toMatch(/saveOrderShipment\(/);
  });
});
