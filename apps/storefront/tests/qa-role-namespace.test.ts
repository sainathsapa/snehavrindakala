/**
 * Agent A07 — GAP-01 closure: explicit platform/partner role namespaces.
 *
 * PURE / STATIC tests (no live DB, no network). They pin:
 *   - disjoint canonical role domains (`platform_*` vs `partner_*`);
 *   - legacy bare-name compatibility that NEVER crosses the namespace boundary;
 *   - namespace-aware admin + partner session resolution (fail closed);
 *   - canonicalisation on read, so an ambiguous legacy record cannot be silently
 *     granted elevated platform privileges;
 *   - session invalidation when an old role claim no longer matches the DB;
 *   - migration 006's additive, idempotent widening of the role allow-list, on
 *     both the fresh-install and existing-DB paths.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ROLE_PERMISSIONS,
  hasPermission,
  can,
  isRole,
  platformRoleOrNull,
  canonicalPlatformRole,
  isCanonicalPlatformRole,
  type Role,
  type Permission,
} from "@/lib/rbac";
import {
  PARTNER_ROLE_PERMISSIONS,
  partnerHasPermission,
  partnerCan,
  type PartnerPermission,
} from "@/lib/partner/rbac";
import {
  isPartnerRole,
  partnerRoleOrNull,
  canonicalPartnerRole,
  isCanonicalPartnerRole,
  isPartnerOwnerRole,
  type PartnerRole,
} from "@/lib/partner/types";
import {
  signPartnerSession,
  verifyPartnerToken,
} from "@/lib/partner/session";
import { resolvePartnerContext } from "@/lib/partner/context";
import { signAdminSession, verifyAdminSession } from "@/lib/admin-session";
import { listMigrationFiles, listPendingMigrations } from "@/db/migrate";
import type { QueryExecutor } from "@/lib/partner/repository";

const repo = join(__dirname, "..");
const read = (p: string) => readFileSync(join(repo, p), "utf8");

const PLATFORM_CANONICAL = [
  "platform_super_admin", "platform_admin", "platform_manager",
  "platform_operations", "platform_finance", "platform_support", "partner",
  "platform_viewer",
] as const;

const PLATFORM_LEGACY = [
  "super_admin", "admin", "manager", "operations", "finance", "support", "viewer",
] as const;

const PARTNER_CANONICAL = [
  "partner_owner", "partner_manager", "partner_operations", "partner_finance",
  "partner_viewer",
] as const;

const PARTNER_LEGACY = [
  "owner", "manager", "operations", "finance", "viewer",
] as const;

const LEGACY_PLATFORM_TO_CANONICAL: Record<string, string> = {
  super_admin: "platform_super_admin",
  admin: "platform_admin",
  manager: "platform_manager",
  operations: "platform_operations",
  finance: "platform_finance",
  support: "platform_support",
  viewer: "platform_viewer",
};

const LEGACY_PARTNER_TO_CANONICAL: Record<string, string> = {
  owner: "partner_owner",
  manager: "partner_manager",
  operations: "partner_operations",
  finance: "partner_finance",
  viewer: "partner_viewer",
};

const allPlatformPermissions = Array.from(
  new Set(Object.values(ROLE_PERMISSIONS).flat())
) as Permission[];

const allPartnerPermissions = Array.from(
  new Set(Object.values(PARTNER_ROLE_PERMISSIONS).flat())
) as PartnerPermission[];

const platformPermissionSet = new Set<string>(allPlatformPermissions);
const partnerPermissionSet = new Set<string>(allPartnerPermissions);

/** Permissions that exist only in one domain (shared vocabulary excluded). */
const platformOnlyPermissions = allPlatformPermissions.filter(
  (p) => !partnerPermissionSet.has(p)
);
const partnerOnlyPermissions = allPartnerPermissions.filter(
  (p) => !platformPermissionSet.has(p)
);

beforeEach(() => {
  // Pin a deterministic dev secret; namespacing is what separates the cookies.
  process.env.COOKIE_SECRET = "qa-role-namespace-secret";
});

afterEach(() => {
  delete process.env.COOKIE_SECRET;
});

/* ─────────────────────────────────────────────────────────────────────────── */

describe("A07 — explicit, disjoint role namespaces", () => {
  it("canonical platform roles exist only in the platform matrix", () => {
    for (const role of PLATFORM_CANONICAL) {
      expect(ROLE_PERMISSIONS, role).toHaveProperty(role);
      expect(isRole(role), role).toBe(true);
      expect(isCanonicalPlatformRole(role), role).toBe(true);
      expect(
        (PARTNER_ROLE_PERMISSIONS as Record<string, unknown>),
        `${role} must not be a partner role`
      ).not.toHaveProperty(role);
    }
  });

  it("canonical partner roles exist only in the partner matrix", () => {
    for (const role of PARTNER_CANONICAL) {
      expect(PARTNER_ROLE_PERMISSIONS, role).toHaveProperty(role);
      expect(isPartnerRole(role), role).toBe(true);
      expect(isCanonicalPartnerRole(role), role).toBe(true);
      expect(ROLE_PERMISSIONS, `${role} must not be a platform role`).not.toHaveProperty(role);
      expect(isRole(role), role).toBe(false);
    }
  });

  it("legacy and canonical spellings grant exactly the same permissions (least privilege preserved)", () => {
    for (const [legacy, canonical] of Object.entries(LEGACY_PLATFORM_TO_CANONICAL)) {
      expect(new Set(ROLE_PERMISSIONS[legacy as Role])).toEqual(
        new Set(ROLE_PERMISSIONS[canonical as Role])
      );
    }
    for (const [legacy, canonical] of Object.entries(LEGACY_PARTNER_TO_CANONICAL)) {
      expect(new Set(PARTNER_ROLE_PERMISSIONS[legacy as PartnerRole])).toEqual(
        new Set(PARTNER_ROLE_PERMISSIONS[canonical as PartnerRole])
      );
    }
    // The stable platform `partner` role keeps its read-only powers.
    expect(hasPermission("partner", "users:write")).toBe(false);
    expect(hasPermission("partner", "partners:read")).toBe(true);
  });
});

describe("A07 — platform role auth (canonical + legacy)", () => {
  it("canonicalPlatformRole maps every legacy platform name to its canonical value", () => {
    for (const [legacy, canonical] of Object.entries(LEGACY_PLATFORM_TO_CANONICAL)) {
      expect(canonicalPlatformRole(legacy)).toBe(canonical);
      expect(platformRoleOrNull(legacy)).toBe(legacy); // guard still accepts legacy
    }
    expect(canonicalPlatformRole("partner")).toBe("partner"); // stable value
    for (const role of PLATFORM_CANONICAL) {
      expect(canonicalPlatformRole(role)).toBe(role);
    }
  });

  it("canonical platform roles enforce least privilege", () => {
    expect(hasPermission("platform_finance", "refunds:approve")).toBe(true);
    expect(hasPermission("platform_finance", "users:write")).toBe(false);
    expect(hasPermission("platform_admin", "users:write")).toBe(false);
    expect(hasPermission("platform_super_admin", "users:write")).toBe(true);
    expect(can("platform_finance", "refunds:approve", "users:write")).toBe(false);
    for (const perm of partnerOnlyPermissions) {
      // Even the most privileged platform role never grants a partner-only
      // permission (shared vocabulary such as orders:read is excluded).
      expect(hasPermission("platform_super_admin", perm as unknown as Permission)).toBe(false);
    }
  });
});

describe("A07 — partner role auth (canonical + legacy)", () => {
  it("partnerRoleOrNull / canonicalPartnerRole map every legacy partner name", () => {
    for (const [legacy, canonical] of Object.entries(LEGACY_PARTNER_TO_CANONICAL)) {
      expect(partnerRoleOrNull(legacy)).toBe(canonical);
      expect(canonicalPartnerRole(legacy)).toBe(canonical);
      expect(isPartnerRole(legacy)).toBe(true);
    }
    for (const role of PARTNER_CANONICAL) {
      expect(partnerRoleOrNull(role)).toBe(role);
      expect(canonicalPartnerRole(role)).toBe(role);
    }
  });

  it("canonical partner permissions match legacy and enforce least privilege", () => {
    expect(partnerHasPermission("partner_finance", "earnings:read")).toBe(true);
    expect(partnerHasPermission("partner_finance", "products:write")).toBe(false);
    expect(partnerHasPermission("partner_viewer", "orders:write")).toBe(false);
    expect(partnerHasPermission("partner_owner", "security:write")).toBe(true);
    expect(partnerCan("partner_operations", "orders:write", "shipments:write")).toBe(true);
    expect(partnerCan("partner_operations", "orders:write", "earnings:read")).toBe(false);
    for (const perm of platformOnlyPermissions) {
      // No partner role may ever hold a platform-only capability.
      expect(partnerHasPermission("partner_owner", perm as unknown as PartnerPermission)).toBe(false);
    }
  });

  it("owner checks recognise both legacy and canonical owner spellings", () => {
    expect(isPartnerOwnerRole("owner")).toBe(true);
    expect(isPartnerOwnerRole("partner_owner")).toBe(true);
    expect(isPartnerOwnerRole("partner_manager")).toBe(false);
    expect(isPartnerOwnerRole("super_admin")).toBe(false);
  });
});

describe("A07 — unknown roles fail closed", () => {
  const unknown: unknown[] = ["", "not_a_role", "SUPER_ADMIN", "partner_superadmin",
    "platform_partner", null, undefined, 42, {}];

  it("permission helpers and guards reject every unknown value", () => {
    for (const value of unknown) {
      expect(hasPermission(value as Role, "refunds:approve"), String(value)).toBe(false);
      expect(can(value as Role, "users:write"), String(value)).toBe(false);
      expect(partnerHasPermission(value, "earnings:read"), String(value)).toBe(false);
      expect(partnerCan(value, "team:write"), String(value)).toBe(false);
      expect(platformRoleOrNull(value), String(value)).toBeNull();
      expect(canonicalPlatformRole(value), String(value)).toBeNull();
      expect(partnerRoleOrNull(value), String(value)).toBeNull();
      expect(canonicalPartnerRole(value), String(value)).toBeNull();
    }
  });

  it("a token carrying a foreign namespace role fails signature/shape verification", () => {
    const partnerToken = signPartnerSession({
      partnerId: "partner-A", membershipId: "member-A", role: "platform_finance" as PartnerRole,
      tokenVersion: 1, email: "a@partner.test",
    });
    expect(verifyPartnerToken(partnerToken)).toBeNull();

    const adminToken = signAdminSession({ email: "admin@test", role: "partner_finance" });
    expect(verifyAdminSession(adminToken)).toBeNull();
  });
});

describe("A07 — legacy ambiguous values are NOT silently elevated", () => {
  it("legacy `finance` maps to partner_finance on the partner side and platform_finance on the platform side — never across", () => {
    expect(partnerRoleOrNull("finance")).toBe("partner_finance");
    expect(canonicalPlatformRole("finance")).toBe("platform_finance");

    // The resolved partner value has NO platform power, even though the bare
    // legacy string would if it ever reached the platform matrix directly.
    expect(hasPermission("partner_finance", "refunds:approve")).toBe(false);
    expect(hasPermission("partner_finance", "finance:read")).toBe(false);
    expect(hasPermission("partner_finance", "users:write")).toBe(false);
    expect(partnerHasPermission("partner_finance", "earnings:read")).toBe(true);
  });

  it("every legacy partner role resolves to a partner-only permission set", () => {
    for (const legacy of PARTNER_LEGACY) {
      const canonical = partnerRoleOrNull(legacy)!;
      expect(canonical).toMatch(/^partner_/);
      for (const perm of platformOnlyPermissions) {
        expect(hasPermission(canonical as Role, perm)).toBe(false);
      }
    }
  });
});

describe("A07 — partner role attempting admin access", () => {
  it("no canonical partner role is accepted by a platform guard or the admin session", () => {
    for (const role of PARTNER_CANONICAL) {
      expect(platformRoleOrNull(role), role).toBeNull();
      expect(canonicalPlatformRole(role), role).toBeNull();
      expect(isRole(role), role).toBe(false);
      for (const perm of allPlatformPermissions) {
        expect(hasPermission(role as Role, perm), `${role}:${perm}`).toBe(false);
      }
    }
    // The one partner-only legacy name is also rejected outright.
    expect(platformRoleOrNull("owner")).toBeNull();
    for (const perm of allPlatformPermissions) {
      expect(hasPermission("owner" as Role, perm), `owner:${perm}`).toBe(false);
    }
    for (const role of [...PARTNER_CANONICAL, "owner"]) {
      expect(verifyAdminSession(signAdminSession({ email: "x@test", role }))).toBeNull();
    }
  });

  it("ambiguous legacy partner names are confined to the partner boundary", () => {
    // Bare manager/operations/finance/viewer exist in BOTH matrices only as
    // transition aliases. A partner identity canonicalises them to partner_*
    // values first; those canonical values are rejected by the platform matrix.
    for (const legacy of ["manager", "operations", "finance", "viewer"]) {
      const canonical = partnerRoleOrNull(legacy)!;
      expect(canonical).toMatch(/^partner_/);
      expect(platformRoleOrNull(canonical)).toBeNull();
      for (const perm of allPlatformPermissions) {
        expect(hasPermission(canonical as Role, perm), `${canonical}:${perm}`).toBe(false);
      }
    }
  });

  it("a partner session token cannot be replayed as an admin session token", () => {
    const partnerToken = signPartnerSession({
      partnerId: "partner-A", membershipId: "member-A", role: "partner_owner",
      tokenVersion: 1, email: "owner@partner.test",
    });
    expect(verifyPartnerToken(partnerToken)?.role).toBe("partner_owner");
    expect(verifyAdminSession(partnerToken)).toBeNull();
  });

  it("getAdminIdentity is wired to the platform-only canonicalisation boundary", () => {
    const actions = read("app/admin/actions.ts");
    expect(actions).toMatch(/platformRoleOrNull\(/);
    expect(actions).toMatch(/canonicalPlatformRole\(/);
    // It never reads the partner cookie.
    expect(actions).not.toMatch(/PARTNER_SESSION_COOKIE/);
  });
});

describe("A07 — admin role attempting unauthorised partner access", () => {
  it("no canonical platform role is accepted by a partner guard or the partner session", () => {
    for (const role of PLATFORM_CANONICAL) {
      expect(partnerRoleOrNull(role), role).toBeNull();
      expect(canonicalPartnerRole(role), role).toBeNull();
      expect(isPartnerRole(role), role).toBe(false);
      for (const perm of allPartnerPermissions) {
        expect(partnerHasPermission(role, perm), `${role}:${perm}`).toBe(false);
      }
    }
    // Platform-only legacy names are likewise rejected by the partner guard.
    for (const role of ["super_admin", "admin", "support", "partner"]) {
      expect(partnerRoleOrNull(role), role).toBeNull();
      for (const perm of allPartnerPermissions) {
        expect(partnerHasPermission(role, perm), `${role}:${perm}`).toBe(false);
      }
    }
    expect(verifyPartnerToken(signPartnerSession({
      partnerId: "partner-A", membershipId: "member-A",
      role: "platform_finance" as PartnerRole, tokenVersion: 1, email: "a@partner.test",
    }))).toBeNull();
  });

  it("an admin session token cannot be replayed as a partner session token", () => {
    const adminToken = signAdminSession({ email: "admin@test", role: "platform_super_admin" });
    expect(verifyAdminSession(adminToken)?.role).toBe("platform_super_admin");
    expect(verifyPartnerToken(adminToken)).toBeNull();
  });

  it("the platform marketplace `partner` guard is preserved (no cross-tenant leak)", () => {
    const guarded = [
      "app/admin/marketplace/page.tsx",
      "app/api/admin/marketplace/overview/route.ts",
      "app/api/admin/marketplace/finance/route.ts",
    ];
    for (const file of guarded) {
      expect(read(file), file).toMatch(/identity\.role === ["']partner["']/);
    }
    expect(canonicalPlatformRole("partner")).toBe("partner");
  });
});

/* ─────────────────────────────────────────────────────────────────────────── */

function memberRow(role: unknown, overrides: Record<string, unknown> = {}) {
  return {
    id: "member-A",
    partner_id: "partner-A",
    email: "a@partner.test",
    full_name: "A Member",
    role,
    status: "active",
    token_version: 1,
    ...overrides,
  };
}

function partnerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "partner-A",
    account_status: "active",
    display_name: "Partner A",
    ...overrides,
  };
}

function executorFor(member: any, partner: any): QueryExecutor {
  return async (sql: string) => {
    if (sql.includes("FROM partner_membership")) return member ? [member] : [];
    if (sql.includes("FROM partner WHERE")) return partner ? [partner] : [];
    return [];
  };
}

function partnerToken(role: PartnerRole, overrides: Record<string, unknown> = {}): string {
  return signPartnerSession({
    partnerId: "partner-A",
    membershipId: "member-A",
    role,
    tokenVersion: 1,
    email: "a@partner.test",
    ...overrides,
  });
}

describe("A07 — namespace-aware partner session resolution", () => {
  it("a legacy claim + legacy DB row resolves to the canonical partner role", async () => {
    const ctx = await resolvePartnerContext(
      partnerToken("owner"),
      executorFor(memberRow("owner"), partnerRow())
    );
    expect(ctx?.role).toBe("partner_owner");
    expect(partnerHasPermission(ctx!.role, "security:write")).toBe(true);
  });

  it("a canonical claim + legacy DB row (existing DB) also resolves", async () => {
    const ctx = await resolvePartnerContext(
      partnerToken("partner_finance"),
      executorFor(memberRow("finance"), partnerRow())
    );
    expect(ctx?.role).toBe("partner_finance");
    expect(partnerHasPermission(ctx!.role, "earnings:read")).toBe(true);
    expect(partnerHasPermission(ctx!.role, "products:write")).toBe(false);
  });

  it("a canonical claim + canonical DB row (fresh DB) resolves", async () => {
    const ctx = await resolvePartnerContext(
      partnerToken("partner_operations"),
      executorFor(memberRow("partner_operations"), partnerRow())
    );
    expect(ctx?.role).toBe("partner_operations");
  });

  it("an old role claim that no longer matches the DB role is invalidated", async () => {
    expect(
      await resolvePartnerContext(
        partnerToken("partner_owner"),
        executorFor(memberRow("partner_viewer"), partnerRow())
      )
    ).toBeNull();

    expect(
      await resolvePartnerContext(
        partnerToken("finance"),
        executorFor(memberRow("partner_manager"), partnerRow())
      )
    ).toBeNull();
  });

  it("an unknown/invalid DB role fails closed even with a valid claim", async () => {
    expect(
      await resolvePartnerContext(
        partnerToken("partner_owner"),
        executorFor(memberRow("platform_super_admin"), partnerRow())
      )
    ).toBeNull();
    expect(
      await resolvePartnerContext(
        partnerToken("partner_owner"),
        executorFor(memberRow("superadmin"), partnerRow())
      )
    ).toBeNull();
  });

  it("a claim that is a platform role cannot even be verified", async () => {
    expect(verifyPartnerToken(partnerToken("platform_finance" as PartnerRole))).toBeNull();
    expect(
      await resolvePartnerContext(
        partnerToken("platform_finance" as PartnerRole),
        executorFor(memberRow("platform_finance"), partnerRow())
      )
    ).toBeNull();
  });
});

/* ─────────────────────────────────────────────────────────────────────────── */

describe("A07 — migration 006: additive, idempotent role allow-list widening", () => {
  const migration = read("db/migrations/006_role_namespacing.sql");
  const files = listMigrationFiles();
  const m006 = files.find((f) => f.id === "006_role_namespacing")!;

  it("is present, correctly named/ordered, and pending on an un-migrated DB", () => {
    expect(m006).toBeTruthy();
    expect(m006.filename).toBe("006_role_namespacing.sql");
    expect(m006.order).toBe(6);
    expect(listPendingMigrations(files.map((f) => f.id)).some((f) => f.id === m006.id)).toBe(false);
    expect(listPendingMigrations(["002_partner_marketplace", "003_marketplace_finance",
      "004_payment_reconciliation", "005_notification_retry"]).map((f) => f.id)).toContain(m006.id);
  });

  it("admits BOTH canonical partner values and legacy values during transition", () => {
    for (const role of [...PARTNER_CANONICAL, ...PARTNER_LEGACY]) {
      expect(migration, role).toContain(`'${role}'`);
    }
    // The baseline CHECK in 002 is the legacy five-value list we are widening.
    const baseline = read("db/migrations/002_partner_marketplace.sql");
    expect(baseline).toMatch(/CHECK \(role IN \('owner','manager','operations','finance','viewer'\)\)/);
  });

  it("is idempotent and never deletes or rewrites business rows", () => {
    expect(migration).toMatch(/IF NOT EXISTS/i);
    expect(migration).toMatch(/pg_constraint/i);
    expect(migration).toMatch(/partner_membership_role_namespaced_check/);
    expect(migration).toMatch(/additive/i);
    expect(migration).toMatch(/[Ff]orward.recovery/i);
    expect(migration).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(migration).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(migration).not.toMatch(/\bTRUNCATE\b/i);
    // No data rewrite: existing rows keep their stored role and identity.
    expect(migration).not.toMatch(/\bUPDATE\s+partner_membership\b/i);
  });

  it("maps the ambiguous legacy roles explicitly in the shipped code", () => {
    const types = read("lib/partner/types.ts");
    const rbac = read("lib/rbac.ts");
    for (const [legacy, canonical] of Object.entries(LEGACY_PARTNER_TO_CANONICAL)) {
      expect(types, legacy).toContain(`${legacy}: "${canonical}"`);
    }
    for (const [legacy, canonical] of Object.entries(LEGACY_PLATFORM_TO_CANONICAL)) {
      expect(rbac, legacy).toContain(`${legacy}: "${canonical}"`);
    }
  });
});
