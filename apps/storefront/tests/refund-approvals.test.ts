import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The refund approval rule is the cheapest control the shop has against a
 * mistake or a compromised account: the person who asks for the money cannot be
 * the person who releases it. These tests pin the rule itself, then check the
 * endpoints call it rather than re-implementing it.
 */

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

/** The database is not involved in these rules, so it is stubbed out. */
vi.mock("@/lib/db", () => ({
  query: vi.fn(async () => []),
  queryResult: vi.fn(async () => ({ rows: [] })),
}));

describe("refundApprovalThreshold", () => {
  beforeEach(() => {
    delete process.env.REFUND_APPROVAL_THRESHOLD;
  });

  it("defaults to ₹5,000, expressed in paise", async () => {
    const { refundApprovalThreshold } = await import("../lib/refund-approvals");
    expect(refundApprovalThreshold()).toBe(500_000);
  });

  it("reads the environment in rupees, because that is what a person types", async () => {
    process.env.REFUND_APPROVAL_THRESHOLD = "12000";
    const { refundApprovalThreshold } = await import("../lib/refund-approvals");
    expect(refundApprovalThreshold()).toBe(1_200_000);
  });

  it("falls back to the default rather than to no checks on nonsense", async () => {
    const { refundApprovalThreshold } = await import("../lib/refund-approvals");
    for (const value of ["abc", "-5", ""]) {
      process.env.REFUND_APPROVAL_THRESHOLD = value;
      expect(refundApprovalThreshold()).toBe(500_000);
    }
  });

  it("treats a zero threshold as 'everything needs two people'", async () => {
    const { refundApprovalThreshold, needsSecondApproval } = await import(
      "../lib/refund-approvals"
    );
    process.env.REFUND_APPROVAL_THRESHOLD = "0";
    const threshold = refundApprovalThreshold();
    expect(threshold).toBe(0);
    // Even a ₹1 refund is a two-person decision when the shop says so.
    expect(needsSecondApproval(100, threshold)).toBe(true);
  });
});

describe("needsSecondApproval", () => {
  it("is false below the threshold and true at or above it", async () => {
    const { needsSecondApproval } = await import("../lib/refund-approvals");
    expect(needsSecondApproval(499_999, 500_000)).toBe(false);
    expect(needsSecondApproval(500_000, 500_000)).toBe(true);
    expect(needsSecondApproval(900_000, 500_000)).toBe(true);
  });
});

describe("canDecide", () => {
  it("lets a different admin approve a pending refund", async () => {
    const { canDecide } = await import("../lib/refund-approvals");
    expect(
      canDecide({
        status: "pending",
        requestedBy: "owner@shop.test",
        actor: "manager@shop.test",
      }).ok
    ).toBe(true);
  });

  it("refuses the requester, which is the whole point", async () => {
    const { canDecide } = await import("../lib/refund-approvals");
    const result = canDecide({
      status: "pending",
      requestedBy: "owner@shop.test",
      actor: "owner@shop.test",
    });
    expect(result.ok).toBe(false);
    expect(result.error ?? "").toMatch(/someone else/i);
  });

  it("compares addresses case-insensitively, because cookies do not", async () => {
    const { canDecide } = await import("../lib/refund-approvals");
    expect(
      canDecide({
        status: "pending",
        requestedBy: "Owner@Shop.Test",
        actor: "owner@shop.test",
      }).ok
    ).toBe(false);
  });

  it("refuses a refund that is already decided", async () => {
    const { canDecide } = await import("../lib/refund-approvals");
    for (const status of ["approved", "rejected", "completed"]) {
      expect(
        canDecide({ status, requestedBy: "a@shop.test", actor: "b@shop.test" }).ok
      ).toBe(false);
    }
  });

  it("refuses an anonymous actor", async () => {
    const { canDecide } = await import("../lib/refund-approvals");
    expect(canDecide({ status: "pending", requestedBy: "a@shop.test", actor: null }).ok).toBe(
      false
    );
  });

  it("allows a pending refund with no recorded requester (rows from before the rule)", async () => {
    const { canDecide } = await import("../lib/refund-approvals");
    expect(
      canDecide({ status: "pending", requestedBy: null, actor: "b@shop.test" }).ok
    ).toBe(true);
  });
});

describe("wiring", () => {
  it("routes refund creation through the approval gate", () => {
    const route = read("app/api/admin/orders/[id]/refund/route.ts");
    expect(route).toMatch(/createRefundRequest/);
    // The actor has to come from the session, not the request body.
    expect(route).toMatch(/identity\.email/);
  });

  it("checks the rule on the decision endpoint, not only in the UI", () => {
    const route = read("app/api/admin/refunds/route.ts");
    expect(route).toMatch(/canDecide/);
    expect(route).toMatch(/status: 403/);
  });

  it("gives the queue a way in from the admin shell", () => {
    expect(read("components/admin-chrome.tsx")).toMatch(/\/admin\/refunds/);
  });
});
