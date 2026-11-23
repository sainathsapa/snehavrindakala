/**
 * AGENT A71 — Independent QA (Scenario C): adversarial tenant isolation.
 *
 * This suite does NOT trust the repository helpers to "do the right thing". It
 * stands up a fake executor that behaves like a real database applying
 * `WHERE partner_id = $n` against a dataset that contains rows for BOTH tenants.
 * If any helper drops the tenant predicate, binds a client value in place of the
 * server context, or lets a resource id escape the tenant scope, these tests
 * fail by either (a) seeing a foreign row, or (b) seeing a foreign partner id in
 * the bound parameters.
 */

import { describe, expect, it, vi } from "vitest";
import {
  buildScopedStatement,
  tenantQuery,
  getPartnerProfile,
  listPartnerProducts,
  getPartnerProduct,
  listPartnerFulfilmentGroups,
  getPartnerFulfilmentGroup,
  getPartnerEarnings,
  listPartnerMembers,
  getFulfilmentCustomer,
  type QueryExecutor,
} from "@/lib/partner/repository";
import type { PartnerContext } from "@/lib/partner/types";

// No live database: repository's default executor must never be reached.
vi.mock("@/lib/db", () => ({
  query: vi.fn(async () => []),
  queryResult: vi.fn(async () => ({ rows: [], rowCount: 0 })),
  transaction: vi.fn(),
  getPool: vi.fn(),
}));

const PARTNER_A = "partner-A";
const PARTNER_B = "partner-B";

const ctxA: PartnerContext = {
  partnerId: PARTNER_A,
  membershipId: "member-A1",
  email: "a@partner.test",
  role: "owner",
  tokenVersion: 1,
};

const ctxB: PartnerContext = {
  partnerId: PARTNER_B,
  membershipId: "member-B1",
  email: "b@partner.test",
  role: "owner",
  tokenVersion: 1,
};

interface Row {
  [key: string]: any;
  id?: string;
  partner_id?: string;
}

function makeFakeDb() {
  return {
    // The partner table's own key IS the partner id (getPartnerProfile binds
    // ctx.partnerId to `id`, not to `partner_id`).
    partners: [
      { id: PARTNER_A, display_name: "Partner A", account_status: "active" },
      { id: PARTNER_B, display_name: "Partner B", account_status: "active" },
    ],
    products: [
      { id: "prod-A1", partner_id: PARTNER_A, title: "A one" },
      { id: "prod-A2", partner_id: PARTNER_A, title: "A two" },
      { id: "prod-B1", partner_id: PARTNER_B, title: "B one" },
    ],
    groups: [
      {
        id: "group-A1",
        partner_id: PARTNER_A,
        items: [],
        customer_order_id: "order-A1",
        status: "pending",
      },
      {
        id: "group-B1",
        partner_id: PARTNER_B,
        items: [],
        customer_order_id: "order-B1",
        status: "pending",
      },
    ],
    earnings: [
      { id: "earn-A1", partner_id: PARTNER_A, amount: 100 },
      { id: "earn-B1", partner_id: PARTNER_B, amount: 999 },
    ],
    members: [
      {
        id: "member-A1",
        partner_id: PARTNER_A,
        email: "a@partner.test",
        role: "owner",
        status: "active",
        token_version: 1,
      },
      {
        id: "member-B1",
        partner_id: PARTNER_B,
        email: "b@partner.test",
        role: "owner",
        status: "active",
        token_version: 1,
      },
    ],
  };
}

type Db = ReturnType<typeof makeFakeDb>;

/** Index of the bound parameter that an `=<column> = $N` predicate resolves to. */
function paramIndexOf(sql: string, column: "id" | "partner_id"): number | null {
  // \b before `id` prevents accidentally matching the `id` inside `partner_id`.
  const re =
    column === "partner_id"
      ? /\bpartner_id\s*=\s*\$(\d+)/i
      : /\bid\s*=\s*\$(\d+)/i;
  const match = re.exec(sql);
  return match ? Number(match[1]) - 1 : null;
}

/**
 * Simulates the database applying the tenant predicate that the repository
 * supplied. Crucially, the tenant id is read from the BOUND PARAMETER in the
 * SQL, not from a test-side variable — so a missing/misbound predicate cannot
 * accidentally still return the "expected" rows.
 */
function makeExecutor(db: Db = makeFakeDb()) {
  type Call = { sql: string; params: any[] };
  const calls: Call[] = [];

  const executor: QueryExecutor = async (sql: string, params: any[] = []) => {
    calls.push({ sql, params });
    const table = (/\bFROM\s+(\w+)/i.exec(sql)?.[1] ?? "").toLowerCase();
    const partnerIdx =
      table === "partner"
        ? paramIndexOf(sql, "id") // partner table PK is the partner id
        : paramIndexOf(sql, "partner_id");
    const scopedPartnerId = partnerIdx === null ? null : params[partnerIdx];
    const resourceIdIdx = paramIndexOf(sql, "id");

    let rows: Row[] = [];
    switch (table) {
      case "partner":
        rows = db.partners.filter((r) => r.id === scopedPartnerId);
        break;
      case "partner_product":
        rows = db.products.filter(
          (r) =>
            r.partner_id === scopedPartnerId &&
            (resourceIdIdx === null || r.id === params[resourceIdIdx])
        );
        break;
      case "fulfilment_group":
        rows = db.groups.filter(
          (r) =>
            r.partner_id === scopedPartnerId &&
            (resourceIdIdx === null || r.id === params[resourceIdIdx])
        );
        break;
      case "partner_earnings_ledger":
        rows = db.earnings.filter((r) => r.partner_id === scopedPartnerId);
        break;
      case "partner_membership":
        rows = db.members.filter(
          (r) =>
            r.partner_id === scopedPartnerId &&
            (resourceIdIdx === null || r.id === params[resourceIdIdx])
        );
        break;
      default:
        rows = [];
    }
    return rows;
  };

  return { executor, calls };
}

async function runQuery(fn: (executor: QueryExecutor) => Promise<any[]>) {
  const { executor, calls } = makeExecutor();
  const rows = await fn(executor);
  return { rows, call: calls[0], calls };
}

/** Every scoped call must carry exactly the caller's tenant id, never the other's. */
function expectScopedTo(call: Call, partnerId: string) {
  const other = partnerId === PARTNER_A ? PARTNER_B : PARTNER_A;
  expect(call.params).toContain(partnerId);
  expect(call.params).not.toContain(other);
  const tenantTokens = call.params.filter(
    (p) => typeof p === "string" && p.startsWith("partner-")
  );
  expect(tenantTokens).toEqual([partnerId]);
  if (partnerId === PARTNER_A || partnerId === PARTNER_B) {
    if (!call.sql.includes("FROM partner WHERE")) {
      expect(call.sql).toMatch(/partner_id\s*=\s*\$\d+/);
    }
  }
}

type Call = { sql: string; params: any[] };

/* ─────────────────────────────────────────────────────────────────────────── */

describe("A71 — cross-partner isolation: every tenant-owned resource", () => {
  describe("context A sees only A's rows", () => {
    it("profile: only partner A's row, scoped by its id", async () => {
      const { rows, call } = await runQuery((ex) => getPartnerProfile(ctxA, ex));
      expectScopedTo(call, PARTNER_A);
      expect(rows.map((r) => r.id)).toEqual([PARTNER_A]);
      expect(rows.every((r) => r.id !== PARTNER_B)).toBe(true);
    });

    it("products list: no partner B product leaks", async () => {
      const { rows, call } = await runQuery((ex) => listPartnerProducts(ctxA, ex));
      expectScopedTo(call, PARTNER_A);
      expect(rows.map((r) => r.id).sort()).toEqual(["prod-A1", "prod-A2"]);
      expect(rows.some((r) => r.partner_id === PARTNER_B)).toBe(false);
    });

    it("product by id: A reads its own product", async () => {
      const { rows, call } = await runQuery((ex) =>
        getPartnerProduct(ctxA, "prod-A1", ex)
      );
      expectScopedTo(call, PARTNER_A);
      expect(rows.map((r) => r.id)).toEqual(["prod-A1"]);
    });

    it("product by id: a foreign product id returns no row", async () => {
      const { rows, call } = await runQuery((ex) =>
        getPartnerProduct(ctxA, "prod-B1", ex)
      );
      expectScopedTo(call, PARTNER_A);
      expect(call.params).toContain("prod-B1");
      expect(rows).toEqual([]);
    });

    it("fulfilment groups list: no partner B group leaks", async () => {
      const { rows, call } = await runQuery((ex) =>
        listPartnerFulfilmentGroups(ctxA, ex)
      );
      expectScopedTo(call, PARTNER_A);
      expect(rows.map((r) => r.id)).toEqual(["group-A1"]);
      expect(rows.some((r) => r.partner_id === PARTNER_B)).toBe(false);
    });

    it("fulfilment group by id: foreign group returns no row", async () => {
      const own = await runQuery((ex) => getPartnerFulfilmentGroup(ctxA, "group-A1", ex));
      expectScopedTo(own.call, PARTNER_A);
      expect(own.rows.map((r) => r.id)).toEqual(["group-A1"]);

      const foreign = await runQuery((ex) =>
        getPartnerFulfilmentGroup(ctxA, "group-B1", ex)
      );
      expectScopedTo(foreign.call, PARTNER_A);
      expect(foreign.rows).toEqual([]);
    });

    it("earnings: no partner B ledger row leaks", async () => {
      const { rows, call } = await runQuery((ex) => getPartnerEarnings(ctxA, ex));
      expectScopedTo(call, PARTNER_A);
      expect(rows.map((r) => r.id)).toEqual(["earn-A1"]);
      expect(rows.some((r) => r.partner_id === PARTNER_B)).toBe(false);
    });

    it("members: no partner B membership leaks", async () => {
      const { rows, call } = await runQuery((ex) => listPartnerMembers(ctxA, ex));
      expectScopedTo(call, PARTNER_A);
      expect(rows.map((r) => r.id)).toEqual(["member-A1"]);
      expect(rows.some((r) => r.partner_id === PARTNER_B)).toBe(false);
    });

    it("fulfilment customer: foreign group id returns no row", async () => {
      const own = await runQuery((ex) => getFulfilmentCustomer(ctxA, "group-A1", ex));
      expectScopedTo(own.call, PARTNER_A);
      expect(own.rows).toHaveLength(1);
      expect(own.rows[0].id).toBe("group-A1");

      const foreign = await runQuery((ex) =>
        getFulfilmentCustomer(ctxA, "group-B1", ex)
      );
      expectScopedTo(foreign.call, PARTNER_A);
      expect(foreign.rows).toEqual([]);
    });
  });

  describe("context B is symmetric — isolation holds in both directions", () => {
    it("B's list reads return only B rows and never A's id", async () => {
      const cases: Array<{
        name: string;
        run: (ex: QueryExecutor) => Promise<any[]>;
        expected: string[];
      }> = [
        { name: "profile", run: (ex) => getPartnerProfile(ctxB, ex), expected: [PARTNER_B] },
        { name: "products", run: (ex) => listPartnerProducts(ctxB, ex), expected: ["prod-B1"] },
        { name: "groups", run: (ex) => listPartnerFulfilmentGroups(ctxB, ex), expected: ["group-B1"] },
        { name: "earnings", run: (ex) => getPartnerEarnings(ctxB, ex), expected: ["earn-B1"] },
        { name: "members", run: (ex) => listPartnerMembers(ctxB, ex), expected: ["member-B1"] },
      ];
      for (const c of cases) {
        const { rows, call } = await runQuery(c.run);
        expectScopedTo(call, PARTNER_B);
        const ids = rows.map((r: any) => r.id ?? r.group_id);
        expect(ids, c.name).toEqual(c.expected);
        expect(ids, c.name).not.toContain(PARTNER_A);
      }
    });

    it("B cannot read A's product/group/fulfilment customer by id", async () => {
      const foreignIds = ["prod-A1", "group-A1"];
      for (const id of foreignIds) {
        const byId =
          id.startsWith("prod-")
            ? await runQuery((ex) => getPartnerProduct(ctxB, id, ex))
            : await runQuery((ex) => getPartnerFulfilmentGroup(ctxB, id, ex));
        expectScopedTo(byId.call, PARTNER_B);
        expect(byId.rows, id).toEqual([]);
      }
      const customer = await runQuery((ex) => getFulfilmentCustomer(ctxB, "group-A1", ex));
      expectScopedTo(customer.call, PARTNER_B);
      expect(customer.rows).toEqual([]);
    });
  });

  describe("identifier manipulation cannot widen the scope", () => {
    it("an injected id string is bound as data and returns no row", async () => {
      const injection = "x' OR '1'='1 --";
      const { rows, call } = await runQuery((ex) =>
        getPartnerProduct(ctxA, injection, ex)
      );
      expectScopedTo(call, PARTNER_A);
      expect(call.params[0]).toBe(injection);
      expect(call.params).toContain(PARTNER_A);
      expect(rows).toEqual([]);
    });

    it("passing another tenant's partner id as the resource id does not cross tenants", async () => {
      // The resource-id parameter is attacker-controlled here; the tenant
      // parameter must still be the server-derived A. Expect the exact binding.
      const { rows, call } = await runQuery((ex) =>
        getPartnerProduct(ctxA, PARTNER_B, ex)
      );
      expect(call.sql).toContain("id = $1 AND partner_id = $2");
      expect(call.params).toEqual([PARTNER_B, PARTNER_A]);
      expect(rows).toEqual([]);
    });
  });

  describe("buildScopedStatement — the central invariant", () => {
    it("binds ctx.partnerId as the LAST parameter, never a client-supplied value", () => {
      const stmt = buildScopedStatement(
        ctxA,
        "SELECT * FROM partner_product WHERE id = $1 AND partner_id = {partner}",
        ["prod-B1"] // attacker-controlled value in the ordinary params
      );
      expect(stmt.sql).toBe(
        "SELECT * FROM partner_product WHERE id = $1 AND partner_id = $2"
      );
      expect(stmt.params).toEqual(["prod-B1", PARTNER_A]);
      expect(stmt.params).not.toContain(PARTNER_B);
    });

    it("replaces every {partner} token with the same bound placeholder", () => {
      const stmt = buildScopedStatement(
        ctxA,
        "SELECT * FROM t WHERE a.partner_id = {partner} OR b.partner_id = {partner}",
        []
      );
      expect(stmt.sql).toBe(
        "SELECT * FROM t WHERE a.partner_id = $1 OR b.partner_id = $1"
      );
      expect(stmt.params).toEqual([PARTNER_A]);
    });

    it("throws when the {partner} token is missing", () => {
      expect(() => buildScopedStatement(ctxA, "SELECT * FROM partner_product")).toThrow(
        /without \{partner\} predicate/
      );
    });

    it("throws when there is no authenticated partner context", () => {
      expect(() =>
        buildScopedStatement(
          null as any,
          "SELECT * FROM partner_product WHERE partner_id = {partner}"
        )
      ).toThrow(/Partner context required/);
      expect(() =>
        buildScopedStatement(
          { ...ctxA, partnerId: "" },
          "SELECT * FROM partner_product WHERE partner_id = {partner}"
        )
      ).toThrow(/Partner context required/);
    });
  });

  describe("negative: a scope-less query must never execute", () => {
    it("tenantQuery throws on SQL without {partner} and does not call the executor", async () => {
      const { executor, calls } = makeExecutor();
      await expect(
        tenantQuery(ctxA, "SELECT * FROM partner_product", [], executor)
      ).rejects.toThrow(/\{partner\}/);
      expect(calls).toHaveLength(0);
    });

    it("tenantQuery refuses a null context before touching the executor", async () => {
      const { executor, calls } = makeExecutor();
      await expect(
        tenantQuery(
          null as any,
          "SELECT * FROM partner_product WHERE partner_id = {partner}",
          [],
          executor
        )
      ).rejects.toThrow(/Partner context required/);
      expect(calls).toHaveLength(0);
    });
  });
});
