/**
 * AGENT A09 — partner sidebar navigation (static + pure assertions).
 *
 * Verifies that the two new partner pages are linked from the sidebar, that
 * their advisory visibility gate mirrors each page's server-side permission
 * gate, that the active-route matcher handles query strings / trailing slashes /
 * nested paths without lighting up the portal root everywhere, that the same
 * entries are present in the mobile drawer, and that no client-side partner or
 * tenant identifier ever enters the nav.
 *
 * No browser, DB, cookie or clock is involved. The nav is a client component
 * because of the mobile toggle / pathname hook, but the three exported helpers
 * below are pure and are called directly; everything else is a source check.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  NAV_GROUPS,
  isNavItemActive,
  visibleNavGroups,
} from "@/app/partner/components/partner-nav";
import { partnerHasPermission } from "@/lib/partner/rbac";
import type { PartnerRole } from "@/lib/partner/types";

const storefront = join(__dirname, "..");
const read = (path: string): string =>
  readFileSync(join(storefront, path), "utf8");

const navSource = read("app/partner/components/partner-nav.tsx");
const layoutSource = read("app/partner/layout.tsx");
const auditPageSource = read("app/partner/audit/page.tsx");
const submissionsPageSource = read("app/partner/submissions/page.tsx");
const iconSource = readFileSync(
  join(storefront, "../../packages/ui/src/icons.tsx"),
  "utf8"
);

const allItems = NAV_GROUPS.flatMap((group) => group.items);
const itemAt = (href: string) => allItems.find((item) => item.href === href);
const UNKNOWN_ROLE = "unknown-role" as PartnerRole;
const ROLES: PartnerRole[] = [
  "owner",
  "manager",
  "operations",
  "finance",
  "viewer",
  UNKNOWN_ROLE,
];

/* ─────────────────────────────────────────────────────────────────────────── */

describe("A09 — both new routes are present with the right labels and gates", () => {
  it("links /partner/audit as 'Audit trail' behind profile:read", () => {
    const audit = itemAt("/partner/audit");
    expect(audit, "missing /partner/audit nav entry").toBeDefined();
    expect(audit?.label).toBe("Audit trail");
    expect(audit?.permission).toBe("profile:read");
  });

  it("links /partner/submissions as 'Product submissions' behind products:read", () => {
    const submissions = itemAt("/partner/submissions");
    expect(submissions, "missing /partner/submissions nav entry").toBeDefined();
    expect(submissions?.label).toBe("Product submissions");
    expect(submissions?.permission).toBe("products:read");
  });

  it("replaces the legacy ?status=all shortcut instead of duplicating it", () => {
    expect(allItems.filter((item) => item.label === "Product submissions")).toHaveLength(1);
    expect(allItems.some((item) => item.href.includes("?"))).toBe(false);
    expect(navSource).not.toContain("?status=all");
  });

  it("uses only icons that exist in the shared design system", () => {
    const iconNames = new Set(
      Array.from(iconSource.matchAll(/^\s*\|\s*"([^"]+)"/gm), (m) => m[1])
    );
    for (const item of allItems) {
      expect(iconNames.has(item.icon), `icon "${item.icon}" is not in the design system`).toBe(
        true
      );
    }
    expect(itemAt("/partner/audit")?.icon).toBe("audit-log");
  });

  it("keeps each nav gate identical to the page's server-side requirePartnerPermission gate", () => {
    const gateOf = (source: string): string | undefined =>
      source.match(/requirePartnerPermission\(\s*["']([\w:]+)["']\s*\)/)?.[1];
    expect(gateOf(auditPageSource)).toBe(itemAt("/partner/audit")?.permission);
    expect(gateOf(submissionsPageSource)).toBe(itemAt("/partner/submissions")?.permission);
    expect(gateOf(auditPageSource)).toBe("profile:read");
    expect(gateOf(submissionsPageSource)).toBe("products:read");
  });
});

/* ─────────────────────────────────────────────────────────────────────────── */

describe("A09 — permission-aware visibility", () => {
  const visibleHrefs = (role: PartnerRole): string[] =>
    visibleNavGroups(role).flatMap((group) => group.items.map((item) => item.href));

  it("shows the audit trail only to roles that actually hold profile:read", () => {
    for (const role of ROLES) {
      expect(visibleHrefs(role).includes("/partner/audit"), role).toBe(
        partnerHasPermission(role, "profile:read")
      );
    }
    // Every valid role holds profile:read, so the audit link is visible to all
    // of them; an unrecognised role is still denied by partnerHasPermission.
    for (const role of ROLES.filter((r) => r !== UNKNOWN_ROLE)) {
      expect(partnerHasPermission(role, "profile:read"), role).toBe(true);
      expect(visibleHrefs(role), role).toContain("/partner/audit");
    }
    expect(visibleHrefs(UNKNOWN_ROLE)).not.toContain("/partner/audit");
  });

  it("shows submissions only to roles that actually hold products:read", () => {
    for (const role of ROLES) {
      expect(visibleHrefs(role).includes("/partner/submissions"), role).toBe(
        partnerHasPermission(role, "products:read")
      );
    }
    expect(visibleHrefs("finance")).not.toContain("/partner/submissions");
    expect(visibleHrefs(UNKNOWN_ROLE)).not.toContain("/partner/submissions");
  });

  it("fails closed for an unrecognised role (no permission-gated entries)", () => {
    const visible = visibleNavGroups(UNKNOWN_ROLE);
    // The only entry without a permission is the universally available
    // Notifications link; an unknown role must never receive a gated entry.
    expect(visible.flatMap((g) => g.items).every((item) => !item.permission)).toBe(true);
    expect(visible.flatMap((g) => g.items).map((i) => i.href)).toEqual([
      "/partner/notifications",
    ]);
    expect(visible.flatMap((g) => g.items).map((i) => i.href)).not.toContain(
      "/partner/audit"
    );
    expect(visible.flatMap((g) => g.items).map((i) => i.href)).not.toContain(
      "/partner/submissions"
    );
  });

  it("filters through the shared partnerHasPermission helper, not a hand-written list", () => {
    expect(navSource).toMatch(/partnerHasPermission\(role, item\.permission\)/);
    expect(navSource).toMatch(/visibleNavGroups\(role\)/);
  });
});

/* ─────────────────────────────────────────────────────────────────────────── */

describe("A09 — active-route state (pure isNavItemActive)", () => {
  it("matches exact paths for both new routes", () => {
    expect(isNavItemActive("/partner/audit", "/partner/audit")).toBe(true);
    expect(isNavItemActive("/partner/submissions", "/partner/submissions")).toBe(true);
  });

  it("ignores query strings on either side", () => {
    expect(isNavItemActive("/partner/audit?tab=all", "/partner/audit")).toBe(true);
    expect(isNavItemActive("/partner/audit", "/partner/audit?tab=all")).toBe(true);
    expect(isNavItemActive("/partner/submissions?status=approved", "/partner/submissions")).toBe(
      true
    );
    expect(isNavItemActive("/partner/submissions", "/partner/submissions?status=approved")).toBe(
      true
    );
  });

  it("tolerates trailing slashes", () => {
    expect(isNavItemActive("/partner/audit/", "/partner/audit")).toBe(true);
    expect(isNavItemActive("/partner/audit", "/partner/audit/")).toBe(true);
    expect(isNavItemActive("/partner/submissions///", "/partner/submissions")).toBe(true);
  });

  it("matches nested child paths but not sibling or merely prefix-similar paths", () => {
    expect(isNavItemActive("/partner/submissions/sub-123", "/partner/submissions")).toBe(true);
    expect(isNavItemActive("/partner/audit/entry/42", "/partner/audit")).toBe(true);
    expect(isNavItemActive("/partner/products", "/partner/submissions")).toBe(false);
    expect(isNavItemActive("/partner/auditing", "/partner/audit")).toBe(false);
    expect(isNavItemActive("/partner/submissions-archive", "/partner/submissions")).toBe(false);
  });

  it("does not mark Overview active across the whole portal", () => {
    expect(isNavItemActive("/partner", "/partner")).toBe(true);
    expect(isNavItemActive("/partner/", "/partner")).toBe(true);
    expect(isNavItemActive("/partner/orders", "/partner")).toBe(false);
    expect(isNavItemActive("/partner/audit", "/partner")).toBe(false);
  });

  it("fails closed on empty input and never lets '/' match everything", () => {
    expect(isNavItemActive("", "/partner/submissions")).toBe(false);
    expect(isNavItemActive("/partner/audit", "")).toBe(false);
    expect(isNavItemActive("/", "/")).toBe(true);
    expect(isNavItemActive("/partner/audit", "/")).toBe(false);
  });

  it("drives aria-current from the exported helper", () => {
    expect(navSource).toMatch(/isNavItemActive\(pathname, item\.href\)/);
    expect(navSource).toMatch(/aria-current=\{isActive \? "page" : undefined\}/);
  });
});

/* ─────────────────────────────────────────────────────────────────────────── */

describe("A09 — mobile drawer contains the same entries", () => {
  it("renders one shared group/item loop inside the drawer aside", () => {
    expect(navSource.match(/\{groups\.map\(/g) ?? []).toHaveLength(1);
    expect(navSource.match(/\{group\.items\.map\(/g) ?? []).toHaveLength(1);
    expect(navSource).toMatch(/<aside[\s\S]*<nav[\s\S]*group\.items\.map\([\s\S]*<\/nav>[\s\S]*<\/aside>/);
  });

  it("keeps the drawer's open/close wiring and md: breakpoint intact", () => {
    for (const token of [
      'md:hidden',
      "md:translate-x-0",
      'matchMedia("(min-width: 768px)")',
      'aria-label="Open menu"',
      'aria-label="Close menu"',
      "setCollapsed(true)",
      "setCollapsed(false)",
    ]) {
      expect(navSource, `mobile drawer lost ${token}`).toContain(token);
    }
    expect(navSource).toMatch(/<Link[\s\S]*href=\{item\.href\}[\s\S]*onClick=\{\(\) => setCollapsed\(true\)\}/);
  });

  it("the permitted role sees both entries in the shared (drawer) data source", () => {
    const ownerHrefs = visibleNavGroups("owner").flatMap((g) => g.items.map((i) => i.href));
    expect(ownerHrefs).toContain("/partner/audit");
    expect(ownerHrefs).toContain("/partner/submissions");
  });
});

/* ─────────────────────────────────────────────────────────────────────────── */

describe("A09 — no raw partner id / client tenant id; gates stay server-side", () => {
  it("the nav takes only the server-derived role and reads no client identifiers", () => {
    expect(navSource).toMatch(/export function PartnerNav\(\{ role \}: \{ role: PartnerRole \}\)/);
    for (const forbidden of [
      /partner[_-]?id/i,
      /tenant[_-]?id/i,
      /\bsearchParams\b/,
      /\bheaders\s*\(/,
      /\bcookies\s*\(/,
      /\bparams\b/,
      /\bpid\b/,
      /[?&]partner=/,
    ]) {
      expect(forbidden.test(navSource), `nav leaked a client id via ${forbidden}`).toBe(false);
    }
  });

  it("the layout passes only ctx.role from the verified server context", () => {
    expect(layoutSource).toMatch(/requirePartnerContext\(\)/);
    expect(layoutSource).toMatch(/<PartnerNav role=\{ctx\.role\} \/>/);
    expect(layoutSource).not.toMatch(/<PartnerNav[^>]*partnerId|<PartnerNav[^>]*tenantId/);
  });

  it("direct navigation stays authorized: both pages keep their server gates and redirect", () => {
    for (const [source, label] of [
      [auditPageSource, "audit"],
      [submissionsPageSource, "submissions"],
    ] as const) {
      expect(source, `${label} page lost its server gate`).toMatch(
        /requirePartnerPermission\(\s*["'](?:profile|products):read["']\s*\)/
      );
      expect(source, `${label} page lost its unauthenticated redirect`).toMatch(
        /redirect\(["']\/partner\/login["']\)/
      );
      expect(source, `${label} page started reading a client tenant id`).not.toMatch(
        /partner[_-]?id\s*[:=]|\bsearchParams\b|\bheaders\s*\(/
      );
    }
  });
});
