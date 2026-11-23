/**
 * Dedicated Product submissions history view.
 *
 * The fake DB rejects any SELECT without a bound `partner_id` predicate, so the
 * tests pass only if the submissions module really delegates to A25's
 * `tenantQuery`-scoped reads (`listProducts` / `getProduct`) and never invents
 * its own data access or trusts a partner id from anywhere but the context.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PartnerContext } from "@/lib/partner/types";
import type { PartnerProductRow } from "@/lib/partner-portal/products";

const state = vi.hoisted(() => {
  const rows: any[] = [];
  const calls: Array<{ sql: string; params: any[] }> = [];
  let seq = 0;

  const clone = (row: any) => JSON.parse(JSON.stringify(row));

  const executor = async (sql: string, params: any[] = []) => {
    calls.push({ sql, params });
    const flat = sql.replace(/\s+/g, " ").trim();
    // tenantQuery always appends ctx.partnerId as the last bound parameter.
    const tenant = params[params.length - 1];

    if (/^SELECT/i.test(flat)) {
      if (!/partner_id = \$\d+/.test(flat)) throw new Error("Unscoped SELECT rejected by fake DB");
      let result = rows.filter((r) => r.partner_id === tenant);
      if (/WHERE id = \$1/.test(flat)) result = result.filter((r) => r.id === params[0]);
      return result.map(clone);
    }
    throw new Error(`Unexpected SQL: ${flat}`);
  };

  return {
    rows,
    calls,
    executor,
    reset: () => {
      rows.length = 0;
      calls.length = 0;
      seq = 0;
    },
    addRow: (overrides: Record<string, any> = {}) => {
      const row = {
        id: overrides.id ?? `pp-${++seq}`,
        partner_id: overrides.partner_id ?? "partner-A",
        product_id: overrides.product_id ?? `prod-${seq}`,
        submission_status: overrides.submission_status ?? "draft",
        attributes: overrides.attributes ?? { title: "Test work" },
        rejection_reason: overrides.rejection_reason ?? null,
        submitted_at: overrides.submitted_at ?? null,
        reviewed_by: overrides.reviewed_by ?? null,
        reviewed_at: overrides.reviewed_at ?? null,
        created_at: overrides.created_at ?? "2026-01-01T09:00:00.000Z",
        updated_at: overrides.updated_at ?? "2026-01-01T09:00:00.000Z",
      };
      rows.push(row);
      return row;
    },
  };
});

vi.mock("@/lib/db", () => ({
  query: (sql: string, params: any[]) => state.executor(sql, params),
  queryResult: async () => ({ rows: [] }),
  transaction: async <T,>(fn: (ex: typeof state.executor) => Promise<T>) => fn(state.executor),
  getPool: () => ({}),
}));

import {
  buildSubmissionTimeline,
  listSubmissionTimelines,
  getSubmissionTimeline,
} from "../lib/partner-portal/submissions";

const partnerA: PartnerContext = {
  partnerId: "partner-A",
  membershipId: "member-A",
  email: "a@partner.test",
  role: "owner",
  tokenVersion: 1,
};
const partnerB: PartnerContext = {
  partnerId: "partner-B",
  membershipId: "member-B",
  email: "b@partner.test",
  role: "viewer",
  tokenVersion: 1,
};

beforeEach(() => state.reset());

describe("buildSubmissionTimeline — pure, ordered history", () => {
  it("orders a full lifecycle chronologically: created → submitted → decision", () => {
    const row = state.addRow({
      submission_status: "approved",
      created_at: "2026-01-15T09:00:00.000Z",
      submitted_at: "2026-02-01T10:00:00.000Z",
      reviewed_at: "2026-02-03T12:00:00.000Z",
    });

    const timeline = buildSubmissionTimeline(row as PartnerProductRow);

    expect(timeline.events.map((e) => e.id)).toEqual(["created", "submitted", "decision"]);
    expect(timeline.events.map((e) => e.status)).toEqual(["draft", "submitted", "approved"]);
    expect(timeline.events.map((e) => e.at)).toEqual([
      "2026-01-15T09:00:00.000Z",
      "2026-02-01T10:00:00.000Z",
      "2026-02-03T12:00:00.000Z",
    ]);
    expect(timeline.currentStatus).toBe("approved");
    expect(timeline.title).toBe("Test work");
    expect(timeline.submissionId).toBe(row.id);
  });

  it("emits only a creation event for an untouched draft", () => {
    const timeline = buildSubmissionTimeline(state.addRow({ submission_status: "draft" }) as PartnerProductRow);
    expect(timeline.events.map((e) => e.id)).toEqual(["created"]);
    expect(timeline.events[0].status).toBe("draft");
  });

  it("does not emit a decision event when a terminal status has no review date", () => {
    const timeline = buildSubmissionTimeline(
      state.addRow({ submission_status: "approved", submitted_at: "2026-02-01T10:00:00.000Z", reviewed_at: null }) as PartnerProductRow
    );
    expect(timeline.events.map((e) => e.id)).toEqual(["created", "submitted"]);
  });

  it("does not mutate the source row (pure helper)", () => {
    const row = state.addRow({ submission_status: "rejected", rejection_reason: "Fix it" });
    const before = JSON.stringify(row);
    buildSubmissionTimeline(row as PartnerProductRow);
    expect(JSON.stringify(row)).toBe(before);
    // A pure helper performs no database access of its own.
    expect(state.calls).toHaveLength(0);
  });
});

describe("buildSubmissionTimeline — rejection reason surfaced", () => {
  it("carries the reviewer's reason on both the summary and the decision event", () => {
    const reason = "Please add accurate dimensions and material.";
    const row = state.addRow({
      submission_status: "rejected",
      rejection_reason: reason,
      submitted_at: "2026-03-01T10:00:00.000Z",
      reviewed_at: "2026-03-02T10:00:00.000Z",
    });

    const timeline = buildSubmissionTimeline(row as PartnerProductRow);
    const decision = timeline.events.find((e) => e.id === "decision")!;

    expect(timeline.rejectionReason).toBe(reason);
    expect(decision.status).toBe("rejected");
    expect(decision.label).toBe("Changes requested");
    expect(decision.reason).toBe(reason);
    expect(decision.description).toContain(reason);
  });

  it("still renders a friendly rejection message when the reason is empty", () => {
    const timeline = buildSubmissionTimeline(
      state.addRow({ submission_status: "rejected", rejection_reason: null, reviewed_at: "2026-03-02T10:00:00.000Z" }) as PartnerProductRow
    );
    const decision = timeline.events.find((e) => e.id === "decision")!;
    expect(decision.reason).toBeUndefined();
    expect(decision.description).toMatch(/requested changes/i);
  });
});

describe("tenant scoping — A25's tenantQuery is the only data access", () => {
  it("listSubmissionTimelines returns only rows owned by ctx.partnerId", async () => {
    state.addRow({ id: "a1", partner_id: "partner-A" });
    state.addRow({ id: "b1", partner_id: "partner-B" });

    const timelines = await listSubmissionTimelines(partnerA, state.executor);

    expect(timelines.map((t) => t.submissionId)).toEqual(["a1"]);
    const select = state.calls.find((c) => c.sql.startsWith("SELECT"))!;
    expect(select.sql).toContain("partner_id = $1");
    expect(select.params).toEqual(["partner-A"]);
  });

  it("getSubmissionTimeline returns null for another tenant's id", async () => {
    state.addRow({ id: "b1", partner_id: "partner-B" });

    expect(await getSubmissionTimeline(partnerA, "b1", state.executor)).toBeNull();
    const call = state.calls[state.calls.length - 1];
    expect(call.sql).toContain("partner_id = $2");
    expect(call.params).toEqual(["b1", "partner-A"]);
  });

  it("never takes a partner id from client data — only ctx.partnerId reaches a query", async () => {
    state.addRow({ id: "a1", partner_id: "partner-A" });
    state.addRow({ id: "b1", partner_id: "partner-B" });

    // Even a row that claims a foreign partner id cannot redirect a read: the
    // module has no partner-id parameter, and the helper ignores that field.
    const forged = {
      ...state.rows[0],
      partner_id: "partner-B",
    } as PartnerProductRow;
    const timeline = buildSubmissionTimeline(forged);
    expect(timeline.submissionId).toBe("a1");
    expect(state.calls).toHaveLength(0);

    await listSubmissionTimelines(partnerB, state.executor);
    for (const call of state.calls) {
      expect(call.params[call.params.length - 1]).toBe("partner-B");
      expect(call.params).not.toContain("partner-A");
    }
  });
});
