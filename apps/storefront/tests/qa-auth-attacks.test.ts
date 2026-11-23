/**
 * AGENT A71 — Independent QA (Scenario C): adversarial authentication attacks.
 *
 * Every attack below is exercised against the real, committed contract
 * (`resolvePartnerContext`), with only the DB lookups replaced by a fake
 * executor. The goal: a forged/expired/revoked token, a suspended identity, or
 * a cross-tenant identity mismatch must produce a NULL context — never a
 * partially-valid one. We also prove no DB lookup happens for pure token
 * failures, and that the partner and admin privilege namespaces cannot cross.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolvePartnerContext } from "@/lib/partner/context";
import {
  PARTNER_SESSION_COOKIE,
  PARTNER_SESSION_MAX_AGE,
  signPartnerSession,
  verifyPartnerToken,
} from "@/lib/partner/session";
import { ADMIN_SESSION_COOKIE, signAdminSession, verifyAdminSession } from "@/lib/admin-session";
import { hasPermission, isRole, platformRoleOrNull, ROLE_PERMISSIONS, type Role } from "@/lib/rbac";
import { partnerHasPermission } from "@/lib/partner/rbac";
import type { QueryExecutor } from "@/lib/partner/repository";

vi.mock("@/lib/db", () => ({
  query: vi.fn(async () => []),
  queryResult: vi.fn(async () => ({ rows: [], rowCount: 0 })),
  transaction: vi.fn(),
  getPool: vi.fn(),
}));

const EMAIL = "a@partner.test";
const PARTNER_A = "partner-A";
const PARTNER_B = "partner-B";

function baseTokenInput(overrides: Record<string, any> = {}) {
  return {
    partnerId: PARTNER_A,
    membershipId: "member-A1",
    role: "owner" as const,
    tokenVersion: 1,
    email: EMAIL,
    ...overrides,
  };
}

function validToken(overrides: Record<string, any> = {}): string {
  return signPartnerSession(baseTokenInput(overrides));
}

function membership(row: Record<string, any> = {}) {
  return {
    id: "member-A1",
    partner_id: PARTNER_A,
    email: EMAIL,
    full_name: "A Owner",
    role: "owner",
    status: "active",
    token_version: 1,
    ...row,
  };
}

function partner(row: Record<string, any> = {}) {
  return {
    id: PARTNER_A,
    account_status: "active",
    display_name: "Partner A",
    ...row,
  };
}

type Call = { sql: string; params: any[] };

/** Membership lookup + partner lookup, with a recording executor. */
function executorFor(memberRow: any, partnerRow: any) {
  const calls: Call[] = [];
  const executor: QueryExecutor = async (sql: string, params: any[] = []) => {
    calls.push({ sql, params });
    if (sql.includes("FROM partner_membership")) return memberRow ? [memberRow] : [];
    if (sql.includes("FROM partner WHERE")) return partnerRow ? [partnerRow] : [];
    return [];
  };
  return { executor, calls };
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("COOKIE_SECRET", "qa-auth-attack-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/* ─────────────────────────────────────────────────────────────────────────── */

describe("A71 — auth attacks: every attack must yield a null context", () => {
  it("baseline: a genuine active token resolves to the server-derived context", async () => {
    const { executor } = executorFor(membership(), partner());
    const ctx = await resolvePartnerContext(validToken(), executor);
    expect(ctx).toMatchObject({
      partnerId: PARTNER_A,
      membershipId: "member-A1",
      // Resolved partner identities always carry the canonical `partner_*` role,
      // even when the signed claim and DB row still use the legacy bare name.
      role: "partner_owner",
      tokenVersion: 1,
      email: EMAIL,
    });
  });

  it("ATTACK 1 — forged cookie (bad signature): null context, zero DB lookups", async () => {
    const token = validToken();
    const [body, sig] = token.split(".");
    const forged = `${body}.${sig[0] === "A" ? "B" : "A"}${sig.slice(1)}`;
    expect(forged).not.toBe(token);
    expect(verifyPartnerToken(forged)).toBeNull();

    const { executor, calls } = executorFor(membership(), partner());
    expect(await resolvePartnerContext(forged, executor)).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("ATTACK 2 — expired token: null context, zero DB lookups", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const expired = validToken();
    vi.setSystemTime(
      new Date(Date.now() + (PARTNER_SESSION_MAX_AGE + 60) * 1000)
    );
    expect(verifyPartnerToken(expired)).toBeNull();

    const { executor, calls } = executorFor(membership(), partner());
    expect(await resolvePartnerContext(expired, executor)).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("ATTACK 3 — token for a suspended member: null context", async () => {
    const { executor } = executorFor(
      membership({ status: "suspended" }),
      partner()
    );
    expect(await resolvePartnerContext(validToken(), executor)).toBeNull();
  });

  it("ATTACK 4 — token_version revoked (session invalidation): null context", async () => {
    const { executor } = executorFor(membership({ token_version: 2 }), partner());
    expect(await resolvePartnerContext(validToken(), executor)).toBeNull();
  });

  it("ATTACK 5 — role mismatch between token and DB: null context", async () => {
    // Token claims owner; DB now says viewer (demotion). The signed cookie is
    // otherwise valid, so only the DB re-read can catch this.
    const { executor } = executorFor(membership({ role: "viewer" }), partner());
    expect(await resolvePartnerContext(validToken({ role: "owner" }), executor)).toBeNull();
  });

  it("ATTACK 6 — partner account suspended: null context", async () => {
    const { executor } = executorFor(
      membership(),
      partner({ account_status: "suspended" })
    );
    expect(await resolvePartnerContext(validToken(), executor)).toBeNull();
  });

  it("ATTACK 7 — membership belongs to a different partner than the token claims: null context", async () => {
    // Token says partner-A, but the membership row it points to is owned by B.
    const { executor } = executorFor(
      membership({ id: "member-X", partner_id: PARTNER_B }),
      partner()
    );
    const token = validToken({ membershipId: "member-X", partnerId: PARTNER_A });
    expect(await resolvePartnerContext(token, executor)).toBeNull();
  });

  it("ATTACK 7b — reverse direction: token claims B, membership belongs to A, partner B active: null", async () => {
    // Even when the partner row the token points at exists and is active, the
    // membership/partner mismatch must still abort resolution.
    const { executor, calls } = executorFor(
      { ...membership(), id: "member-B", partner_id: PARTNER_A },
      { id: PARTNER_B, account_status: "active", display_name: "Partner B" }
    );
    const token = validToken({ partnerId: PARTNER_B, membershipId: "member-B" });
    expect(await resolvePartnerContext(token, executor)).toBeNull();
    expect(calls.length).toBeGreaterThan(0); // DB was read, but identity rejected
  });

  it("ATTACK 8 — missing membership row or missing partner row: null context", async () => {
    expect(
      await resolvePartnerContext(validToken(), executorFor(null, partner()).executor)
    ).toBeNull();
    expect(
      await resolvePartnerContext(validToken(), executorFor(membership(), null).executor)
    ).toBeNull();
  });

  it("ATTACK 9 — malformed / empty tokens are rejected before any DB lookup", async () => {
    const { executor, calls } = executorFor(membership(), partner());
    for (const bad of ["", "garbage", "a.b", undefined, null]) {
      expect(await resolvePartnerContext(bad as any, executor)).toBeNull();
    }
    expect(calls).toHaveLength(0);
  });

  it("ATTACK 10 — an invited membership is not an active session", async () => {
    const { executor } = executorFor(membership({ status: "invited" }), partner());
    expect(await resolvePartnerContext(validToken(), executor)).toBeNull();
  });
});

/* ─────────────────────────────────────────────────────────────────────────── */

describe("A71 — privilege confusion / privilege separation", () => {
  it("a partner token is NOT accepted as an admin session", () => {
    const partnerToken = validToken({ role: "owner" });
    expect(verifyPartnerToken(partnerToken)).not.toBeNull(); // valid in its own realm
    expect(verifyAdminSession(partnerToken)).toBeNull(); // but not as admin
  });

  it("an admin token is NOT accepted as a partner session", () => {
    const adminToken = signAdminSession({ email: "admin@svk.test", role: "super_admin" });
    expect(verifyAdminSession(adminToken)).not.toBeNull();
    expect(verifyPartnerToken(adminToken)).toBeNull();
  });

  it("the two session cookies have distinct names", () => {
    expect(PARTNER_SESSION_COOKIE).not.toBe(ADMIN_SESSION_COOKIE);
  });

  it("the platform 'partner' role is read-only and cannot satisfy privileged actions", () => {
    expect(ROLE_PERMISSIONS.partner).toEqual(
      expect.arrayContaining(["orders:read", "products:read", "partners:read"])
    );
    for (const perm of [
      "users:write",
      "roles:write",
      "settings:write",
      "refunds:approve",
      "finance:read",
      "settlements:write",
      "partners:write",
      "products:write",
      "inventory:write",
    ] as const) {
      expect(hasPermission("partner", perm), perm).toBe(false);
    }
    expect(hasPermission("partner", "orders:write")).toBe(false);
  });

  it("partner-side enforcement still uses partner RBAC, not the platform matrix", () => {
    expect(partnerHasPermission("finance", "earnings:read")).toBe(true);
    expect(partnerHasPermission("finance", "products:write")).toBe(false);
    expect(partnerHasPermission("viewer", "orders:write")).toBe(false);
    expect(partnerHasPermission("owner", "security:write")).toBe(true);
    // The platform's dedicated partner role cannot manage users/settings.
    expect(hasPermission("partner", "users:write")).toBe(false);
  });

  /**
   * DOCUMENTED GAP (see docs/release/QA_SECURITY_REPORT.md, GAP-01).
   * The platform and partner RBAC matrices both accept plain strings as roles,
   * and four partner role names ("manager", "operations", "finance", "viewer")
   * collide with platform role names. If a partner role string is EVER fed to
   * the platform `hasPermission`, it silently inherits platform powers. Current
   * call sites are separated, so this is latent — but it fails closed nowhere.
   */
  it("DOCUMENTS GAP-01: platform hasPermission treats colliding partner role strings as platform roles", () => {
    expect(hasPermission("finance", "refunds:approve")).toBe(true); // platform finance power
    expect(hasPermission("manager", "products:write")).toBe(true); // platform manager power
    expect(hasPermission("operations", "shipments:write")).toBe(true);
    expect(hasPermission("viewer", "finance:read")).toBe(true);
    // "owner" is partner-only, so it fails closed on the platform side.
    expect(hasPermission("owner" as Role, "refunds:approve")).toBe(false);
  });

  it("GAP-01 mitigation: only genuine platform roles can become an admin identity", () => {
    // The collision cannot be fixed inside hasPermission without breaking the
    // platform: "finance"/"manager"/"operations"/"viewer" ARE real platform
    // roles. The guard is applied where the identity is built, so a partner-only
    // or unknown role string fails closed (no identity at all).
    expect(platformRoleOrNull("owner")).toBeNull(); // partner-only
    expect(platformRoleOrNull("partner_owner")).toBeNull(); // namespaced partner
    expect(platformRoleOrNull("not_a_role")).toBeNull();
    expect(platformRoleOrNull("")).toBeNull();
    expect(platformRoleOrNull(null)).toBeNull();
    // Genuine platform roles still resolve, including the colliding names.
    expect(platformRoleOrNull("finance")).toBe("finance");
    expect(platformRoleOrNull("super_admin")).toBe("super_admin");
    expect(platformRoleOrNull("partner")).toBe("partner");

    // The guard is wired into the real entry point, not just unit-tested here.
    const actions = readFileSync(join(__dirname, "..", "app", "admin", "actions.ts"), "utf8");
    expect(actions).toMatch(/import[^;]*platformRoleOrNull[^;]*from "@\/lib\/rbac"/);
    expect(actions.match(/platformRoleOrNull\(/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("platform role names are recognised, partner-only role names are not", () => {
    expect(isRole("super_admin")).toBe(true);
    expect(isRole("partner")).toBe(true);
    expect(isRole("owner")).toBe(false);
    expect(hasPermission("owner" as Role, "users:write")).toBe(false);
  });
});
