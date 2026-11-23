/**
 * AGENT A91 — Independent QA, Scenario G: cross-matrix role enforcement.
 *
 * This suite treats the two shipped permission matrices as the source of truth:
 *   - apps/storefront/lib/rbac.ts            (platform / admin roles)
 *   - apps/storefront/lib/partner/rbac.ts    (partner-portal roles)
 *
 * It asserts the real business outcome of "who can do what" for staff and
 * partner roles, plus the boundary between the two domains. No live DB, no
 * signed credentials and no partner identity is fabricated — everything is
 * derived from the exported matrices and their guard functions.
 */

import { describe, expect, it } from "vitest";
import {
  ROLE_PERMISSIONS,
  can,
  hasPermission,
  type Permission,
  type Role,
} from "@/lib/rbac";
import {
  PARTNER_ROLE_PERMISSIONS,
  partnerCan,
  partnerHasPermission,
  type PartnerPermission,
} from "@/lib/partner/rbac";
import type { PartnerRole } from "@/lib/partner/types";

// ---------------------------------------------------------------------------
// Helpers — all derived from the real matrices, no hard-coded policy
// ---------------------------------------------------------------------------

const platformRoles = Object.keys(ROLE_PERMISSIONS) as Role[];
const partnerRoles: PartnerRole[] = ["owner", "manager", "operations", "finance", "viewer"];

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

/** Every permission string that appears in the platform matrix. */
const allPlatformPermissions = unique(
  Object.values(ROLE_PERMISSIONS).flat() as Permission[]
);
/** Every permission string that appears in the partner matrix. */
const allPartnerPermissions = unique(
  Object.values(PARTNER_ROLE_PERMISSIONS).flat() as PartnerPermission[]
);

const platformPermissionSet = new Set<string>(allPlatformPermissions);
const partnerPermissionSet = new Set<string>(allPartnerPermissions);

/** Platform permission strings that never appear in the partner domain. */
const PLATFORM_ONLY = allPlatformPermissions.filter((p) => !partnerPermissionSet.has(p));
/** Partner permission strings that never appear in the platform domain. */
const PARTNER_ONLY = allPartnerPermissions.filter((p) => !platformPermissionSet.has(p));

// ---------------------------------------------------------------------------
// Scenario G — platform (admin/staff) role enforcement
// ---------------------------------------------------------------------------

describe("Scenario G — platform staff role enforcement", () => {
  it("a viewer cannot modify products or approve refunds (read-only)", () => {
    expect(hasPermission("viewer", "products:write")).toBe(false);
    expect(hasPermission("viewer", "products:delete")).toBe(false);
    expect(hasPermission("viewer", "refunds:approve")).toBe(false);
    expect(hasPermission("viewer", "refunds:write")).toBe(false);
    expect(can("viewer", "products:write", "refunds:approve")).toBe(false);
    // Every permission the viewer does hold is a read.
    for (const permission of ROLE_PERMISSIONS.viewer) {
      expect(permission.endsWith(":read")).toBe(true);
    }
  });

  it("finance can approve refunds but cannot manage users, products or roles", () => {
    expect(hasPermission("finance", "refunds:approve")).toBe(true);
    expect(hasPermission("finance", "refunds:write")).toBe(true);
    expect(hasPermission("finance", "finance:read")).toBe(true);
    expect(hasPermission("finance", "settlements:write")).toBe(true);

    for (const permission of [
      "users:read",
      "users:write",
      "users:delete",
      "roles:read",
      "roles:write",
      "products:write",
      "products:delete",
    ] as Permission[]) {
      expect(hasPermission("finance", permission)).toBe(false);
    }
    // A mixed request fails as a whole — finance may approve, but never both.
    expect(can("finance", "refunds:approve", "users:write")).toBe(false);
    expect(can("finance", "refunds:approve", "products:write")).toBe(false);
  });

  it("support can request a refund but cannot approve one or touch finance", () => {
    expect(hasPermission("support", "refunds:read")).toBe(true);
    expect(hasPermission("support", "refunds:write")).toBe(true); // "request"
    expect(hasPermission("support", "refunds:approve")).toBe(false);
    expect(can("support", "refunds:write", "refunds:approve")).toBe(false);

    expect(hasPermission("support", "tickets:write")).toBe(true);
    expect(hasPermission("support", "finance:read")).toBe(false);
    expect(hasPermission("support", "settlements:write")).toBe(false);
  });

  it("denies unknown roles and unknown permissions across the whole matrix (fail closed)", () => {
    const unknownRoles: unknown[] = ["", "hacker", "SUPER_ADMIN", "superadmin", null, undefined, 42];
    for (const role of unknownRoles) {
      for (const permission of allPlatformPermissions) {
        expect(hasPermission(role as Role, permission)).toBe(false);
      }
      expect(can(role as Role, ...allPlatformPermissions)).toBe(false);
    }
    for (const role of platformRoles) {
      expect(hasPermission(role, "bogus:permission" as any)).toBe(false);
    }
  });

  it("the admin 'partner' role is a read-only, partner-scoped platform role", () => {
    expect(unique(ROLE_PERMISSIONS.partner)).toEqual(
      unique(["orders:read", "products:read", "partners:read"] as Permission[])
    );
    for (const permission of ROLE_PERMISSIONS.partner) {
      expect(permission.endsWith(":read")).toBe(true);
    }
    expect(hasPermission("partner", "users:write")).toBe(false);
    expect(hasPermission("partner", "settings:write")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Scenario G — partner-portal role enforcement
// ---------------------------------------------------------------------------

/** Exact expected permission sets, used as fixtures to verify the real matrix. */
const EXPECTED_PARTNER_PERMISSIONS: Record<PartnerRole, PartnerPermission[]> = {
  owner: [
    "dashboard:read", "products:read", "products:write",
    "inventory:read", "inventory:write", "orders:read", "orders:write",
    "shipments:read", "shipments:write", "customers:read", "earnings:read",
    "statements:read", "settlements:read", "team:read", "team:write",
    "profile:read", "profile:write", "security:write",
  ],
  manager: [
    "dashboard:read", "products:read", "products:write",
    "inventory:read", "inventory:write", "orders:read", "orders:write",
    "shipments:read", "shipments:write", "customers:read",
    "earnings:read", "statements:read", "profile:read", "profile:write",
    "team:read", "team:write",
  ],
  operations: [
    "dashboard:read", "products:read", "inventory:read", "inventory:write",
    "orders:read", "orders:write", "shipments:read", "shipments:write",
    "customers:read", "profile:read",
  ],
  finance: [
    "dashboard:read", "orders:read", "earnings:read", "statements:read",
    "settlements:read", "profile:read",
  ],
  viewer: [
    "dashboard:read", "products:read", "inventory:read", "orders:read",
    "shipments:read", "profile:read",
  ],
};

describe("Scenario G — partner-portal role enforcement", () => {
  it("each partner role has exactly its intended, distinct permission set", () => {
    for (const role of partnerRoles) {
      expect(new Set(PARTNER_ROLE_PERMISSIONS[role])).toEqual(
        new Set(EXPECTED_PARTNER_PERMISSIONS[role])
      );
    }
    // No two roles collapse to the same permissions.
    const signatures = partnerRoles.map((role) =>
      unique(PARTNER_ROLE_PERMISSIONS[role]).sort().join("|")
    );
    expect(new Set(signatures).size).toBe(partnerRoles.length);
    // Owner is the only role with the full set.
    for (const role of partnerRoles) {
      if (role === "owner") continue;
      expect(PARTNER_ROLE_PERMISSIONS[role].length).toBeLessThan(
        PARTNER_ROLE_PERMISSIONS.owner.length
      );
    }
    for (const permission of allPartnerPermissions) {
      expect(partnerHasPermission("owner", permission)).toBe(true);
    }
  });

  it("partner finance can read money but cannot write products or inventory", () => {
    expect(partnerHasPermission("finance", "earnings:read")).toBe(true);
    expect(partnerHasPermission("finance", "statements:read")).toBe(true);
    expect(partnerHasPermission("finance", "settlements:read")).toBe(true);
    expect(partnerCan("finance", "earnings:read", "statements:read")).toBe(true);

    expect(partnerHasPermission("finance", "products:write")).toBe(false);
    expect(partnerHasPermission("finance", "products:read")).toBe(false);
    expect(partnerHasPermission("finance", "inventory:write")).toBe(false);
    expect(partnerCan("finance", "earnings:read", "products:write")).toBe(false);
  });

  it("partner operations cannot access earnings, statements or settlements", () => {
    expect(partnerHasPermission("operations", "earnings:read")).toBe(false);
    expect(partnerHasPermission("operations", "statements:read")).toBe(false);
    expect(partnerHasPermission("operations", "settlements:read")).toBe(false);
    // Operations can still fulfil work, but not edit the catalogue.
    expect(partnerHasPermission("operations", "orders:write")).toBe(true);
    expect(partnerHasPermission("operations", "shipments:write")).toBe(true);
    expect(partnerHasPermission("operations", "inventory:write")).toBe(true);
    expect(partnerHasPermission("operations", "products:read")).toBe(true);
    expect(partnerHasPermission("operations", "products:write")).toBe(false);
    expect(partnerCan("operations", "orders:write", "earnings:read")).toBe(false);
  });

  it("partner viewer can read but cannot perform any write", () => {
    for (const permission of allPartnerPermissions) {
      if (permission.endsWith(":write")) {
        expect(partnerHasPermission("viewer", permission)).toBe(false);
      }
    }
    expect(partnerCan("viewer", "dashboard:read", "products:read", "orders:read")).toBe(true);
    expect(partnerHasPermission("viewer", "earnings:read")).toBe(false);
  });

  it("partner manager can run the catalogue/ops but has no security or settlements", () => {
    expect(partnerHasPermission("manager", "products:write")).toBe(true);
    expect(partnerHasPermission("manager", "inventory:write")).toBe(true);
    expect(partnerHasPermission("manager", "team:write")).toBe(true);
    expect(partnerHasPermission("manager", "earnings:read")).toBe(true);
    expect(partnerHasPermission("manager", "security:write")).toBe(false);
    expect(partnerHasPermission("manager", "settlements:read")).toBe(false);
  });

  it("denies unknown partner roles and permissions (fail closed)", () => {
    const unknownRoles: unknown[] = ["", "hacker", "SUPER_ADMIN", null, undefined, 42];
    for (const role of unknownRoles) {
      for (const permission of allPartnerPermissions) {
        expect(partnerHasPermission(role, permission)).toBe(false);
      }
    }
    for (const role of partnerRoles) {
      expect(partnerHasPermission(role, "bogus:permission" as any)).toBe(false);
      expect(partnerCan(role, "bogus:permission" as any)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Scenario G — boundary between the platform and partner permission domains
// ---------------------------------------------------------------------------

describe("Scenario G — platform/partner permission domain isolation", () => {
  it("the two domains really do have disjoint, domain-unique permissions", () => {
    expect(PLATFORM_ONLY.length).toBeGreaterThan(0);
    expect(PARTNER_ONLY.length).toBeGreaterThan(0);
    expect(PLATFORM_ONLY).toContain("users:write");
    expect(PLATFORM_ONLY).toContain("roles:write");
    expect(PLATFORM_ONLY).toContain("refunds:approve");
    expect(PARTNER_ONLY).toContain("earnings:read");
    expect(PARTNER_ONLY).toContain("security:write");
    expect(PARTNER_ONLY).toContain("team:read");

    // No partner role is granted a platform-only permission and vice versa.
    for (const role of partnerRoles) {
      for (const permission of PARTNER_ROLE_PERMISSIONS[role]) {
        expect(PLATFORM_ONLY).not.toContain(permission);
      }
    }
    for (const role of platformRoles) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(PARTNER_ONLY).not.toContain(permission);
      }
    }
  });

  it("a partner-only role satisfies no platform permission, and vice versa", () => {
    // "owner" exists only in the partner domain — the platform guard does not
    // recognise it, so it can never satisfy any admin permission.
    for (const permission of allPlatformPermissions) {
      expect(hasPermission("owner" as any, permission)).toBe(false);
    }

    // Platform-only roles are not partner roles, so the partner guard denies
    // them every partner permission.
    for (const role of ["super_admin", "admin", "support", "partner"] as Role[]) {
      for (const permission of allPartnerPermissions) {
        expect(partnerHasPermission(role, permission)).toBe(false);
      }
    }
  });

  it("a partner owner cannot access another tenant (permission level)", () => {
    // Tenant isolation itself is proven by the scoped-query tests; at the
    // permission level the invariant is that EVEN the all-powerful partner
    // owner has no cross-tenant / admin-level "partners:*" capability. Its
    // permission set is always exercised against a session-derived partnerId.
    expect(partnerHasPermission("owner", "partners:read" as any)).toBe(false);
    expect(partnerHasPermission("owner", "partners:write" as any)).toBe(false);
    expect(partnerHasPermission("owner", "*" as any)).toBe(false);

    for (const permission of PARTNER_ROLE_PERMISSIONS.owner) {
      expect(permission).not.toContain("partners:");
      expect(permission).not.toContain(":all");
      expect(permission).not.toBe("*");
    }

    // Nor can the partner owner borrow the platform cross-partner read.
    expect(hasPermission("owner" as any, "partners:read")).toBe(false);
    expect(can("owner" as any, "partners:read", "users:read")).toBe(false);
  });
});
