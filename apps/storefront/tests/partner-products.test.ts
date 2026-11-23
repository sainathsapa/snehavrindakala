/**
 * Partner product submissions: real library logic against an in-memory DB fake.
 *
 * Two tenants (A and B) share one fake `partner_product` table. The executor
 * rejects any SELECT/UPDATE without a bound partner predicate, so a test passes
 * only if the production code really scopes through `tenantQuery`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PartnerContext } from "@/lib/partner/types";

const state = vi.hoisted(() => {
  const rows: any[] = [];
  const calls: Array<{ sql: string; params: any[] }> = [];
  let seq = 0;
  let currentPartnerId = "partner-A";
  let deny = false;

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
    if (/^INSERT/i.test(flat)) {
      const [productId, attributesJson, partnerId] = params;
      if (partnerId !== tenant) throw new Error("Insert partner id is not the scoped tenant");
      const now = new Date().toISOString();
      const row = {
        id: `pp-${++seq}`,
        partner_id: partnerId,
        product_id: productId,
        submission_status: "draft",
        attributes: JSON.parse(attributesJson),
        rejection_reason: null,
        submitted_at: null,
        reviewed_by: null,
        reviewed_at: null,
        created_at: now,
        updated_at: now,
      };
      rows.push(row);
      return [clone(row)];
    }
    if (/^UPDATE/i.test(flat)) {
      if (!/partner_id = \$\d+/.test(flat)) throw new Error("Unscoped UPDATE rejected by fake DB");
      const id = params[params.length - 2];
      const idx = rows.findIndex((r) => r.id === id && r.partner_id === tenant);
      if (idx < 0) return [];
      const row = rows[idx];
      if (!["draft", "rejected"].includes(row.submission_status)) return [];
      if (/submission_status = 'submitted'/.test(flat)) {
        row.submission_status = "submitted";
        row.submitted_at = new Date().toISOString();
        row.rejection_reason = null;
      }
      if (/attributes = \$1::jsonb/.test(flat)) row.attributes = JSON.parse(params[0]);
      row.updated_at = new Date().toISOString();
      return [clone(row)];
    }
    throw new Error(`Unexpected SQL: ${flat}`);
  };

  return {
    rows,
    calls,
    executor,
    setCurrentPartner: (id: string) => { currentPartnerId = id; },
    setDeny: (value: boolean) => { deny = value; },
    currentPartner: () => currentPartnerId,
    isDenied: () => deny,
    reset: () => {
      rows.length = 0;
      calls.length = 0;
      currentPartnerId = "partner-A";
      deny = false;
    },
    /** Simulate the platform admin's decision, which partners cannot perform. */
    decide: (id: string, status: string, reason: string | null = null) => {
      const row = rows.find((r) => r.id === id);
      if (!row) throw new Error("Unknown row");
      row.submission_status = status;
      row.rejection_reason = reason;
      row.reviewed_at = new Date().toISOString();
      row.reviewed_by = "admin@test";
    },
  };
});

vi.mock("@/lib/db", () => ({
  query: (sql: string, params: any[]) => state.executor(sql, params),
  queryResult: async () => ({ rows: [] }),
  transaction: async <T,>(fn: (ex: typeof state.executor) => Promise<T>) => fn(state.executor),
  getPool: () => ({}),
}));

vi.mock("@/lib/partner/context", () => {
  const ctx = (): PartnerContext => ({
    partnerId: state.currentPartner(),
    membershipId: `member-${state.currentPartner()}`,
    email: `${state.currentPartner()}@partner.test`,
    role: "owner",
    tokenVersion: 1,
  });
  return {
    requirePartnerContext: async () => (state.isDenied() ? null : ctx()),
    requirePartnerPermission: async () => (state.isDenied() ? null : ctx()),
  };
});

import {
  createSubmission,
  getProduct,
  listProducts,
  submitForApproval,
  updateSubmission,
  readProductDetails,
  ProductNotFoundError,
  ProductStateError,
} from "@/lib/partner-portal/products";
import { GET as listRoute, POST as createRoute } from "@/app/api/partner/products/route";
import {
  GET as detailRoute,
  PATCH as patchRoute,
} from "@/app/api/partner/products/[id]/route";

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
  role: "owner",
  tokenVersion: 1,
};

const input = (title: string) => ({
  title,
  description: "A real work described by the maker.",
  attributes: { material: "silk" },
  variants: [{ title: "Default", sku: "SK-1" }],
  pricing: { amount: 4500, currency_code: "inr" },
  images: ["/uploads/products/example.jpg"],
});

function routeCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}
function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/partner/products", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => state.reset());

describe("createSubmission — tenant binding and jsonb storage", () => {
  it("binds partner_id from ctx only, discarding a partner_id in the input", async () => {
    const row = await createSubmission(
      partnerA,
      { ...input("Silk stole"), ...({ partner_id: "partner-B" } as any) },
      state.executor
    );
    expect(row.partner_id).toBe("partner-A");
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0].partner_id).toBe("partner-A");
    expect(row.submission_status).toBe("draft");

    const insert = state.calls.find((c) => c.sql.startsWith("INSERT"))!;
    // The builder replaced {partner} with the next free placeholder ($3 here).
    expect(insert.sql).toContain("(partner_id, product_id,");
    expect(insert.sql).toContain("VALUES ($3, $1, 'draft', $2::jsonb");
    expect(insert.sql).not.toContain("{partner}");
    expect(insert.params[2]).toBe("partner-A");
    expect(insert.params[0]).toMatch(/^pending:/);

    const details = readProductDetails(row);
    expect(details.title).toBe("Silk stole");
    expect(details.pricing).toEqual({ amount: 4500, currency_code: "inr" });
    expect(details.attributes).toEqual({ material: "silk" });
    expect(details.images).toEqual([{ url: "/uploads/products/example.jpg" }]);
  });

  it("uses a caller's real product reference when supplied", async () => {
    const row = await createSubmission(
      partnerA,
      { ...input("Linked work"), productId: "prod_123" },
      state.executor
    );
    expect(row.product_id).toBe("prod_123");
  });

  it("rejects image bytes / unsafe URL schemes", async () => {
    await expect(
      createSubmission(partnerA, { ...input("Bad image"), images: ["data:image/png;base64,AAAA"] }, state.executor)
    ).rejects.toThrow(/http\(s\)/);
    expect(state.rows).toHaveLength(0);
  });
});

describe("tenant isolation — A cannot touch B's product even with the id", () => {
  async function seed() {
    const b = await createSubmission(partnerB, input("B's work"), state.executor);
    return b;
  }

  it("listProducts returns only the caller's rows", async () => {
    await createSubmission(partnerA, input("A's work"), state.executor);
    await seed();
    const rows = await listProducts(partnerA, state.executor);
    expect(rows.map((r) => r.submission_status)).toEqual(["draft"]);
    expect(rows.every((r) => r.partner_id === "partner-A")).toBe(true);
    const call = state.calls.find((c) => c.sql.startsWith("SELECT"))!;
    expect(call.sql).toContain("partner_id = $1");
    expect(call.params).toEqual(["partner-A"]);
  });

  it("getProduct returns null for a foreign id", async () => {
    const b = await seed();
    expect(await getProduct(partnerA, b.id, state.executor)).toBeNull();
    const call = state.calls[state.calls.length - 1];
    expect(call.sql).toContain("partner_id = $2");
    expect(call.params).toEqual([b.id, "partner-A"]);
  });

  it("updateSubmission does not modify a foreign row", async () => {
    const b = await seed();
    await expect(
      updateSubmission(partnerA, b.id, { title: "Hijacked" }, state.executor)
    ).rejects.toBeInstanceOf(ProductNotFoundError);
    expect(state.rows[0].attributes.title).toBe("B's work");
    expect(state.calls.some((c) => c.sql.startsWith("UPDATE"))).toBe(false);
  });

  it("submitForApproval does not submit a foreign row", async () => {
    const b = await seed();
    await expect(
      submitForApproval(partnerA, b.id, state.executor)
    ).rejects.toBeInstanceOf(ProductNotFoundError);
    expect(state.rows[0].submission_status).toBe("draft");
  });

  it("every statement that touched partner data carried a bound tenant predicate", () => {
    return seed().then(async () => {
      await listProducts(partnerA, state.executor);
      await getProduct(partnerB, "pp-1", state.executor);
      for (const call of state.calls) {
        // SELECT/UPDATE use `partner_id = $n`; INSERT binds it in `VALUES ($n …)`.
        expect(call.sql).toMatch(/partner_id = \$\d+|VALUES \(\$\d+/);
        expect(call.params[call.params.length - 1]).toMatch(/^partner-[AB]$/);
      }
    });
  });
});

describe("approval workflow — draft/rejected editable, approved frozen", () => {
  it("edits a draft by merging jsonb fields", async () => {
    const row = await createSubmission(partnerA, input("Original"), state.executor);
    const updated = await updateSubmission(
      partnerA,
      row.id,
      { title: "Edited", attributes: { dimensions: "70x180" } },
      state.executor
    );
    const details = readProductDetails(updated);
    expect(details.title).toBe("Edited");
    expect(details.attributes).toEqual({ material: "silk", dimensions: "70x180" });
    const update = state.calls.find((c) => c.sql.startsWith("UPDATE"))!;
    expect(update.sql).toContain("partner_id = $3");
    expect(update.params[update.params.length - 1]).toBe("partner-A");
  });

  it("sets submitted status on submit and clears a prior rejection reason", async () => {
    const row = await createSubmission(partnerA, input("Submit me"), state.executor);
    const submitted = await submitForApproval(partnerA, row.id, state.executor);
    expect(submitted.submission_status).toBe("submitted");
    expect(submitted.submitted_at).toBeTruthy();

    state.decide(row.id, "rejected", "Please add dimensions.");
    expect(state.rows[0].rejection_reason).toBe("Please add dimensions.");
    const resubmitted = await submitForApproval(partnerA, row.id, state.executor);
    expect(resubmitted.submission_status).toBe("submitted");
    expect(resubmitted.rejection_reason).toBeNull();
    const stmt = state.calls.filter((c) => c.sql.startsWith("UPDATE")).at(-1)!;
    expect(stmt.sql).toContain("submission_status = 'submitted'");
    expect(stmt.sql).toContain("partner_id = $2");
  });

  it("approved submissions cannot be edited or resubmitted by a partner", async () => {
    const row = await createSubmission(partnerA, input("Approved work"), state.executor);
    state.decide(row.id, "approved");
    await expect(
      updateSubmission(partnerA, row.id, { title: "Sneaky edit" }, state.executor)
    ).rejects.toBeInstanceOf(ProductStateError);
    await expect(
      submitForApproval(partnerA, row.id, state.executor)
    ).rejects.toBeInstanceOf(ProductStateError);
    expect(state.rows[0].attributes.title).toBe("Approved work");
    expect(state.rows[0].submission_status).toBe("approved");
  });

  it("submitted submissions are immutable until a decision comes back", async () => {
    const row = await createSubmission(partnerA, input("In review"), state.executor);
    await submitForApproval(partnerA, row.id, state.executor);
    await expect(
      updateSubmission(partnerA, row.id, { title: "Too late" }, state.executor)
    ).rejects.toBeInstanceOf(ProductStateError);
  });
});

describe("API routes — body tenant keys rejected, context always used", () => {
  it("POST rejects partner_id in the body with 400 and inserts nothing", async () => {
    const res = await createRoute(jsonRequest({ ...input("Body tenant"), partner_id: "partner-B" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/partner_id/);
    expect(state.rows).toHaveLength(0);
  });

  it("PATCH rejects partnerId in the body with 400", async () => {
    const res = await patchRoute(jsonRequest({ title: "x", partnerId: "partner-B" }), routeCtx("pp-1"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/partner_id/);
  });

  it("POST creates a draft owned by the session partner; GET lists only theirs", async () => {
    const created = await createRoute(jsonRequest(input("From the API")));
    expect(created.status).toBe(201);
    const body = await created.json();
    expect(body.product.partner_id).toBe("partner-A");
    expect(state.rows[0].partner_id).toBe("partner-A");

    const listed = await listRoute();
    expect(listed.status).toBe(200);
    const listBody = await listed.json();
    expect(listBody.products).toHaveLength(1);
  });

  it("GET detail of B's id as A returns 404", async () => {
    const row = await createSubmission(partnerB, input("B only"), state.executor);
    state.setCurrentPartner("partner-A");
    const res = await detailRoute(new Request("http://localhost"), routeCtx(row.id));
    expect(res.status).toBe(404);
  });

  it("PATCH with action=submit submits only A's own draft", async () => {
    const created = await createRoute(jsonRequest(input("Submit via API")));
    const id = (await created.json()).product.id;
    const res = await patchRoute(jsonRequest({ action: "submit" }), routeCtx(id));
    expect(res.status).toBe(200);
    expect((await res.json()).product.submission_status).toBe("submitted");
  });

  it("requests without a partner session are denied", async () => {
    state.setDeny(true);
    expect((await listRoute()).status).toBe(401);
    expect((await createRoute(jsonRequest(input("x")))).status).toBe(403);
    expect((await detailRoute(new Request("http://localhost"), routeCtx("pp-1"))).status).toBe(401);
    expect((await patchRoute(jsonRequest({ action: "submit" }), routeCtx("pp-1"))).status).toBe(403);
  });
});
