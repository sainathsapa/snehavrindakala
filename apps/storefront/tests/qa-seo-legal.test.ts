/**
 * QA A97 — SEO + legal regression guard (FINAL GO mission).
 *
 * Static + pure checks only: no browser, no database, no network, no live
 * systems. Re-verifies that the earlier SEO/legal remediation is still present
 * and has not been weakened by later work.
 *
 * IMPORTANT: this file does NOT approve legal content. Legal sign-off remains
 * BLOCKED BY OWNER INPUT — the grievance-officer/legal identity and the policy
 * sign-off are still open owner tasks (see the last describe block).
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const exists = (path: string) => existsSync(join(root, path));

/** Key public pages that must self-canonicalise via localeAlternates(). */
const canonicalPages = [
  "app/[locale]/art-forms/page.tsx",
  "app/[locale]/disclaimer/page.tsx",
  "app/[locale]/faq/page.tsx",
  "app/[locale]/policies/privacy/page.tsx",
  "app/[locale]/policies/terms/page.tsx",
  "app/[locale]/policies/shipping/page.tsx",
  "app/[locale]/policies/returns/page.tsx",
  "app/[locale]/policies/cookie/page.tsx",
  "app/[locale]/sell/page.tsx",
  "app/[locale]/seller/page.tsx",
  "app/[locale]/artists/[slug]/page.tsx",
  "app/[locale]/shop/[category]/page.tsx",
  "app/[locale]/products/[handle]/page.tsx",
];

describe("QA-SEO-01 canonicals still present on key pages", () => {
  it("the layout no longer hard-codes a global canonical and delegates to localeAlternates", () => {
    const layout = read("app/[locale]/layout.tsx");
    expect(layout).not.toMatch(/canonical:\s*"\/"/);
    expect(layout).toMatch(/localeAlternates\("\/",\s*locale\)/);
  });

  it("localeAlternates self-canonicalises a translated page", () => {
    const seo = read("lib/seo.ts");
    expect(seo).toMatch(
      /export function localeAlternates\(\s*path: string,\s*locale\?: string/
    );
    expect(seo).toMatch(/canonical: locale \? canonicalFor\(path, locale\)/);
    expect(seo).toMatch(/export function canonicalFor\(/);
  });

  it.each(canonicalPages)("%s calls localeAlternates", (page) => {
    expect(exists(page), `${page} is missing`).toBe(true);
    expect(read(page), page).toMatch(/localeAlternates\(/);
  });

  it("dynamic routes did not regress to a bare canonical", () => {
    for (const page of [
      "app/[locale]/artists/[slug]/page.tsx",
      "app/[locale]/shop/[category]/page.tsx",
      "app/[locale]/products/[handle]/page.tsx",
    ]) {
      expect(read(page), page).not.toMatch(/alternates:\s*\{\s*canonical:/);
    }
  });
});

/** Pure parser: pull hreflang key/value template literals out of source text. */
function hreflangPairs(source: string): { key: string; value: string }[] {
  const pairs: { key: string; value: string }[] = [];
  const keys = new Set(["en", "hi", "x-default"]);
  for (const entry of source.matchAll(/["']?([\w-]+)["']?:\s*`([^`]*)`/g)) {
    if (keys.has(entry[1])) pairs.push({ key: entry[1], value: entry[2] });
  }
  return pairs;
}

describe("QA-SEO-02 sitemap has absolute hreflang alternates", () => {
  const sitemap = read("app/sitemap.ts");

  it("every hreflang value is a fully-qualified URL built from baseUrl", () => {
    const pairs = hreflangPairs(sitemap);
    expect(pairs.length, "expected hreflang language blocks").toBeGreaterThan(0);
    for (const { key, value } of pairs) {
      expect(value.startsWith("${baseUrl}"), `${key} -> ${value}`).toBe(true);
    }
    expect(new Set(pairs.map((p) => p.key))).toEqual(
      new Set(["en", "hi", "x-default"])
    );
  });

  it("baseUrl is absolute and trailing-slash-free", () => {
    expect(sitemap).toMatch(/NEXT_PUBLIC_STOREFRONT_URL \|\| "http:\/\/localhost:3000"/);
    expect(sitemap).toContain('.replace(/\\/$/, "")');
  });

  it("lists the bilingual home, a section page, and the cookie policy", () => {
    expect(sitemap).toMatch(/\/policies\/cookie/);
    expect(sitemap).toMatch(/\/policies\/privacy/);
    expect(sitemap).toMatch(/hi\$\{path\}/);
  });
});

describe("QA-ANA-01 analytics is consent-gated and denied by default", () => {
  it("Consent Mode defaults to denied before gtag config", () => {
    const layout = read("app/[locale]/layout.tsx");
    const deny = layout.indexOf("gtag('consent', 'default'");
    const config = layout.indexOf("gtag('config'");
    expect(deny).toBeGreaterThan(-1);
    expect(config).toBeGreaterThan(deny);
    expect(layout).toMatch(/analytics_storage: 'denied'/);
  });

  it("the banner is only mounted when a measurement id is configured", () => {
    const layout = read("app/[locale]/layout.tsx");
    expect(layout).toMatch(/gaMeasurementId && \(/);
    expect(layout).toMatch(/<AnalyticsConsent \/>/);
  });

  it("every GA event passes through a configured + granted gate", () => {
    const analytics = read("lib/analytics.ts");
    expect(analytics).toMatch(/if \(!analyticsConfigured\(\)\) return;/);
    expect(analytics).toMatch(/getAnalyticsConsent\(\) !== "granted"\) return/);
    // No direct DB dependency in the client-safe analytics module.
    expect(analytics).not.toMatch(/from "@\/lib\/db"/);
  });

  it("a visitor can accept, decline, and reopen the banner", () => {
    const consent = read("components/analytics-consent.tsx");
    expect(consent).toMatch(/setAnalyticsConsent\("granted"\)/);
    expect(consent).toMatch(/setAnalyticsConsent\("denied"\)/);
    expect(consent).toMatch(/OPEN_CONSENT_EVENT/);
  });
});

describe("QA-LEG-01 cookie policy page exists and is linked", () => {
  const cookiePagePath = "app/[locale]/policies/cookie/page.tsx";

  it("the cookie policy page exists with its own canonical", () => {
    expect(exists(cookiePagePath), `${cookiePagePath} is missing`).toBe(true);
    const page = read(cookiePagePath);
    expect(page).toMatch(/localeAlternates\("\/policies\/cookie", locale\)/);
    expect(page).toMatch(/t\("reviewLabel"\)/);
    expect(page).toMatch(/t\("reviewNote"\)/);
  });

  it("is linked from the footer, the consent banner, and the sitemap", () => {
    expect(read("components/footer.tsx")).toMatch(/href: "\/policies\/cookie"/);
    expect(read("components/analytics-consent.tsx")).toMatch(
      /href="\/policies\/cookie"/
    );
    expect(read("app/sitemap.ts")).toMatch(/\/policies\/cookie/);
  });

  it("offers a way to reopen consent settings from the cookie page and footer", () => {
    expect(read(cookiePagePath)).toMatch(/CookieSettingsButton/);
    expect(read("components/footer.tsx")).toMatch(/CookieSettingsButton/);
  });

  it("carries the review note in both message catalogues", () => {
    const en = read("messages/en.json");
    const hi = read("messages/hi.json");
    expect(en).toMatch(/"reviewLabel": "Under review"/);
    expect(en).toMatch(
      /not a complete or legally reviewed inventory/
    );
    expect(en).toMatch(/still need review by the studio/);
    expect(hi).toMatch(/"reviewLabel":/);
    expect(hi).toMatch(/"reviewNote":/);
  });
});

describe("QA-LEG-02 data export + deletion request API still present", () => {
  const routePath = "app/api/account/data/route.ts";

  it("the API exists and exposes authenticated GET and POST", () => {
    expect(exists(routePath), `${routePath} is missing`).toBe(true);
    const source = read(routePath);
    expect(source).toMatch(/export async function GET\(/);
    expect(source).toMatch(/export async function POST\(/);
    expect(source).toMatch(/getAuthToken\(\)/);
    expect(source).toMatch(/status: 401/);
  });

  it("exports the requested data categories", () => {
    const source = read(routePath);
    for (const section of [
      "profile",
      "orders",
      "wishlist",
      "newsletter",
      "commissions",
      "tickets",
    ]) {
      expect(source, `missing ${section}`).toMatch(new RegExp(`\\b${section}\\b`));
    }
  });

  it("records a pending deletion request instead of hard-deleting data", () => {
    const source = read(routePath);
    expect(source).toMatch(/INSERT INTO audit_log/);
    expect(source).toMatch(/data_deletion_request/);
    expect(source).toMatch(/status: "pending"/);
    expect(source).toMatch(/status: 202/);
    expect(source).not.toMatch(/CREATE TABLE IF NOT EXISTS/);
    expect(source).not.toMatch(
      /DELETE FROM (customer|order|users|support_tickets|newsletter_subscribers)/
    );
  });
});

describe("QA-LEG-03 owner-review placeholders, no invented grievance identity", () => {
  it("the cookie page copy deliberately avoids a legal entity/grievance officer/regulator", () => {
    const page = read("app/[locale]/policies/cookie/page.tsx");
    expect(page).toMatch(/does not name a legal entity/);
    expect(page).toMatch(/grievance officer, or a regulator/);
    // Content comes from translations, not a hard-coded identity.
    expect(page).toMatch(/getTranslations\("cookiePolicy"\)/);
  });

  it("policy text routes grievances through a generic channel, not a named officer", () => {
    const en = read("messages/en.json");
    expect(en).toMatch(/Disputes or grievances can be raised through our contact channel/);
    expect(en).toMatch(/For access, correction, or deletion requests, contact us at hello@snehavrinda\.in/);
    // No fabricated officer title / legal entity has been inserted into the copy.
    expect(en).not.toMatch(/grievance officer\s*[:—-]/i);
    expect(en).not.toMatch(/nodal officer/i);
  });

  it("policy pages exist and keep their locale-aware canonicals", () => {
    for (const page of [
      "app/[locale]/policies/privacy/page.tsx",
      "app/[locale]/policies/terms/page.tsx",
      "app/[locale]/policies/shipping/page.tsx",
      "app/[locale]/policies/returns/page.tsx",
    ]) {
      expect(exists(page), `${page} is missing`).toBe(true);
      expect(read(page), page).toMatch(/localeAlternates\(/);
    }
  });

  it("legal sign-off is NOT approved — BLOCKED BY OWNER INPUT", () => {
    const ownerInputs = read("../../docs/release/OWNER_INPUT_REQUIRED.md");
    const blockers = read("../../docs/release/RELEASE_BLOCKERS.md");
    const prodConfig = read("../../docs/release/PRODUCTION_CONFIGURATION.md");

    // Still open, unchecked owner tasks — not silently closed by code.
    expect(ownerInputs).toMatch(/- \[ \] Grievance officer contact/);
    expect(ownerInputs).toMatch(/- \[ \] Privacy \/ refunds \/ terms policy sign-off/);
    expect(prodConfig).toMatch(
      /- \[ \] Seller\/contact\/grievance identity for policy pages\./
    );
    expect(blockers).toMatch(/\|\s*LEGAL\s*\|/);
  });
});
