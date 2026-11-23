/**
 * AGENT A102 — Independent QA: partner portal UI, static + pure checks.
 *
 * This suite verifies, without a running browser or a database, that the partner
 * portal is built from the project's real design system rather than ad-hoc
 * inline styling, that the sidebar actually lists the 14 required sections,
 * that responsive breakpoints are wired into the shell, that no fake credentials
 * or mock records are baked into the pages, and that partner auth is a genuinely
 * separate context from admin auth.
 *
 * What this file CANNOT prove (see docs/release/QA_RESPONSIVE_REPORT.md): real
 * breakpoint rendering, the mobile menu toggle at a real viewport, and that two
 * distinct partner sessions see only their own data. Those need a live browser
 * and owner-supplied partner identities, so they are listed as BLOCKED BY OWNER
 * INPUT rather than silently marked as passing here.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const storefront = join(__dirname, "..");
const partnerDir = join(storefront, "app/partner");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const partnerFiles = walk(partnerDir).filter((f) => /\.(ts|tsx)$/.test(f));

function partner(rel: string): string {
  return readFileSync(join(partnerDir, rel), "utf8");
}
function shared(rel: string): string {
  return readFileSync(join(storefront, rel), "utf8");
}

const layout = partner("layout.tsx");
const nav = partner("components/partner-nav.tsx");
const header = partner("components/partner-header.tsx");
const loginPage = partner("login/page.tsx");
const loginForm = partner("login/login-form.tsx");
const tailwindConfig = shared("tailwind.config.js");
const configTailwind = readFileSync(
  join(storefront, "../../packages/config-tailwind/index.js"),
  "utf8"
);
const partnerSession = shared("lib/partner/session.ts");
const adminSession = shared("lib/admin-session.ts");

/* ─────────────────────────────────────────────────────────────────────────── */

describe("A102 — partner UI uses the real design system, not invented inline styles", () => {
  it("no partner page uses inline style objects or raw colour literals", () => {
    const offenders: string[] = [];
    for (const file of partnerFiles) {
      const source = readFileSync(file, "utf8");
      if (/style\s*=\s*\{\{/.test(source)) offenders.push(`${relative(storefront, file)}: inline style={{}}`);
      if (/#[0-9a-fA-F]{3,8}\b/.test(source)) offenders.push(`${relative(storefront, file)}: raw hex colour`);
      if (/rgba?\(|hsla?\(/.test(source)) offenders.push(`${relative(storefront, file)}: raw rgb/hsl colour`);
    }
    expect(offenders).toEqual([]);
  });

  it("the brand colour tokens the pages rely on are defined in config-tailwind", () => {
    for (const token of [
      "rang-paper",
      "surface",
      "deep-ink",
      "muted-ink",
      "sand-border",
      "sindoor",
      "terracotta",
    ]) {
      expect(configTailwind, `missing brand token ${token}`).toContain(token);
    }
    // The storefront config is the single source of truth for these colours.
    expect(tailwindConfig).toMatch(/configTailwind\.theme\.extend\.colors/);
  });

  it("login and shell use those named tokens via Tailwind utilities", () => {
    for (const cls of [
      "bg-rang-paper",
      "text-deep-ink",
      "text-muted-ink",
      "border-sand-border",
      "bg-surface",
      "text-sindoor",
      "font-serif",
      "font-sans",
    ]) {
      expect(loginPage, `login page missing utility ${cls}`).toContain(cls);
    }
    expect(layout).toContain("bg-rang-paper");
    expect(layout).toContain("font-sans");
    expect(layout).toContain("text-deep-ink");
  });

  it("nav and header use the shared icon library rather than bespoke markup", () => {
    expect(nav).toMatch(/from "@snehavrinda-kala\/ui"/);
    expect(header).toMatch(/from "@snehavrinda-kala\/ui"/);
    expect(nav).toMatch(/<Icon\b/);
    expect(header).toMatch(/<Icon\b/);
  });

  it("the component primitives are safelisted so a page can adopt them safely", () => {
    for (const primitive of [
      "btn-primary",
      "btn-outline",
      "btn-link",
      "section",
      "section-tight",
      "shell",
    ]) {
      expect(tailwindConfig, `primitive ${primitive} not safelisted`).toContain(primitive);
    }
  });
});

/* ─────────────────────────────────────────────────────────────────────────── */

/** The 14 sections the partner portal is contractually required to expose. */
const REQUIRED_SECTIONS = [
  { href: "/partner", label: "Overview" },
  { href: "/partner/notifications", label: "Notifications" },
  { href: "/partner/profile", label: "Business profile" },
  { href: "/partner/products", label: "Products" },
  { href: "/partner/submissions", label: "Product submissions" },
  { href: "/partner/inventory", label: "Inventory" },
  { href: "/partner/orders", label: "Orders" },
  { href: "/partner/shipments", label: "Shipments" },
  { href: "/partner/customers", label: "Customers" },
  { href: "/partner/earnings", label: "Earnings" },
  { href: "/partner/statements", label: "Commission statements" },
  { href: "/partner/settlements", label: "Settlements" },
  { href: "/partner/team", label: "Team" },
  { href: "/partner/security", label: "Security" },
] as const;

describe("A102 — the sidebar lists all 14 required sections", () => {
  const hrefs = [...nav.matchAll(/href:\s*"(\/partner[^"]*)"/g)].map((m) => m[1]);
  const labels = [...nav.matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);
  const titles = [...nav.matchAll(/title:\s*"([^"]+)"/g)].map((m) => m[1]);

  it("declares exactly the 14 required hrefs — no missing and no extra links", () => {
    expect(hrefs).toHaveLength(14);
    expect(new Set(hrefs).size).toBe(14); // no duplicates
    expect([...hrefs].sort()).toEqual(
      REQUIRED_SECTIONS.map((s) => s.href).sort()
    );
  });

  it("gives every section its expected human-readable label", () => {
    for (const section of REQUIRED_SECTIONS) {
      expect(labels, `missing label for ${section.href}`).toContain(section.label);
    }
  });

  it("groups the sections under the five intended group headings", () => {
    expect([...titles].sort()).toEqual(
      ["Workspace", "Catalogue", "Fulfilment", "Finance", "Account"].sort()
    );
  });

  it("drives visibility from the signed-in role, not from hard-coded section lists", () => {
    expect(nav).toMatch(/partnerHasPermission\(role, item\.permission\)/);
    // All but the universally-available Notifications link are permission-gated.
    const permissionCount = [...nav.matchAll(/permission:\s*"[\w:]+"/g)].length;
    expect(permissionCount).toBe(REQUIRED_SECTIONS.length - 1);
  });
});

/* ─────────────────────────────────────────────────────────────────────────── */

describe("A102 — responsive breakpoints are present in the shell", () => {
  it("the layout switches from full-width mobile to an md: sidebar", () => {
    expect(layout).toContain("md:pl-64");
    expect(layout).toMatch(/\bsm:/);
    expect(layout).toMatch(/\bmd:/);
    expect(layout).toMatch(/\blg:/);
    expect(layout).toContain("sm:px-6");
    expect(layout).toContain("lg:px-8");
  });

  it("the nav implements a real mobile drawer with an md: desktop breakpoint", () => {
    expect(nav).toContain("md:hidden");
    expect(nav).toContain("md:translate-x-0");
    expect(nav).toContain("matchMedia(\"(min-width: 768px)\")");
    expect(nav).toMatch(/aria-label="Open menu"/);
    expect(nav).toMatch(/aria-label="Close menu"/);
  });

  it("the header adapts its content at sm: and md:", () => {
    expect(header).toContain("sm:block");
    expect(header).toContain("sm:hidden");
    expect(header).toContain("sm:px-6");
    expect(header).toContain("md:px-8");
  });
});

/* ─────────────────────────────────────────────────────────────────────────── */

describe("A102 — no fabricated credentials or mock records in the pages", () => {
  it("login inputs start empty; no email or password is prefilled", () => {
    expect(loginForm).toMatch(/useState\(""\)/);
    expect(loginForm).not.toMatch(/useState\(\s*["'][^"']*@[^"']*["']\s*\)/);
    expect(loginForm).not.toMatch(/useState\(\s*["'][^"']+["']\s*\)/); // password
  });

  it("no partner file assigns a literal credential or embeds a mock/fixture record", () => {
    const credential = /\b(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*["'][^"']+["']/i;
    const mockMarker = /\b(?:mock|dummy|fixture|sample|fake|demo)[A-Za-z_]*\b/i;
    const gstin = /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/;
    const offenders: string[] = [];
    for (const file of partnerFiles) {
      const source = readFileSync(file, "utf8");
      if (credential.test(source)) offenders.push(`${relative(storefront, file)}: literal credential`);
      if (mockMarker.test(source)) offenders.push(`${relative(storefront, file)}: mock/fixture marker`);
      if (gstin.test(source)) offenders.push(`${relative(storefront, file)}: invented GSTIN`);
    }
    expect(offenders).toEqual([]);
  });

  it("no page hard-codes a commission/payout rate or stock count", () => {
    const offenders: string[] = [];
    for (const file of partnerFiles) {
      const source = readFileSync(file, "utf8");
      if (/\bcommission\s+(?:rate|is|of)?\s*\d+(?:\.\d+)?\s*%/i.test(source)) {
        offenders.push(`${relative(storefront, file)}: commission rate`);
      }
      if (/\bstock\s*[:=]\s*\d+/i.test(source)) {
        offenders.push(`${relative(storefront, file)}: stock count`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

/* ─────────────────────────────────────────────────────────────────────────── */

describe("A102 — partner login is a separate auth context from admin", () => {
  it("the sign-in form posts only to the partner auth endpoint", () => {
    expect(loginForm).toContain('fetch("/api/partner/auth/login"');
    expect(loginForm).not.toMatch(/\/api\/admin|\/admin\/login|verifyAdminSession/);
  });

  it("the shell gate uses partner context, never the admin permission gate", () => {
    expect(layout).toMatch(/requirePartnerContext/);
    expect(layout).not.toMatch(/requirePermission|@\/app\/admin\/actions|@\/lib\/admin\b/);
    expect(loginPage).not.toMatch(/@\/app\/admin\/actions|@\/lib\/admin\b|requirePermission|ADMIN_SESSION/);
  });

  it("partner and admin sessions use distinct cookie names and signing namespaces", () => {
    expect(partnerSession).toContain('PARTNER_SESSION_COOKIE = "svk_partner_session"');
    expect(adminSession).toContain('ADMIN_SESSION_COOKIE = "svk_admin_session"');
    expect(partnerSession).toContain("svk:partner-session:v1");
    expect(partnerSession).toMatch(/PARTNER_SESSION_SECRET/);
    // The partner token is never accepted by the admin verifier and vice versa.
    expect(partnerSession).not.toMatch(/getAdminSessionSecret|svk_admin_session/);
    expect(adminSession).not.toMatch(/PARTNER_SESSION|svk_partner_session/);
  });

  it("auth screens are listed as public so signing out / resetting cannot loop", () => {
    for (const path of ["/partner/login", "/partner/reset", "/partner/logout"]) {
      expect(layout, `${path} must be reachable while signed out`).toContain(`"${path}"`);
    }
    // Protected sections are deliberately NOT public.
    expect(layout).not.toContain('"/partner"');
    expect(layout).not.toContain('"/partner/products"');
    expect(layout).toContain('redirect("/partner/login")');
  });

  it("PURE CHECK: path normalisation classifies auth vs protected paths correctly", () => {
    // Pure replica of isPublicPartnerPath's normalisation — no headers(), no I/O.
    const publicPaths = ["/partner/login", "/partner/reset", "/partner/logout"];
    const isPublic = (raw: string): boolean => {
      const pathname = raw.split("?")[0].replace(/\/+$/, "") || "/";
      return publicPaths.includes(pathname);
    };
    for (const raw of [
      "/partner/login",
      "/partner/login?next=/partner/products",
      "/partner/login///",
      "/partner/reset",
      "/partner/logout",
    ]) {
      expect(isPublic(raw), raw).toBe(true);
    }
    for (const raw of [
      "/partner",
      "/partner/products",
      "/partner/earnings",
      "/admin/login",
    ]) {
      expect(isPublic(raw), raw).toBe(false);
    }
    // The source actually performs this normalisation.
    expect(layout).toContain('.split("?")[0]');
    expect(layout).toContain('replace(/\\/+$/, "")');
  });
});
