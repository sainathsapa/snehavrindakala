import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildStatement,
  groupEntriesIntoPeriods,
  formatMoney,
  type EarningsEntry,
} from "@/lib/partner-portal/statements";
import { getPartnerEarnings } from "@/lib/partner/repository";
import type { PartnerContext } from "@/lib/partner/types";

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const ctxA: PartnerContext = {
  partnerId: "partner-A",
  membershipId: "member-A",
  email: "a@partner.test",
  role: "finance",
  tokenVersion: 1,
};

function entry(overrides: Partial<EarningsEntry> = {}): EarningsEntry {
  return {
    id: "e1",
    order_id: "order-1",
    item_id: "item-1",
    entry_type: "earning",
    gross_basis: "1000.00",
    commission_amount: "100.00",
    payable_amount: "900.00",
    currency: "INR",
    created_at: "2026-05-02T10:00:00.000Z",
    ...overrides,
  };
}

describe("buildStatement — pure totals (read-only statements)", () => {
  it("sums money exactly across string numeric rows (no float drift)", () => {
    const entries = [
      entry({ id: "e1", gross_basis: "0.10", commission_amount: "0.01", payable_amount: "0.09" }),
      entry({ id: "e2", gross_basis: "0.20", commission_amount: "0.02", payable_amount: "0.18" }),
    ];
    const statement = buildStatement(entries, { key: "p", label: "Period" });
    expect(statement.totals.lineCount).toBe(2);
    expect(statement.totals.gross).toBe(0.3);
    expect(statement.totals.commission).toBe(0.03);
    expect(statement.totals.payable).toBe(0.27);
  });

  it("nets off a refund reversal with a negative payable amount", () => {
    const entries = [
      entry({ id: "e1", gross_basis: "1000", commission_amount: "100", payable_amount: "900" }),
      entry({
        id: "e2",
        entry_type: "refund_reversal",
        gross_basis: "200",
        commission_amount: "20",
        payable_amount: "-180",
        reverses_entry_id: "e1",
      }),
    ];
    const statement = buildStatement(entries, { key: "p", label: "Period" });
    expect(statement.totals.payable).toBe(720);
    expect(statement.totals.gross).toBe(1200);
    expect(statement.lineItems[1].status).toBe("Reversal");
    expect(statement.lineItems[1].reversesEntryId).toBe("e1");
  });

  it("maps line items (order, item, type, date) and defaults currency to INR", () => {
    const statement = buildStatement(
      [entry({ currency: undefined })],
      { key: "p", label: "Period" }
    );
    expect(statement.currency).toBe("INR");
    expect(statement.lineItems[0]).toMatchObject({
      orderId: "order-1",
      itemId: "item-1",
      entryType: "earning",
      status: "Earned",
      date: "2026-05-02",
    });
  });

  it("produces zero totals for no entries and keeps the informational view label", () => {
    const statement = buildStatement([], { key: "p", label: "Empty" });
    expect(statement.totals).toEqual({
      lineCount: 0,
      gross: 0,
      discount: 0,
      tax: 0,
      shipping: 0,
      commission: 0,
      payable: 0,
    });
    expect(statement.viewLabel).toMatch(/information only/i);
  });

  it("formatMoney is deterministic and shows a sign for reversals", () => {
    expect(formatMoney("1234.5", "INR")).toBe("INR 1234.50");
    expect(formatMoney("-180")).toBe("-INR 180.00");
  });
});

describe("groupEntriesIntoPeriods — batch / period grouping", () => {
  it("groups batched entries by batch id and unbatched entries by month", () => {
    const groups = groupEntriesIntoPeriods([
      entry({ id: "e1", settlement_batch_id: "batch-1", created_at: "2026-05-02T10:00:00Z" }),
      entry({ id: "e2", settlement_batch_id: "batch-1", created_at: "2026-05-03T10:00:00Z" }),
      entry({ id: "e3", settlement_batch_id: null, created_at: "2026-06-01T10:00:00Z" }),
      entry({ id: "e4", settlement_batch_id: null, created_at: "2026-05-09T10:00:00Z" }),
    ]);
    const batch = groups.find((g) => g.period.batchId === "batch-1");
    expect(batch?.entries.map((e) => e.id)).toEqual(["e1", "e2"]);
    expect(groups.find((g) => g.period.key === "month:2026-06")?.entries.map((e) => e.id)).toEqual([
      "e3",
    ]);
    expect(groups.find((g) => g.period.key === "month:2026-05")?.entries.map((e) => e.id)).toEqual([
      "e4",
    ]);
    // Most recent period first.
    expect(groups[0].period.key).toBe("month:2026-06");
  });
});

describe("cross-partner scoping — no partner can read another's earnings", () => {
  it("getPartnerEarnings binds only the session partner id; a foreign row is never returned", async () => {
    const dbRows = [
      { ...entry({ id: "a1" }), partner_id: "partner-A" },
      { ...entry({ id: "b1", order_id: "order-B" }), partner_id: "partner-B" },
    ];
    const calls: Array<{ sql: string; params: any[] }> = [];
    const executor = async (sql: string, params: any[] = []) => {
      calls.push({ sql, params });
      // Emulate the DB applying the bound partner predicate.
      const boundPartner = params[params.length - 1];
      return dbRows.filter((r) => r.partner_id === boundPartner);
    };

    const rowsA = await getPartnerEarnings(ctxA, executor);
    expect(rowsA).toHaveLength(1);
    expect(rowsA[0].id).toBe("a1");
    expect(calls[0].sql).toContain("partner_id = $1");
    expect(calls[0].params).toEqual(["partner-A"]);
  });

  it("a different partner context sees only its own rows using the same query", async () => {
    const ctxB: PartnerContext = { ...ctxA, partnerId: "partner-B" };
    const dbRows = [
      { ...entry({ id: "a1" }), partner_id: "partner-A" },
      { ...entry({ id: "b1", order_id: "order-B" }), partner_id: "partner-B" },
    ];
    const executor = async (_sql: string, params: any[] = []) =>
      dbRows.filter((r) => r.partner_id === params[params.length - 1]);
    const rowsB = await getPartnerEarnings(ctxB, executor);
    expect(rowsB).toHaveLength(1);
    expect(rowsB[0].order_id).toBe("order-B");
  });
});

describe("static wiring — partner pages are view-only and use scoped helpers only", () => {
  const pages = [
    "app/partner/earnings/page.tsx",
    "app/partner/statements/page.tsx",
    "app/partner/settlements/page.tsx",
  ];
  const sources = pages.map((p) => ({ path: p, source: read(p) }));

  const ALLOWED_IMPORTS = new Set([
    "next/link",
    "next/navigation",
    "@/lib/partner/context",
    "@/lib/partner/rbac",
    "@/lib/partner/repository",
    "@/lib/partner-portal/statements",
  ]);

  it("every import is an allowed scoped/pure helper — no admin finance module", () => {
    for (const { path, source } of sources) {
      const specifiers = Array.from(source.matchAll(/from\s+["']([^"']+)["']/g)).map(
        (m) => m[1]
      );
      for (const spec of specifiers) {
        expect(ALLOWED_IMPORTS.has(spec), `${path} imported forbidden module: ${spec}`).toBe(
          true
        );
      }
      // Nothing here may reach into the admin side or define an admin action.
      expect(source).not.toMatch(/@\/app\/admin|@\/lib\/admin|@\/app\/api\/admin/);
      expect(source).not.toMatch(/requirePermission|requireAdmin/);
      expect(source).not.toMatch(/["']use server["']/);
      expect(source).not.toMatch(/export\s+async\s+function\s+(?!\*)/);
    }
  });

  it("contains no approval / payout action names", () => {
    const forbidden = [
      "approveSettlement",
      "initiatePayout",
      "executePayout",
      "markPaymentCompleted",
      "createSettlement",
      "approveCommission",
    ];
    for (const { path, source } of sources) {
      for (const name of forbidden) {
        expect(source.includes(name), `${path} referenced admin action ${name}`).toBe(false);
      }
    }
  });

  it("earnings page uses the scoped earnings read and shows the unconfigured notice", () => {
    const earnings = read("app/partner/earnings/page.tsx");
    expect(earnings).toMatch(/getPartnerEarnings\(/);
    expect(earnings).toMatch(/UNCONFIGURED/);
    expect(earnings).toMatch(/requirePartnerContext/);
  });

  it("statements page builds statements from the pure helper over scoped rows", () => {
    const statements = read("app/partner/statements/page.tsx");
    expect(statements).toMatch(/getPartnerEarnings\(/);
    expect(statements).toMatch(/buildStatement\(/);
    expect(statements).toMatch(/groupEntriesIntoPeriods\(/);
    expect(statements).toMatch(/Statement view/i);
  });

  it("settlements page queries batch items through tenantQuery with a {partner} predicate", () => {
    const settlements = read("app/partner/settlements/page.tsx");
    expect(settlements).toMatch(/tenantQuery/);
    expect(settlements).toMatch(/settlement_batch_item/);
    expect(settlements).toMatch(/\{partner\}/);
    // Must not surface the batch's platform-wide total (other partners' money).
    expect(settlements).not.toMatch(/sb\.total_amount/);
    expect(settlements).toMatch(/provider has confirmed/i);
    expect(settlements).toMatch(/No payout is executed from this portal/i);
  });
});
