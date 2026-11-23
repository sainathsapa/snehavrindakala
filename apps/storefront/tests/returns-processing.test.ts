import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Return processing rules and persistence. The DB is never contacted: every DB
 * helper is exercised with an injected executor that records its SQL so we can
 * assert the business outcome AND the audit metadata that was written.
 */

vi.mock("@/lib/db", () => ({
  query: vi.fn(async () => []),
  queryResult: vi.fn(async () => ({ rows: [] })),
}));

import {
  configuredReturnWindowDays,
  decideReturn,
  DECISION_TRANSITIONS,
  explainReturnEligibility,
  getLinkedRefund,
  isReturnEligible,
  linkRefund,
  listReturns,
  RESTOCKABLE_CONDITIONS,
  restockDecision,
  updateReturn,
  ReturnValidationError,
  type ReturnRow,
} from "../lib/returns/process";
import type { QueryExecutor } from "../lib/partner/repository";

/* ── Test double for the executor ────────────────────────────────────────── */

interface Call {
  sql: string;
  params: any[];
}

function makeReturn(overrides: Partial<ReturnRow> = {}): ReturnRow {
  return {
    id: "ret_1",
    order_id: "order_1",
    customer_id: "cus_1",
    customer_email: "buyer@example.test",
    reason: "Damaged in transit",
    status: "pending",
    items: "[]",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as ReturnRow;
}

function fakeExecutor(rows: ReturnRow[], refundIds: string[] = []) {
  const calls: Call[] = [];
  const auditRows: Array<{ new_values: string; action: string }> = [];
  const ex: QueryExecutor = async (sql, params = []) => {
    calls.push({ sql, params });
    if (/SELECT \* FROM return_requests ORDER BY/i.test(sql)) {
      return rows.map((r) => ({ ...r }));
    }
    if (/SELECT \* FROM return_requests WHERE id/i.test(sql)) {
      return rows.filter((r) => r.id === params[0]).map((r) => ({ ...r }));
    }
    if (/UPDATE return_requests SET/i.test(sql)) {
      const id = params[params.length - 1];
      const row = rows.find((r) => r.id === id);
      if (!row) return [];
      const setMatch = sql.match(/status = \$(\d+)/);
      if (setMatch) row.status = params[Number(setMatch[1]) - 1];
      const reasonMatch = sql.match(/reason = \$(\d+)/);
      if (reasonMatch) row.reason = params[Number(reasonMatch[1]) - 1];
      return [{ ...row }];
    }
    if (/SELECT id FROM order_refunds WHERE id/i.test(sql)) {
      return refundIds.includes(params[0]) ? [{ id: params[0] }] : [];
    }
    if (/INSERT INTO audit_log/i.test(sql)) {
      const action = String(params[2]);
      auditRows.push({ action, new_values: String(params[4]) });
      return [];
    }
    if (/SELECT new_values FROM audit_log/i.test(sql)) {
      const id = params[1];
      return auditRows
        .filter((a) => a.action === "return.refund_linked")
        .filter((a) => JSON.parse(a.new_values).return_id === id)
        .map((a) => ({ new_values: a.new_values }));
    }
    return [];
  };
  return { ex, calls, auditRows, rows };
}

const auditInsert = (calls: Call[]) =>
  calls.filter((c) => /INSERT INTO audit_log/i.test(c.sql));

/* ── isReturnEligible ────────────────────────────────────────────────────── */

describe("isReturnEligible", () => {
  it("accepts a return inside the configured window", () => {
    expect(isReturnEligible({ status: "delivered" }, 5, 10)).toBe(true);
    expect(isReturnEligible({ status: "delivered" }, 0, 10)).toBe(true);
  });

  it("rejects an expired window (the boundary day is still inside)", () => {
    expect(isReturnEligible({ status: "delivered" }, 31, 30)).toBe(false);
    expect(isReturnEligible({ status: "delivered" }, 30, 30)).toBe(true);
  });

  it("rejects a non-delivered order", () => {
    expect(isReturnEligible({ status: "cancelled" }, 2, 30)).toBe(false);
    expect(explainReturnEligibility({ status: "pending" }, 2, 30).reason).toMatch(
      /not a delivered order/i
    );
  });

  it("never invents a window: missing/invalid window is ineligible", () => {
    expect(isReturnEligible({}, 2, undefined as unknown as number)).toBe(false);
    expect(isReturnEligible({}, 2, 0)).toBe(false);
    expect(isReturnEligible({}, 2, Number.NaN)).toBe(false);
    expect(explainReturnEligibility({}, 2, 0).reason).toMatch(/not configured/i);
  });

  it("rejects invalid days-since-delivery", () => {
    expect(isReturnEligible({}, -1, 30)).toBe(false);
    expect(isReturnEligible({}, Number.NaN, 30)).toBe(false);
  });
});

describe("configuredReturnWindowDays", () => {
  beforeEach(() => {
    delete process.env.RETURN_WINDOW_DAYS;
  });

  it("reports UNCONFIGURED rather than defaulting", () => {
    expect(configuredReturnWindowDays()).toBeNull();
    process.env.RETURN_WINDOW_DAYS = "nonsense";
    expect(configuredReturnWindowDays()).toBeNull();
  });

  it("uses the owner-supplied positive integer", () => {
    process.env.RETURN_WINDOW_DAYS = "14";
    expect(configuredReturnWindowDays()).toBe(14);
  });
});

/* ── decideReturn ────────────────────────────────────────────────────────── */

describe("decideReturn", () => {
  it("allows approve, reject and needs_evidence from pending", () => {
    expect(decideReturn({ status: "pending" }, "approve", "a@shop.test")).toMatchObject({
      ok: true,
      status: "approved",
      decision: "approve",
    });
    expect(
      decideReturn({ status: "pending", reason: "No proof" }, "needs_evidence", "a@shop.test")
    ).toMatchObject({ ok: true, status: "needs_evidence" });
    expect(
      decideReturn({ status: "pending", reason: "Arrived used" }, "reject", "a@shop.test")
    ).toMatchObject({ ok: true, status: "rejected" });
  });

  it("requires a reason to reject", () => {
    const missing = decideReturn({ status: "pending", reason: "  " }, "reject", "a@shop.test");
    expect(missing.ok).toBe(false);
    expect(missing.error).toMatch(/reason is required/i);
    const withReason = decideReturn(
      { status: "pending", reason: "  Outside policy  " },
      "reject",
      "a@shop.test"
    );
    expect(withReason.ok).toBe(true);
    expect(withReason.reason).toBe("Outside policy");
  });

  it("enforces decision transitions (terminal statuses cannot be decided)", () => {
    expect(DECISION_TRANSITIONS.pending).toContain("needs_evidence");
    // needs_evidence can still be resolved, but cannot loop back to itself.
    expect(
      decideReturn({ status: "needs_evidence" }, "approve", "a@shop.test").ok
    ).toBe(true);
    expect(
      decideReturn({ status: "needs_evidence" }, "needs_evidence", "a@shop.test").ok
    ).toBe(false);
    for (const status of ["approved", "rejected", "completed"]) {
      expect(decideReturn({ status }, "approve", "a@shop.test").ok).toBe(false);
    }
  });

  it("rejects unknown decisions and anonymous actors", () => {
    expect(decideReturn({ status: "pending" }, "ship", "a@shop.test").ok).toBe(false);
    expect(decideReturn({ status: "pending" }, "approve", "  ").ok).toBe(false);
  });
});

/* ── restockDecision ─────────────────────────────────────────────────────── */

describe("restockDecision", () => {
  it("restocks resellable physical items", () => {
    for (const condition of RESTOCKABLE_CONDITIONS) {
      expect(restockDecision({}, condition)).toBe("restock");
    }
    expect(restockDecision({}, "Like New")).toBe("restock");
  });

  it("does not restock damaged/used items", () => {
    expect(restockDecision({}, "damaged")).toBe("no_restock");
    expect(restockDecision({}, "defective")).toBe("no_restock");
    expect(restockDecision({}, "opened")).toBe("no_restock");
    expect(restockDecision({}, "")).toBe("no_restock");
  });

  it("never restocks digital or custom/made-to-order items", () => {
    expect(restockDecision({ is_digital: true }, "new")).toBe("no_restock");
    expect(restockDecision({ custom: true }, "new")).toBe("no_restock");
    expect(restockDecision({ made_to_order: true }, "new")).toBe("no_restock");
  });
});

/* ── DB helpers with injectable executor ─────────────────────────────────── */

describe("listReturns", () => {
  it("maps rows through the injected executor", async () => {
    const { ex } = fakeExecutor([makeReturn({ items: '["item_a"]' })]);
    const list = await listReturns(ex);
    expect(list).toHaveLength(1);
    expect(list[0].items).toEqual(["item_a"]);
  });
});

describe("updateReturn audit metadata", () => {
  it("updates status and writes who/what/when to audit_log", async () => {
    const { ex, calls } = fakeExecutor([makeReturn()]);
    const updated = await updateReturn(
      "ret_1",
      {
        status: "approved",
        decision: "approve",
        decision_reason: "Within policy",
        actor_role: "manager",
      },
      "manager@shop.test",
      ex
    );

    expect(updated?.status).toBe("approved");
    expect(calls.some((c) => /UPDATE return_requests SET/i.test(c.sql))).toBe(true);

    const audits = auditInsert(calls);
    expect(audits).toHaveLength(1);
    const a = audits[0].params;
    expect(a[0]).toBe("return_request"); // entity_type
    expect(a[1]).toBe("ret_1"); // entity_id
    expect(a[2]).toBe("return.decision.approve"); // action
    expect(a[5]).toBe("manager@shop.test"); // user_email
    expect(a[6]).toBe("manager"); // user_role
    const newValues = JSON.parse(a[4]);
    expect(newValues.actor).toBe("manager@shop.test");
    expect(newValues.decision).toBe("approve");
    expect(newValues.decision_reason).toBe("Within policy");
    expect(typeof newValues.decided_at).toBe("string");
    expect(JSON.parse(a[3]).status).toBe("pending"); // old_values
  });

  it("does not touch the customer's reason column for decision reasons", async () => {
    const { ex, calls } = fakeExecutor([makeReturn({ reason: "Damaged in transit" })]);
    await updateReturn(
      "ret_1",
      { status: "rejected", decision: "reject", decision_reason: "No evidence" },
      "a@shop.test",
      ex
    );
    const update = calls.find((c) => /UPDATE return_requests SET/i.test(c.sql))!;
    expect(update.sql).not.toMatch(/reason = /);
  });

  it("rejects unknown statuses before issuing any SQL", async () => {
    const { ex, calls } = fakeExecutor([makeReturn()]);
    await expect(
      updateReturn("ret_1", { status: "shipped" }, "a@shop.test", ex)
    ).rejects.toBeInstanceOf(ReturnValidationError);
    expect(calls).toHaveLength(0);
  });

  it("is a no-op (no audit) when the return does not exist", async () => {
    const { ex, calls } = fakeExecutor([]);
    const result = await updateReturn("missing", { status: "approved" }, "a@shop.test", ex);
    expect(result).toBeNull();
    expect(auditInsert(calls)).toHaveLength(0);
  });
});

describe("linkRefund", () => {
  it("records a durable link to an existing refund", async () => {
    const { ex, calls } = fakeExecutor([makeReturn()], ["refund_9"]);
    await linkRefund("ret_1", "refund_9", ex);
    const audits = auditInsert(calls);
    expect(audits).toHaveLength(1);
    expect(audits[0].params[2]).toBe("return.refund_linked");
    expect(JSON.parse(audits[0].params[4]).refund_request_id).toBe("refund_9");
  });

  it("refuses to link a refund that does not exist", async () => {
    const { ex, calls } = fakeExecutor([makeReturn()], []);
    await expect(linkRefund("ret_1", "ghost", ex)).rejects.toBeInstanceOf(
      ReturnValidationError
    );
    expect(auditInsert(calls)).toHaveLength(0);
  });

  it("link is readable via getLinkedRefund", async () => {
    const { ex } = fakeExecutor([makeReturn()], ["refund_9"]);
    await linkRefund("ret_1", "refund_9", ex);
    expect(await getLinkedRefund("ret_1", ex)).toBe("refund_9");
  });
});

describe("decision workflow end to end", () => {
  it("pending -> needs_evidence -> approved, with audit rows at each step", async () => {
    const { ex, calls } = fakeExecutor([makeReturn()]);
    let outcome = decideReturn(
      { status: "pending", reason: "Please share photos" },
      "needs_evidence",
      "a@shop.test"
    );
    expect(outcome.ok).toBe(true);
    let updated = await updateReturn(
      "ret_1",
      { status: outcome.status!, decision: outcome.decision!, decision_reason: outcome.reason },
      "a@shop.test",
      ex
    );
    expect(updated?.status).toBe("needs_evidence");

    outcome = decideReturn({ status: updated!.status }, "approve", "b@shop.test");
    expect(outcome.ok).toBe(true);
    updated = await updateReturn(
      "ret_1",
      { status: outcome.status!, decision: outcome.decision!, decision_reason: outcome.reason },
      "b@shop.test",
      ex
    );
    expect(updated?.status).toBe("approved");

    const audits = auditInsert(calls);
    expect(audits).toHaveLength(2);
    expect(audits.map((a) => a.params[2])).toEqual([
      "return.decision.needs_evidence",
      "return.decision.approve",
    ]);
  });
});
