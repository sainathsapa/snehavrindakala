import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  summariseOverview,
  listAllPartners,
  listAllocations,
  listSettlements,
  getMarketplaceOverview,
  type MarketplaceExecutor,
} from "@/lib/admin-marketplace/overview";

const root = join(__dirname, "..");

function fakeExecutor(
  resolver: (sql: string, params: any[]) => any[] = () => []
): { ex: MarketplaceExecutor; calls: Array<{ sql: string; params: any[] }> } {
  const calls: Array<{ sql: string; params: any[] }> = [];
  const ex: MarketplaceExecutor = async (sql, params = []) => {
    calls.push({ sql, params });
    return resolver(sql, params);
  };
  return { ex, calls };
}

/* ── pure summary helper ─────────────────────────────────────────────────── */

describe("summariseOverview (pure)", () => {
  it("returns a zeroed, INR-default summary for empty inputs", () => {
    const s = summariseOverview([], [], []);
    expect(s.totalPartners).toBe(0);
    expect(s.totalAllocations).toBe(0);
    expect(s.awaitingAcceptance).toBe(0);
    expect(s.totalEarningsEntries).toBe(0);
    expect(s.totalPayable).toBe(0);
    expect(s.totalCommission).toBe(0);
    expect(s.currency).toBe("INR");
    expect(s.partnersByStatus).toEqual({});
    expect(s.allocationsByStatus).toEqual({});
  });

  it("counts partners by account and verification status", () => {
    const s = summariseOverview(
      [
        { account_status: "active", verification_status: "verified" },
        { account_status: "active", verification_status: "unverified" },
        { account_status: "pending", verification_status: "pending" },
        { account_status: "suspended", verification_status: "verified" },
      ],
      [],
      []
    );
    expect(s.totalPartners).toBe(4);
    expect(s.activePartners).toBe(2);
    expect(s.pendingPartners).toBe(1);
    expect(s.suspendedPartners).toBe(1);
    expect(s.verifiedPartners).toBe(2);
    expect(s.unverifiedPartners).toBe(1);
    expect(s.partnersByStatus).toEqual({ active: 2, pending: 1, suspended: 1 });
    expect(s.partnersByVerification).toEqual({ verified: 2, unverified: 1, pending: 1 });
  });

  it("counts allocation statuses and the acceptance queue", () => {
    const s = summariseOverview(
      [],
      [
        { status: "assigned" },
        { status: "assigned" },
        { status: "accepted" },
        { status: "dispatched" },
      ],
      []
    );
    expect(s.totalAllocations).toBe(4);
    expect(s.awaitingAcceptance).toBe(2);
    expect(s.allocationsByStatus).toEqual({ assigned: 2, accepted: 1, dispatched: 1 });
  });

  it("sums numeric-string money and separates earning vs reversal entries", () => {
    const s = summariseOverview(
      [],
      [],
      [
        { entry_type: "earning", commission_amount: "10.50", payable_amount: "89.50", currency: "INR" },
        { entry_type: "earning", commission_amount: 2, payable_amount: 18, currency: "INR" },
        { entry_type: "refund_reversal", commission_amount: "-1.00", payable_amount: "-9.00", currency: "INR" },
        { entry_type: "adjustment", commission_amount: "0.25", payable_amount: "0.75", currency: "INR" },
      ]
    );
    expect(s.totalEarningsEntries).toBe(4);
    expect(s.earningEntries).toBe(2);
    expect(s.reversalEntries).toBe(2);
    expect(s.totalCommission).toBe(11.75);
    expect(s.totalPayable).toBe(99.25);
  });

  it("ignores non-numeric money instead of poisoning the total", () => {
    const s = summariseOverview(
      [],
      [],
      [
        { entry_type: "earning", commission_amount: "bad", payable_amount: "NaN", currency: "USD" },
        { entry_type: "earning", commission_amount: "1", payable_amount: "2", currency: "USD" },
      ]
    );
    expect(s.totalCommission).toBe(1);
    expect(s.totalPayable).toBe(2);
    expect(s.currency).toBe("USD");
  });
});

/* ── platform queries are parameterised, tenant-agnostic and real ───────── */

describe("platform marketplace queries", () => {
  it("lists all partners with the maker join and no tenant predicate", async () => {
    const rows = [
      {
        id: "p1",
        display_name: "Studio",
        legal_name: "Studio LLP",
        account_status: "active",
        verification_status: "verified",
        artist_id: "42",
        artist_name: "Maker",
      },
    ];
    const { ex, calls } = fakeExecutor(() => rows);
    const result = await listAllPartners({ status: "active", search: "studio" }, ex);

    expect(result).toEqual(rows);
    const { sql, params } = calls[0];
    expect(sql).toContain("FROM partner p");
    expect(sql).toContain("LEFT JOIN site_artist sa ON sa.id::text = p.artist_id");
    expect(sql).toContain("p.account_status = $1");
    expect(sql).toContain("ILIKE $2");
    expect(params[0]).toBe("active");
    expect(params[1]).toBe("%studio%");
    // No tenant id from a caller and no tenant-scope token.
    expect(sql).not.toContain("{partner}");
    expect(params).not.toContain("partner-A");
  });

  it("lists allocations with assigned groups first and a status filter", async () => {
    const { ex, calls } = fakeExecutor(() => []);
    await listAllocations({ status: "assigned" }, ex);
    const { sql, params } = calls[0];
    expect(sql).toContain("FROM fulfilment_group g");
    expect(sql).toContain("g.status = $1");
    expect(sql).toContain("WHEN g.status = 'assigned' THEN 0");
    expect(params[0]).toBe("assigned");
    expect(sql).not.toContain("{partner}");
  });

  it("lists settlement batches with a status filter", async () => {
    const { ex, calls } = fakeExecutor(() => []);
    await listSettlements({ status: "payment_completed" }, ex);
    const { sql, params } = calls[0];
    expect(sql).toContain("FROM settlement_batch");
    expect(sql).toContain("status = $1");
    expect(params[0]).toBe("payment_completed");
  });

  it("caps limit and normalises offset so a caller cannot request everything", async () => {
    const { ex, calls } = fakeExecutor(() => []);
    await listAllPartners({ limit: 99999, offset: -5 }, ex);
    const { params } = calls[0];
    expect(params[params.length - 2]).toBe(500);
    expect(params[params.length - 1]).toBe(0);
  });

  it("builds the overview from all four platform tables and derives the summary", async () => {
    const { ex, calls } = fakeExecutor((sql) => {
      if (sql.includes("FROM partner p")) {
        return [{ account_status: "active", verification_status: "verified" }];
      }
      if (sql.includes("FROM fulfilment_group")) return [{ status: "assigned" }];
      if (sql.includes("FROM settlement_batch")) return [{ status: "calculated" }];
      if (sql.includes("FROM partner_earnings_ledger")) {
        return [{ entry_type: "earning", payable_amount: "10", commission_amount: "1", currency: "INR" }];
      }
      return [];
    });

    const overview = await getMarketplaceOverview(ex);
    expect(calls).toHaveLength(4);
    expect(overview.summary.totalPartners).toBe(1);
    expect(overview.summary.verifiedPartners).toBe(1);
    expect(overview.summary.awaitingAcceptance).toBe(1);
    expect(overview.summary.totalPayable).toBe(10);
    expect(overview.settlements).toHaveLength(1);
    expect(overview.partners).toHaveLength(1);
  });
});

/* ── static security assertions ──────────────────────────────────────────── */

const owned = [
  "lib/admin-marketplace/overview.ts",
  "app/api/admin/marketplace/overview/route.ts",
  "app/admin/marketplace/page.tsx",
  "app/admin/marketplace/partners/page.tsx",
  "app/admin/marketplace/allocations/page.tsx",
  "app/admin/marketplace/settlements/page.tsx",
].map((p) => ({ p, source: readFileSync(join(root, p), "utf8") }));

describe("admin marketplace access control (static)", () => {
  it("the overview route calls requirePermission('partners:read')", () => {
    const route = owned.find((f) => f.p.includes("api/admin/marketplace"))!.source;
    expect(route).toMatch(/requirePermission\(\s*["']partners:read["']\s*\)/);
  });

  it("the route distinguishes unauthenticated (401) from forbidden and blocks the partner role", () => {
    const route = owned.find((f) => f.p.includes("api/admin/marketplace"))!.source;
    expect(route).toMatch(/getAdminIdentity/);
    expect(route).toMatch(/status: 401/);
    expect(route).toMatch(/identity\.role === ["']partner["']/);
    expect(route).toMatch(/status: 403/);
  });

  it("every page is gated by requirePermission('partners:read')", () => {
    const pages = owned.filter((f) => f.p.includes("app/admin/marketplace/"));
    expect(pages).toHaveLength(4);
    for (const page of pages) {
      expect(page.source, `${page.p} must gate the marketplace`).toMatch(
        /requirePermission\(\s*["']partners:read["']\s*\)/
      );
      expect(page.source, `${page.p} must block the partner-tenant role`).toMatch(
        /identity\.role === ["']partner["']/
      );
    }
  });

  it("no file uses partner-facing context — platform queries only", () => {
    const forbidden = [
      "resolvePartnerContext",
      "requirePartnerContext",
      "requirePartnerPermission",
      "tenantQuery",
      "buildScopedStatement",
      "@/lib/partner",
      "{partner}",
      "PARTNER_SESSION_COOKIE",
    ];
    for (const file of owned) {
      for (const token of forbidden) {
        expect(file.source, `${file.p} must not reference ${token}`).not.toContain(token);
      }
    }
  });

  it("the data layer reads migrations 002-004 over the shared query helper", () => {
    const lib = owned.find((f) => f.p === "lib/admin-marketplace/overview.ts")!.source;
    expect(lib).toMatch(/import\s*\{[^}]*\bquery\b[^}]*\}\s*from\s*["']@\/lib\/db["']/);
    for (const table of [
      "FROM partner ",
      "site_artist",
      "FROM fulfilment_group",
      "FROM settlement_batch",
      "FROM partner_earnings_ledger",
    ]) {
      expect(lib, `must query ${table}`).toContain(table);
    }
  });
});
