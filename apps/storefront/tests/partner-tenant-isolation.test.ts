import { describe, it, expect } from "vitest";
import {
  buildScopedStatement,
  tenantQuery,
  getPartnerProduct,
  getPartnerFulfilmentGroup,
} from "@/lib/partner/repository";
import {
  signPartnerSession,
  verifyPartnerToken,
  PARTNER_SESSION_COOKIE,
} from "@/lib/partner/session";
import { hashPassword, verifyPassword } from "@/lib/partner/password";
import { partnerHasPermission } from "@/lib/partner/rbac";
import { resolvePartnerContext } from "@/lib/partner/context";
import { signAdminSession } from "@/lib/admin-session";
import type { PartnerContext } from "@/lib/partner/types";

const ctx: PartnerContext = {
  partnerId: "partner-A",
  membershipId: "member-A",
  email: "a@partner.test",
  role: "owner",
  tokenVersion: 1,
};

function fakeExecutor(rows: any[] = []) {
  const calls: Array<{ sql: string; params: any[] }> = [];
  const executor = async (sql: string, params: any[] = []) => {
    calls.push({ sql, params });
    return rows;
  };
  return { executor, calls };
}

describe("tenant scope builder — the central isolation invariant", () => {
  it("refuses a query that forgot the {partner} predicate", () => {
    expect(() => buildScopedStatement(ctx, "SELECT * FROM product")).toThrow(
      /without \{partner\} predicate/
    );
  });

  it("refuses a query without an authenticated context", () => {
    expect(() =>
      buildScopedStatement(null as any, "SELECT * FROM product WHERE partner_id = {partner}")
    ).toThrow(/Partner context required/);
  });

  it("injects ctx.partnerId as a bound parameter, never a client value", () => {
    const stmt = buildScopedStatement(
      ctx,
      "SELECT * FROM product WHERE id = $1 AND partner_id = {partner}",
      ["product-123"]
    );
    expect(stmt.sql).toContain("partner_id = $2");
    expect(stmt.params).toEqual(["product-123", "partner-A"]);
  });

  it("a foreign id cannot escape the tenant predicate", async () => {
    const { executor, calls } = fakeExecutor();
    // Simulate DB returning nothing because the row belongs to another partner.
    const rows = await getPartnerProduct(ctx, "product-of-partner-B", executor);
    expect(rows).toEqual([]);
    expect(calls[0].sql).toContain("partner_id = $2");
    expect(calls[0].params).toEqual(["product-of-partner-B", "partner-A"]);
  });

  it("fulfilment groups are scoped by partner even when id is known", async () => {
    const { executor, calls } = fakeExecutor();
    await getPartnerFulfilmentGroup(ctx, "group-B", executor);
    expect(calls[0].sql).toContain("partner_id = $2");
    expect(calls[0].params).toEqual(["group-B", "partner-A"]);
  });

  it("tenantQuery never executes when predicate is missing", async () => {
    const { executor, calls } = fakeExecutor();
    await expect(tenantQuery(ctx, "SELECT * FROM product", [], executor)).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});

describe("partner session tokens", () => {
  it("round-trips a valid token", () => {
    const token = signPartnerSession({
      partnerId: "partner-A",
      membershipId: "member-A",
      role: "owner",
      tokenVersion: 1,
      email: "a@partner.test",
    });
    const payload = verifyPartnerToken(token);
    expect(payload?.pid).toBe("partner-A");
    expect(payload?.role).toBe("owner");
  });

  it("rejects a tampered token", () => {
    const token = signPartnerSession({
      partnerId: "partner-A",
      membershipId: "member-A",
      role: "owner",
      tokenVersion: 1,
      email: "a@partner.test",
    });
    const [body, sig] = token.split(".");
    expect(
      verifyPartnerToken(`${body}.${"x".repeat(sig.length)}`)
    ).toBeNull();
  });

  it("uses a distinct cookie name and key from the admin session", () => {
    expect(PARTNER_SESSION_COOKIE).not.toBe("svk_admin_session");
    const adminToken = signAdminSession({ email: "admin@test", role: "super_admin" });
    expect(verifyPartnerToken(adminToken)).toBeNull();
  });
});

describe("password hashing", () => {
  it("verifies a correct password and rejects a wrong one", () => {
    const hash = hashPassword("correct-horse-battery");
    expect(verifyPassword("correct-horse-battery", hash)).toBe(true);
    expect(verifyPassword("wrong-password-here", hash)).toBe(false);
  });

  it("refuses weak passwords", () => {
    expect(() => hashPassword("short")).toThrow(/at least 12/);
  });
});

describe("partner RBAC fails closed", () => {
  it("grants owner everything but denies viewer writes", () => {
    expect(partnerHasPermission("owner", "team:write")).toBe(true);
    expect(partnerHasPermission("viewer", "products:write")).toBe(false);
    expect(partnerHasPermission("finance", "earnings:read")).toBe(true);
    expect(partnerHasPermission("finance", "products:write")).toBe(false);
  });

  it("denies unknown roles and permissions", () => {
    expect(partnerHasPermission("hacker", "orders:read")).toBe(false);
    expect(partnerHasPermission("owner", "unknown:perm" as any)).toBe(false);
  });
});

describe("server-side context resolution — revocation & isolation", () => {
  function member(overrides: Record<string, any> = {}) {
    return {
      id: "member-A",
      partner_id: "partner-A",
      status: "active",
      token_version: 1,
      role: "owner",
      ...overrides,
    };
  }

  function partner(overrides: Record<string, any> = {}) {
    return { id: "partner-A", account_status: "active", display_name: "A", ...overrides };
  }

  function executorFor(membershipRow: any, partnerRow: any) {
    return async (sql: string) => {
      if (sql.includes("FROM partner_membership")) return membershipRow ? [membershipRow] : [];
      if (sql.includes("FROM partner WHERE")) return partnerRow ? [partnerRow] : [];
      return [];
    };
  }

  const token = signPartnerSession({
    partnerId: "partner-A",
    membershipId: "member-A",
    role: "owner",
    tokenVersion: 1,
    email: "a@partner.test",
  });

  it("resolves a valid active context", async () => {
    const result = await resolvePartnerContext(token, executorFor(member(), partner()));
    expect(result?.partnerId).toBe("partner-A");
  });

  it("rejects a suspended membership", async () => {
    const result = await resolvePartnerContext(
      token,
      executorFor(member({ status: "suspended" }), partner())
    );
    expect(result).toBeNull();
  });

  it("rejects a revoked session (token_version mismatch)", async () => {
    const result = await resolvePartnerContext(
      token,
      executorFor(member({ token_version: 2 }), partner())
    );
    expect(result).toBeNull();
  });

  it("rejects a changed role and a partner mismatch", async () => {
    expect(
      await resolvePartnerContext(token, executorFor(member({ role: "viewer" }), partner()))
    ).toBeNull();
    expect(
      await resolvePartnerContext(token, executorFor(member({ partner_id: "partner-B" }), partner()))
    ).toBeNull();
  });

  it("rejects a suspended partner account", async () => {
    const result = await resolvePartnerContext(
      token,
      executorFor(member(), partner({ account_status: "suspended" }))
    );
    expect(result).toBeNull();
  });

  it("rejects a missing or invalid token before any DB lookup", async () => {
    expect(await resolvePartnerContext(undefined, executorFor(member(), partner()))).toBeNull();
    expect(await resolvePartnerContext("garbage", executorFor(member(), partner()))).toBeNull();
  });
});
