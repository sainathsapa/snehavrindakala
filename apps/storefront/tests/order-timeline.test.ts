import { describe, expect, it } from "vitest";
import { buildBuyerTimeline } from "../lib/order-timeline";

const base = {
  createdAt: "2026-11-25T18:20:00.000Z",
  paymentStatus: "captured",
  status: "pending",
};

describe("buyer order timeline", () => {
  it("starts with the order and the payment", () => {
    const steps = buildBuyerTimeline(base);
    expect(steps.map((s) => s.title)).toEqual(["Order placed", "Payment confirmed"]);
    expect(steps.every((s) => s.source === "studio")).toBe(true);
  });

  it("marks exactly one step as current so the eye lands somewhere", () => {
    const steps = buildBuyerTimeline(base);
    expect(steps.filter((s) => s.state === "current")).toHaveLength(1);
  });

  it("does not claim a payment that is still pending", () => {
    const steps = buildBuyerTimeline({ ...base, paymentStatus: "awaiting" });
    expect(steps.some((s) => s.title === "Payment confirmed")).toBe(false);
  });

  it("puts the courier's scans on the same thread, sourced as the courier", () => {
    const steps = buildBuyerTimeline({
      ...base,
      shipment: { status: "awb_assigned", trackingNumber: "AWB123", courier: "Xpressbees" },
      live: {
        awb: "AWB123",
        courier: "Xpressbees",
        status: "In Transit",
        edd: "30 Nov 2026",
        scans: [
          { at: "2026-11-27 09:10:00", activity: "Picked up", location: "Jaipur" },
          { at: "2026-11-28 14:00:00", activity: "In transit", location: "Ajmer" },
        ],
        fetchedAt: "2026-11-28T15:00:00.000Z",
      },
    });

    const courierSteps = steps.filter((s) => s.source === "courier");
    expect(courierSteps.map((s) => s.title)).toContain("Picked up");
    expect(courierSteps.map((s) => s.title)).toContain("In transit");
    // Newest scan last on the page, and the expected date is still upcoming.
    const edd = steps.find((s) => s.title === "Expected to arrive");
    expect(edd?.state).toBe("upcoming");
  });

  it("says it is waiting for a scan rather than pretending nothing happened", () => {
    const steps = buildBuyerTimeline({
      ...base,
      shipment: { status: "awb_assigned", trackingNumber: "AWB123" },
      live: null,
    });
    expect(steps.some((s) => s.title === "Waiting for the courier's first scan")).toBe(true);
  });

  it("survives an order with no dates at all", () => {
    const steps = buildBuyerTimeline({ paymentStatus: "captured" });
    expect(steps.map((s) => s.title)).toEqual(["Payment confirmed"]);
  });
});
