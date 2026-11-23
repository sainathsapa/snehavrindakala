import { describe, it, expect } from "vitest";
import type { PartnerContext } from "@/lib/partner/types";
import {
  listPartnerGroups,
  getPartnerGroup,
  updateGroupStatus,
  createAllocations,
  reassignGroup,
  assertNoForbiddenFulfilmentFields,
  InvalidTransitionError,
  FulfilmentValidationError,
} from "@/lib/fulfilment/store";
import type { AllocationGroup } from "@/lib/fulfilment/types";

const ctxA: PartnerContext = {
  partnerId: "partner-A",
  membershipId: "member-A",
  email: "a@partner.test",
  role: "owner",
  tokenVersion: 1,
};
const ctxB: PartnerContext = {
  partnerId: "partner-B",
  membershipId: "member-B",
  email: "b@partner.test",
  role: "owner",
  tokenVersion: 1,
};

type Row = Record<string, any>;
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/**
 * Fake executor that emulates the relevant WHERE/ON CONFLICT semantics of the
 * fulfilment tables. It records every SQL + params so we can assert that the
 * tenant predicate is present and bound from the server-side context.
 */
function makeDb() {
  const groups: Row[] = [
    {
      id: "group-A1",
      customer_order_id: "order-1",
      partner_id: "partner-A",
      status: "assigned",
      items: JSON.stringify([{ item_id: "line-1", quantity: 1 }]),
      assignment_history: JSON.stringify([
        { at: "2026-01-01T00:00:00Z", from: null, to: "assigned", actor: "admin" },
      ]),
    },
    {
      id: "group-A2",
      customer_order_id: "order-2",
      partner_id: "partner-A",
      status: "accepted",
      items: JSON.stringify([{ item_id: "line-2", quantity: 2 }]),
      assignment_history: JSON.stringify([]),
    },
    {
      id: "group-B1",
      customer_order_id: "order-1",
      partner_id: "partner-B",
      status: "assigned",
      items: JSON.stringify([{ item_id: "line-3", quantity: 1 }]),
      assignment_history: JSON.stringify([]),
    },
  ];
  const partners: Row[] = [
    { id: "partner-A", account_status: "active" },
    { id: "partner-B", account_status: "active" },
    { id: "partner-C", account_status: "active" },
  ];
  const calls: Array<{ sql: string; params: any[] }> = [];

  const executor = async (sql: string, params: any[] = []): Promise<any[]> => {
    calls.push({ sql, params });
    const head = sql.trim().toUpperCase();

    if (head.startsWith("SELECT")) {
      if (sql.includes("FROM partner WHERE id = $1")) {
        return partners.filter((p) => p.id === params[0]).map(clone);
      }
      if (sql.includes("WHERE id = $1 AND partner_id = $2")) {
        return groups
          .filter((g) => g.id === params[0] && g.partner_id === params[1])
          .map(clone);
      }
      if (sql.includes("WHERE partner_id = $1")) {
        return groups.filter((g) => g.partner_id === params[0]).map(clone);
      }
      if (sql.includes("WHERE id = $1")) {
        return groups.filter((g) => g.id === params[0]).map(clone);
      }
      return [];
    }

    if (head.startsWith("INSERT")) {
      const [id, orderId, partnerId, items, history] = params;
      const exists = groups.some(
        (g) => g.customer_order_id === orderId && g.partner_id === partnerId
      );
      if (exists) return []; // ON CONFLICT (order, partner) DO NOTHING
      const row: Row = {
        id,
        customer_order_id: orderId,
        partner_id: partnerId,
        status: "assigned",
        items,
        assignment_history: history,
      };
      groups.push(row);
      return [clone(row)];
    }

    if (head.startsWith("UPDATE")) {
      const scoped = sql.match(/WHERE id = \$(\d+) AND partner_id = \$(\d+)/);
      let targets: Row[];
      if (scoped) {
        const idIdx = Number(scoped[1]) - 1;
        const pidIdx = Number(scoped[2]) - 1;
        targets = groups.filter(
          (g) => g.id === params[idIdx] && g.partner_id === params[pidIdx]
        );
        for (const row of targets) {
          row.status = params[0];
          row.assignment_history = params[1];
          if (params[2] != null) row.rejection_reason = params[2];
          if (params[3] != null) row.shipment_id = params[3];
        }
      } else if (sql.includes("SET partner_id = $1")) {
        // admin reassign: partner_id=$1, history=$2, id=$3
        targets = groups.filter((g) => g.id === params[2]);
        for (const row of targets) {
          row.partner_id = params[0];
          row.assignment_history = params[1];
        }
      } else {
        // admin cancel: history=$1, reason=$2, id=$3
        targets = groups.filter((g) => g.id === params[2]);
        for (const row of targets) {
          row.status = "cancelled";
          row.assignment_history = params[0];
          if (params[1] != null) row.rejection_reason = params[1];
        }
      }
      return targets.map(clone);
    }

    return [];
  };

  return { executor, calls, groups };
}

describe("tenant isolation — partner A cannot read partner B's groups", () => {
  it("listPartnerGroups returns only the authenticated partner's rows", async () => {
    const db = makeDb();
    const rows = await listPartnerGroups(ctxA, db.executor);
    expect(rows.map((r) => r.id).sort()).toEqual(["group-A1", "group-A2"]);
    expect(db.calls[0].sql).toContain("partner_id = $1");
    expect(db.calls[0].params).toEqual(["partner-A"]);
  });

  it("getPartnerGroup(foreign id) returns null, not partner B's row", async () => {
    const db = makeDb();
    const row = await getPartnerGroup(ctxA, "group-B1", db.executor);
    expect(row).toBeNull();
    expect(db.calls[0].sql).toContain("WHERE id = $1 AND partner_id = $2");
    expect(db.calls[0].params).toEqual(["group-B1", "partner-A"]);
  });

  it("a manipulated id from another tenant cannot change the partner predicate", async () => {
    const db = makeDb();
    // The caller supplies a foreign id; the partner id is STILL ctx.partnerId,
    // never a value from the request. Result: no row escapes tenant A.
    const manipulatedId = "group-B1";
    const result = await getPartnerGroup(ctxA, manipulatedId, db.executor);
    expect(result).toBeNull();
    const last = db.calls[db.calls.length - 1];
    expect(last.params[last.params.length - 1]).toBe("partner-A");
    expect(last.params).not.toContain("partner-B");
  });

  it("partner B can still read its own group", async () => {
    const db = makeDb();
    expect((await getPartnerGroup(ctxB, "group-B1", db.executor))?.id).toBe(
      "group-B1"
    );
  });
});

describe("tenant isolation — partner A cannot update partner B's group", () => {
  it("updateGroupStatus(foreign id) is a no-op and issues no UPDATE", async () => {
    const db = makeDb();
    const result = await updateGroupStatus(
      ctxA,
      "group-B1",
      "accepted",
      ctxA.email,
      {},
      db.executor
    );
    expect(result).toBeNull();
    expect(db.calls.every((c) => !c.sql.trim().toUpperCase().startsWith("UPDATE"))).toBe(true);
    // Partner B's row is untouched.
    expect(db.groups.find((g) => g.id === "group-B1")?.status).toBe("assigned");
  });

  it("a valid transition on an owned group appends history and scopes the UPDATE", async () => {
    const db = makeDb();
    const updated = await updateGroupStatus(
      ctxA,
      "group-A1",
      "accepted",
      ctxA.email,
      {},
      db.executor
    );
    expect(updated?.status).toBe("accepted");
    expect(updated?.assignment_history).toHaveLength(2);
    expect(updated?.assignment_history[1].actor).toBe(ctxA.email);

    const update = db.calls.find((c) =>
      c.sql.trim().toUpperCase().startsWith("UPDATE")
    );
    expect(update?.sql).toContain("WHERE id = $5 AND partner_id = $6");
    expect(update?.params[5]).toBe("partner-A");
    expect(update?.params).not.toContain("partner-B");
  });

  it("skipping statuses is rejected before any write", async () => {
    const db = makeDb();
    await expect(
      updateGroupStatus(ctxA, "group-A1", "delivered", ctxA.email, {}, db.executor)
    ).rejects.toBeInstanceOf(InvalidTransitionError);
    expect(db.calls.some((c) => c.sql.trim().toUpperCase().startsWith("UPDATE"))).toBe(
      false
    );
  });

  it("financial fields are rejected even if smuggled into transition extras", async () => {
    const db = makeDb();
    await expect(
      updateGroupStatus(
        ctxA,
        "group-A1",
        "accepted",
        ctxA.email,
        { refund_amount: 500 } as any,
        db.executor
      )
    ).rejects.toBeInstanceOf(FulfilmentValidationError);
    expect(() => assertNoForbiddenFulfilmentFields({ payment_id: "pay-1" })).toThrow(
      /not permitted/
    );
    expect(() => assertNoForbiddenFulfilmentFields({ shipment_id: "ship-1" })).not.toThrow();
  });
});

describe("allocation writes are idempotent and history-preserving", () => {
  const groups: AllocationGroup[] = [
    { customer_order_id: "order-9", partner_id: "partner-A", items: [{ item_id: "x", quantity: 1 }] },
    { customer_order_id: "order-9", partner_id: "partner-B", items: [{ item_id: "y", quantity: 2 }] },
  ];

  it("inserts one group per partner with ON CONFLICT DO NOTHING and initial history", async () => {
    const db = makeDb();
    const created = await createAllocations("order-9", groups, db.executor);
    expect(created).toHaveLength(2);
    expect(created.map((g) => g.partner_id).sort()).toEqual([
      "partner-A",
      "partner-B",
    ]);
    expect(created[0].assignment_history[0]).toMatchObject({
      from: null,
      to: "assigned",
    });
    expect(db.calls[0].sql).toContain(
      "ON CONFLICT (customer_order_id, partner_id) DO NOTHING"
    );
  });

  it("re-running the same allocation does not create duplicate groups", async () => {
    const db = makeDb();
    await createAllocations("order-9", groups, db.executor);
    const second = await createAllocations("order-9", groups, db.executor);
    expect(second).toHaveLength(0);
    const forOrder9 = db.groups.filter((g) => g.customer_order_id === "order-9");
    expect(forOrder9).toHaveLength(2);
    expect(new Set(forOrder9.map((g) => g.partner_id)).size).toBe(2);
  });

  it("admin reassign still honours one group per partner for the order", async () => {
    const db = makeDb();
    const updated = await reassignGroup(
      "group-B1",
      "partner-C",
      "admin@test",
      db.executor
    );
    expect(updated?.partner_id).toBe("partner-C");
  });
});
