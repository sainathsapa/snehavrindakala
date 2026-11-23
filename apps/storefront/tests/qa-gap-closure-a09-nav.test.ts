/**
 * A10 INDEPENDENT QA — A09 partner nav (pure + static only).
 *
 * Independently verifies that /partner/audit and /partner/submissions are in
 * the sidebar with correct labels and advisory gates, and that each page's
 * server-side permission gate matches the nav gate.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  NAV_GROUPS,
  isNavItemActive,
  visibleNavGroups,
} from "@/app/partner/components/partner-nav";
import { partnerHasPermission, type PartnerPermission } from "@/lib/partner/rbac";
import type { PartnerRole } from "@/lib/partner/types";

const app = join(__dirname, "..");
const read = (rel: string) => readFileSync(join(app, rel), "utf8");
const items = NAV_GROUPS.flatMap((g) => g.items);
const at = (href: string) => items.find((i) => i.href === href);

describe("A09 — new links present with correct labels and gates", () => {
  it("/partner/audit is labelled 'Audit trail' and gated on profile:read", () => {
    const item = at("/partner/audit");
    expect(item).toBeDefined();
    expect(item!.label).toBe("Audit trail");
    expect(item!.permission).toBe("profile:read");
  });

  it("/partner/submissions is labelled 'Product submissions' and gated on products:read", () => {
    const item = at("/partner/submissions");
    expect(item).toBeDefined();
    expect(item!.label).toBe("Product submissions");
    expect(item!.permission).toBe("products:read");
  });

  it("each target page exists and its server-side gate equals the nav gate", () => {
    const auditPage = read("app/partner/audit/page.tsx");
    expect(auditPage).toMatch(/requirePartnerPermission\(["']profile:read["']\)/);
    expect(at("/partner/audit")!.permission).toBe("profile:read");

    const submissionsPage = read("app/partner/submissions/page.tsx");
    expect(submissionsPage).toMatch(/requirePartnerPermission\(["']products:read["']\)/);
    expect(at("/partner/submissions")!.permission).toBe("products:read");
  });

  it("advisory filtering uses the same partner permission matrix as the pages", () => {
    const financeGroups = visibleNavGroups("finance" as PartnerRole);
    const financeHrefs = financeGroups.flatMap((g) => g.items.map((i) => i.href));
    // Finance has profile:read but not products:read.
    expect(partnerHasPermission("finance", "profile:read" as PartnerPermission)).toBe(true);
    expect(partnerHasPermission("finance", "products:read" as PartnerPermission)).toBe(false);
    expect(financeHrefs).toContain("/partner/audit");
    expect(financeHrefs).not.toContain("/partner/submissions");

    const viewerHrefs = visibleNavGroups("viewer" as PartnerRole).flatMap((g) =>
      g.items.map((i) => i.href)
    );
    expect(viewerHrefs).toContain("/partner/audit");
    expect(viewerHrefs).toContain("/partner/submissions");
  });

  it("active-route matcher handles query strings, trailing slashes and nested paths", () => {
    expect(isNavItemActive("/partner/audit", "/partner/audit")).toBe(true);
    expect(isNavItemActive("/partner/audit?tab=x", "/partner/audit")).toBe(true);
    expect(isNavItemActive("/partner/audit/", "/partner/audit")).toBe(true);
    expect(isNavItemActive("/partner/submissions/new", "/partner/submissions")).toBe(true);
    expect(isNavItemActive("/partner/audit", "/partner/submissions")).toBe(false);
  });
});
