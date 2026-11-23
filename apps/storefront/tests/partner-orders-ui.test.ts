import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PartnerContext } from "@/lib/partner/types";
import { listPartnerGroups, getPartnerGroup } from "@/lib/fulfilment/store";

// No live database: every store call is driven through an injected executor.
vi.mock("@/lib/db", () => ({
  query: vi.fn(async () => []),
  queryResult: vi.fn(async () => ({ rows: [], rowCount: 0 })),
  transaction: vi.fn(),
  getPool: vi.fn(),
}));

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const LIST_PAGE = "app/partner/orders/page.tsx";
const DETAIL_PAGE = "app/partner/orders/[id]/page.tsx";
const ACTIONS = "app/partner/orders/[id]/order-actions.tsx";
const VIEW_HELPERS = "lib/partner/order-view.ts";

const listSource = read(LIST_PAGE);
const viewSource = read(VIEW_HELPERS);
const detailSource = read(DETAIL_PAGE);
const actionsSource = read(ACTIONS);

const ctxA: PartnerContext = {
  partnerId: "partner-A",
  membershipId: "member-A",
  email: "ops@partner-a.test",
  role: "operations",
  tokenVersion: 1,
};

interface GroupRow {
  id: string;
  partner_id: string;
  customer_order_id: string;
  status: string;
  items: unknown[];
  fulfilment_deadline: string | null;
  assignment_history: unknown[];
}

const DB_GROUPS: GroupRow[] = [
  {
    id: "own-1",
    partner_id: "partner-A",
    customer_order_id: "order-A",
    status: "assigned",
    items: [{ item_id: "i1", title: "Scarf", quantity: 2 }],
    fulfilment_deadline: "2026-12-01T00:00:00Z",
    assignment_history: [{ at: "2026-11-01T00:00:00Z", from: null, to: "assigned", actor: "admin" }],
  },
  {
    id: "foreign-1",
    partner_id: "partner-B",
    customer_order_id: "order-B",
    status: "delivered",
    items: [{ item_id: "i2", title: "Secret", quantity: 9 }],
    fulfilment_deadline: null,
    assignment_history: [],
  },
];

/** Emulates the DB applying the {partner} predicate bound by buildScopedStatement. */
function scopedExecutor(rows: GroupRow[], calls: Array<{ sql: string; params: any[] }> = []) {
  return async (sql: string, params: any[] = []) => {
    calls.push({ sql, params });
    const boundPartner = params[params.length - 1];
    // Only the detail query has a bare `id = $1`; the list query's
    // `partner_id = $1` must not be mistaken for an id filter.
    const byId = /\sid = \$1/.test(sql) ? params[0] : null;
    return rows.filter(
      (r) => r.partner_id === boundPartner && (!byId || r.id === byId)
    );
  };
}

describe("partner orders pages call ONLY the tenant-scoped store functions", () => {
  const allowedImports = new Set([
    "next/link",
    "next/navigation",
    "@/lib/partner/context",
    "@/lib/partner/rbac",
    "@/lib/fulfilment/store",
    "@/lib/fulfilment/types",
    "@/lib/partner/order-view",
    "./order-actions",
  ]);

  it("list page imports requirePartnerPermission + listPartnerGroups, nothing unscoped", () => {
    const specifiers = Array.from(listSource.matchAll(/from\s+["']([^"']+)["']/g)).map(
      (m) => m[1]
    );
    for (const spec of specifiers) {
      expect(allowedImports.has(spec), `list page imported unexpected module: ${spec}`).toBe(true);
    }
    expect(listSource).toMatch(/requirePartnerPermission\(["']orders:read["']\)/);
    expect(listSource).toMatch(/listPartnerGroups\(ctx\)/);
    expect(listSource).not.toMatch(/getGroupById|listGroupsForOrder|reassignGroup|tenantQuery/);
    expect(listSource).not.toMatch(/@\/lib\/db|@\/app\/admin|@\/lib\/admin/);
  });

  it("detail page imports requirePartnerPermission + getPartnerGroup, nothing unscoped", () => {
    const specifiers = Array.from(detailSource.matchAll(/from\s+["']([^"']+)["']/g)).map(
      (m) => m[1]
    );
    for (const spec of specifiers) {
      expect(allowedImports.has(spec), `detail page imported unexpected module: ${spec}`).toBe(true);
    }
    expect(detailSource).toMatch(/requirePartnerPermission\(["']orders:read["']\)/);
    expect(detailSource).toMatch(/getPartnerGroup\(ctx, id\)/);
    expect(detailSource).not.toMatch(/getGroupById|listGroupsForOrder|reassignGroup|tenantQuery/);
    expect(detailSource).not.toMatch(/@\/lib\/db|@\/app\/admin|@\/lib\/admin/);
  });

  it("the scoped store helpers really bind the session partner and hide foreign rows", async () => {
    const calls: Array<{ sql: string; params: any[] }> = [];
    const ex = scopedExecutor(DB_GROUPS, calls);

    const own = await listPartnerGroups(ctxA, ex);
    expect(own.map((g) => g.id)).toEqual(["own-1"]);
    expect(own[0].items).toHaveLength(1);

    expect(await getPartnerGroup(ctxA, "own-1", ex)).not.toBeNull();
    // A manipulated/foreign group id returns null — the UI's not-found case.
    expect(await getPartnerGroup(ctxA, "foreign-1", ex)).toBeNull();

    expect(calls.length).toBeGreaterThanOrEqual(3);
    for (const call of calls) {
      expect(call.sql).toMatch(/partner_id = \$\d+/);
      expect(call.params[call.params.length - 1]).toBe(ctxA.partnerId);
    }
  });
});

describe("foreign id renders not-found UI, never another tenant's data", () => {
  it("detail page calls notFound() immediately when getPartnerGroup returns null", () => {
    expect(detailSource).toMatch(/const group = await getPartnerGroup\(ctx, id\)/);
    expect(detailSource).toMatch(/if \(!group\) notFound\(\)/);
    const guard = detailSource.indexOf("if (!group) notFound();");
    const render = detailSource.lastIndexOf("return (");
    expect(guard).toBeGreaterThan(-1);
    // The not-found guard must run before any JSX that could leak group fields.
    expect(guard).toBeLessThan(render);
  });

  it("foreign id yields no row from the scoped store (runtime proof of the guard)", async () => {
    expect(await getPartnerGroup(ctxA, "foreign-1", scopedExecutor(DB_GROUPS))).toBeNull();
  });
});

describe("no partner id reaches the client; no financial fields are displayed", () => {
  it("server pages never source a tenant id from the request or pass it to the client", () => {
    const sources = [listSource, detailSource];
    for (const source of sources) {
      expect(source).not.toMatch(/searchParams/);
      expect(source).not.toMatch(/headers\(\)/);
      expect(source).not.toMatch(/req\.json|partner_id\s*[:=]/);
      expect(source).not.toMatch(/\bpartnerId\b/);
    }
    // The only client prop is the group id, current status and a boolean RBAC flag.
    expect(detailSource).toMatch(
      /<OrderActions\s+groupId=\{group\.id\}\s+status=\{group\.status\}\s+canWrite=\{canWrite\}/
    );
  });

  it("action buttons POST only to A47's APIs and send no partner id or money fields", () => {
    // The URL is built from a single `action` argument; assert the allowlist of
    // actions and the scoped URL template instead of three literal strings.
    expect(actionsSource).toMatch(/\/api\/partner\/orders\/\$\{encodeURIComponent\(groupId\)\}\/\$\{action\}/);
    for (const action of ["accept", "reject", "fulfil"]) {
      expect(actionsSource, `client missing ${action} action`).toMatch(
        new RegExp(`post\\("${action}"`)
      );
    }
    // The client never receives or sends a partner id.
    expect(actionsSource).not.toMatch(/\bpartnerId\b/);
    expect(actionsSource).not.toMatch(/partner_id/);
    expect(actionsSource).not.toMatch(/headers:\s*\{[^}]*partner/i);
    // Allowed JSON payload keys are strictly operational.
    expect(actionsSource).toMatch(/post\("accept",\s*\{\}\)/);
    expect(actionsSource).toMatch(/post\("reject",\s*\{\s*reason:/);
    expect(actionsSource).toMatch(/to:\s*nextStep/);

    const financialFields = [
      "amount", "price", "unit_price", "subtotal", "grand_total", "gross_total",
      "tax_total", "tax_rate", "discount_total", "shipping_total", "total_amount",
      "payment_id", "payment_status", "payment_collection", "refund_id",
      "refund_amount", "commission_rate", "payout_amount", "currency_code",
      "gstin", "card_last4",
    ];
    for (const field of financialFields) {
      const fieldPattern = new RegExp(`\\b${field}\\b`);
      expect(fieldPattern.test(actionsSource), `client action referenced ${field}`).toBe(false);
      expect(fieldPattern.test(listSource), `list page referenced ${field}`).toBe(false);
      expect(fieldPattern.test(detailSource), `detail page referenced ${field}`).toBe(false);
    }
  });
});

describe("status labels are explicit and cover every status", () => {
  // The helpers live in lib/partner/order-view.ts: Next.js forbids arbitrary
  // named exports from Page modules, so they cannot be defined in the pages.
  it("the shared helper defines human-readable labels for all eight statuses", () => {
    const labels = [
      "Awaiting acceptance",
      "Accepted",
      "Packing",
      "Ready for dispatch",
      "Dispatched",
      "Delivered",
      "Rejected",
      "Cancelled",
    ];
    for (const label of labels) {
      expect(viewSource, `view helper missing label "${label}"`).toContain(label);
    }
    expect(listSource).toContain('from "@/lib/partner/order-view"');
    expect(detailSource).toContain('from "@/lib/partner/order-view"');
  });

  it("statusLabel falls back to a spaced label for unknown statuses", () => {
    expect(viewSource).toContain('replace(/_/g, " ")');
  });

  it("the shared helper buckets by every status and follows the status machine", () => {
    for (const status of [
      "assigned", "accepted", "packing", "ready_for_dispatch",
      "dispatched", "delivered", "rejected", "cancelled",
    ]) {
      expect(viewSource, `view helper missing bucket ${status}`).toContain(`"${status}"`);
    }
    expect(listSource).toContain("STATUS_ORDER");
    expect(detailSource).toContain("fulfilmentTimeline");
  });
});
