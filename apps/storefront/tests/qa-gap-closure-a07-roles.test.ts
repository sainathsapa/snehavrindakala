/**
 * A10 INDEPENDENT QA — A07 role namespacing (pure + static only).
 *
 * Independently pins canonical + legacy values, cross-namespace fail-closed
 * behaviour, the platformRoleOrNull()/getAdminIdentity() boundary, and that
 * migration 006 only widens a CHECK (no data change).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  canonicalPartnerRole,
  isCanonicalPartnerRole,
  isPartnerOwnerRole,
  isPartnerRole,
  partnerRoleOrNull,
} from "@/lib/partner/types";
import {
  canonicalPlatformRole,
  hasPermission,
  isRole,
  platformRoleOrNull,
} from "@/lib/rbac";

const app = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(app, rel), "utf8");

describe("A07 — canonical + legacy values resolve inside their own namespace", () => {
  it("partner roles accept canonical and legacy spellings and canonicalise", () => {
    for (const canonical of [
      "partner_owner", "partner_manager", "partner_operations",
      "partner_finance", "partner_viewer",
    ]) {
      expect(isPartnerRole(canonical)).toBe(true);
      expect(isCanonicalPartnerRole(canonical)).toBe(true);
      expect(partnerRoleOrNull(canonical)).toBe(canonical);
      expect(canonicalPartnerRole(canonical)).toBe(canonical);
    }
    const legacyMap: Record<string, string> = {
      owner: "partner_owner",
      manager: "partner_manager",
      operations: "partner_operations",
      finance: "partner_finance",
      viewer: "partner_viewer",
    };
    for (const [legacy, canonical] of Object.entries(legacyMap)) {
      expect(isPartnerRole(legacy)).toBe(true);
      expect(partnerRoleOrNull(legacy)).toBe(canonical);
      expect(isCanonicalPartnerRole(legacy)).toBe(false);
    }
    expect(isPartnerOwnerRole("owner")).toBe(true);
    expect(isPartnerOwnerRole("partner_owner")).toBe(true);
    expect(isPartnerOwnerRole("platform_admin")).toBe(false);
  });

  it("platform roles accept canonical and legacy spellings and canonicalise", () => {
    expect(canonicalPlatformRole("super_admin")).toBe("platform_super_admin");
    expect(canonicalPlatformRole("finance")).toBe("platform_finance");
    expect(canonicalPlatformRole("platform_viewer")).toBe("platform_viewer");
    expect(canonicalPlatformRole("partner_finance")).toBeNull();
    expect(isRole("platform_finance")).toBe(true);
  });
});

describe("A07 — cross-namespace values fail closed", () => {
  it("partner-only roles cannot become a platform role", () => {
    for (const partnerRole of [
      "partner_owner", "partner_manager", "partner_operations",
      "partner_finance", "partner_viewer", "owner",
    ]) {
      expect(platformRoleOrNull(partnerRole)).toBeNull();
    }
  });

  it("platform-only roles cannot become a partner role", () => {
    for (const platformRole of [
      "platform_super_admin", "platform_admin", "platform_finance",
      "super_admin", "admin", "support",
    ]) {
      expect(partnerRoleOrNull(platformRole)).toBeNull();
    }
  });

  it("an ambiguous legacy string maps to a DIFFERENT role in each matrix", () => {
    expect(partnerRoleOrNull("finance")).toBe("partner_finance");
    expect(platformRoleOrNull("finance")).toBe("finance"); // legacy platform alias
    expect(partnerRoleOrNull("finance")).not.toBe(platformRoleOrNull("finance"));
    // A partner_* value is never a key in the platform permission matrix.
    expect(isRole("partner_finance")).toBe(false);
    expect(hasPermission("partner_finance", "finance:read" as any)).toBe(false);
  });

  it("unknown roles are denied by both matrices", () => {
    expect(partnerRoleOrNull("super_admin")).toBeNull();
    expect(platformRoleOrNull("owner")).toBeNull();
    expect(partnerRoleOrNull("wat")).toBeNull();
    expect(platformRoleOrNull("wat")).toBeNull();
  });
});

describe("A07 — getAdminIdentity() boundary preserved", () => {
  it("platformRoleOrNull()+canonicalPlatformRole() gate both session branches", () => {
    const src = read("app/admin/actions.ts");
    expect(src).toMatch(/platformRoleOrNull/);
    expect(src).toMatch(/canonicalPlatformRole/);
    // DB-backed branch and env-admin branch both refuse when canonical is null.
    const nullGuards = src.match(/if \(!canonical\) return null;/g) ?? [];
    expect(nullGuards.length).toBeGreaterThanOrEqual(2);
    expect(src).toMatch(/getAdminIdentity/);
  });
});

describe("A07 — migration 006 only widens a CHECK", () => {
  it("drops the legacy role CHECK and adds a wider allow-list", () => {
    const m = read("db/migrations/006_role_namespacing.sql");
    expect(m).toMatch(/DROP CONSTRAINT/i);
    expect(m).toMatch(/partner_membership_role_namespaced_check/);
    expect(m).toMatch(/'partner_owner'/);
    // Legacy values remain valid during the rollout.
    for (const legacy of ["owner", "manager", "operations", "finance", "viewer"]) {
      expect(m).toMatch(new RegExp(`'${legacy}'`));
    }
  });

  it("006 performs no data change and has a forward-recovery note", () => {
    const m = read("db/migrations/006_role_namespacing.sql");
    const stripped = m.replace(/--[^\n]*/g, "");
    expect(stripped).not.toMatch(/\bUPDATE\b|\bDELETE\s+FROM\b|\bTRUNCATE\b|\bDROP TABLE\b/i);
    expect(m).toMatch(/forward recovery/i);
    expect(m).toMatch(/DOES NOT modify, delete or reassign any existing business row/i);
  });
});
