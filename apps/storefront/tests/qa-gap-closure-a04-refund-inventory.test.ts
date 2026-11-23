/**
 * A10 INDEPENDENT QA — A04 refund / inventory restoration (pure + fake executor).
 *
 * Independently pins: restoration eligibility fail-safe (approval alone never
 * restocks, unique artwork never restocked, owner evidence gated),
 * inventory_restored only set after success, UNIQUE movement_key, and additive
 * migration 007. No live DB, payment or stock is touched.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  deriveRestockEligibility,
  isPhysicalRestockableItem,
  RESTOCKABLE_CONDITIONS,
  type RestockPolicyInput,
} from "@/lib/returns/process";
import {
  assertDualControl,
  markRefundInventoryRestored,
  restoreInventoryForRefund,
  updateRefundInventoryState,
  type RefundRestorationItem,
} from "@/lib/payments/refund-execution";
import {
  restorationActionKey,
  restorationMovementKey,
  restoreSoldForRefundWithExecutor,
} from "@/lib/inventory";

const app = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(app, rel), "utf8");

const item = { is_digital: false, is_custom: false };
const fullPolicy: RestockPolicyInput = {
  physicallyReceived: true,
  inspected: true,
  restockApproved: true,
  condition: "resellable",
};

type Call = { sql: string; params: any[] };

function restorationDb() {
  const calls: Call[] = [];
  const executor = async (sql: string, params: any[] = []): Promise<any[]> => {
    const s = sql.replace(/\s+/g, " ");
    const norm = s.toLowerCase();
    calls.push({ sql: s, params });
    if (norm.startsWith("insert into inventory_restoration_action")) {
      return [{ id: "action-qa", status: params[8] }];
    }
    if (norm.startsWith("select * from inventory_restoration_action")) return [];
    if (norm.startsWith("update inventory_restoration_action")) return [];
    if (norm.startsWith("select id, variant_id, quantity from stock_reservation")) {
      return [{ id: "res-qa", variant_id: "v-qa", quantity: 1 }];
    }
    if (norm.startsWith("insert into inventory_movement")) return [{ id: "mv-qa" }];
    if (norm.startsWith("update stock_reservation")) return [];
    if (norm.startsWith("update variant_stock")) return [];
    if (norm.startsWith("update refund_execution")) {
      if (/inventory_restored = \$2/.test(s)) return [{ id: "exec-qa", inventory_restored: true }];
      return [{ id: "exec-qa", inventory_restored: false }];
    }
    return [];
  };
  return { executor, calls };
}

describe("A04 — restoration eligibility fails safe (pure)", () => {
  it("a refund approval alone NEVER restocks", () => {
    const e = deriveRestockEligibility("refund_approved_only", item, fullPolicy);
    expect(e.eligible).toBe(false);
    expect(e.needsOwnerDecision).toBe(false);
    const e2 = deriveRestockEligibility("refund_without_return", item, fullPolicy);
    expect(e2.eligible).toBe(false);
  });

  it("unique / one-of-one artwork is never restocked", () => {
    expect(isPhysicalRestockableItem({ unique_artwork: true })).toBe(false);
    expect(isPhysicalRestockableItem({ one_of_one: true })).toBe(false);
    const e = deriveRestockEligibility("return_received", { unique_artwork: true }, fullPolicy);
    expect(e.eligible).toBe(false);
    expect(e.reason).toMatch(/unique artwork/i);
  });

  it("missing owner evidence blocks with needsOwnerDecision", () => {
    const missing = deriveRestockEligibility("return_received", item, {
      physicallyReceived: true,
      inspected: true,
      restockApproved: true,
      // condition intentionally absent
    });
    expect(missing.eligible).toBe(false);
    expect(missing.needsOwnerDecision).toBe(true);
    const reviewed = deriveRestockEligibility("return_received", item, fullPolicy);
    expect(reviewed.eligible).toBe(true);
    expect(RESTOCKABLE_CONDITIONS.has("resellable")).toBe(true);
  });

  it("dual control refuses requester == approver", () => {
    expect(() => assertDualControl("admin@qa.test", "admin@qa.test")).toThrow();
    expect(() => assertDualControl("a@qa.test", "b@qa.test")).not.toThrow();
  });
});

describe("A04 — inventory_restored is set only after a successful restoration", () => {
  it("an ineligible plan records an action but never flips inventory_restored", async () => {
    const { executor, calls } = restorationDb();
    const line: RefundRestorationItem = {
      trigger: "refund_approved_only",
      item,
      policy: fullPolicy,
      variantId: "v-qa",
    };
    const result = await restoreInventoryForRefund(
      {
        executionId: "exec-qa",
        orderId: "ord-qa",
        actor: "admin-qa",
        restoration: { actor: "admin-qa", items: [line] },
      },
      executor
    );
    expect(result.state).toBe("not_eligible");
    expect(result.restoredItems).toBe(0);
    expect(calls.some((c) => /inventory_restored = \$2/.test(c.sql))).toBe(false);
    expect(calls.some((c) => /insert into inventory_movement/i.test(c.sql))).toBe(false);
  });

  it("an eligible restoration flips inventory_restored=true with a guard", async () => {
    const { executor, calls } = restorationDb();
    const line: RefundRestorationItem = {
      trigger: "pre_dispatch_cancellation",
      item,
      policy: { dispatched: false },
      variantId: "v-qa",
      orderItemId: "oi-qa",
      quantity: 1,
    };
    const result = await restoreInventoryForRefund(
      {
        executionId: "exec-qa",
        orderId: "ord-qa",
        actor: "admin-qa",
        restoration: { actor: "admin-qa", items: [line] },
      },
      executor
    );
    expect(result.state).toBe("restored");
    expect(result.restoredItems).toBe(1);
    const flag = calls.find((c) => /inventory_restored = \$2/.test(c.sql));
    expect(flag).toBeDefined();
    expect(flag!.params[1]).toBe(true);
    expect(flag!.sql).toMatch(/inventory_restored = FALSE/i);
    expect(calls.some((c) => /insert into inventory_movement/i.test(c.sql))).toBe(true);
  });

  it("state setter and success flag are separate SQL statements", async () => {
    const { executor, calls } = restorationDb();
    await updateRefundInventoryState("exec-qa", "pending", "owner decision", executor);
    const stateCall = calls.find((c) => /inventory_restoration_state = \$2/.test(c.sql));
    expect(stateCall).toBeDefined();
    expect(stateCall!.sql).not.toMatch(/inventory_restored =/);

    calls.length = 0;
    await markRefundInventoryRestored("exec-qa", "admin-qa", executor);
    const flagCall = calls[0];
    expect(flagCall.params[1]).toBe(true);
    expect(flagCall.params[2]).toBe("restored");
    expect(flagCall.sql).toContain("inventory_restored = FALSE");
  });

  it("execution-time re-verification rejects unique artwork before any movement", async () => {
    const { executor, calls } = restorationDb();
    const result = await restoreSoldForRefundWithExecutor(
      {
        orderId: "ord-qa",
        actionKey: restorationActionKey("exec-qa", "oi-qa"),
        movementKey: restorationMovementKey(restorationActionKey("exec-qa", "oi-qa")),
        actor: "admin-qa",
        reason: "test",
        trigger: "return_received",
        condition: "resellable",
        item: { unique_artwork: true },
      },
      executor
    );
    expect(result.restored).toBe(false);
    expect(result.actionStatus).toBe("failed");
    expect(calls.some((c) => /insert into inventory_movement/i.test(c.sql))).toBe(false);
  });
});

describe("A04 — UNIQUE movement_key and additive migration 007", () => {
  it("movement inserts are guarded by ON CONFLICT (movement_key)", () => {
    const inv = read("lib/inventory.ts");
    expect(inv).toMatch(/ON CONFLICT\s*\(movement_key\)\s*DO NOTHING/i);
    const m007 = read("db/migrations/007_refund_inventory.sql");
    expect(m007).toMatch(/movement_key\s+text\s+NOT NULL/);
    expect(m007).toMatch(/UNIQUE\s*\(\s*movement_key\s*\)/i);
  });

  it("007 is additive, idempotent and has a forward-recovery note", () => {
    const m = read("db/migrations/007_refund_inventory.sql");
    expect(m).toMatch(/IF NOT EXISTS/i);
    expect(m).toMatch(/forward recovery/i);
    expect(m).not.toMatch(/DROP TABLE|DELETE FROM|TRUNCATE/i);
    expect(m).toMatch(/inventory_restored\s*=\s*false/i); // historical default stays safe
  });
});
