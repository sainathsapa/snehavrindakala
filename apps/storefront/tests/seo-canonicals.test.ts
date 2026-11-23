import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const pages = [
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

describe("SEO-01 per-page canonicals", () => {
  it("no longer sets a hard-coded global canonical in the layout", () => {
    const layout = read("app/[locale]/layout.tsx");
    expect(layout).not.toMatch(/canonical:\s*"\/"/);
    expect(layout).toMatch(/localeAlternates\("\/",\s*locale\)/);
  });

  it("localeAlternates can self-canonicalise a translated page", () => {
    const seo = read("lib/seo.ts");
    expect(seo).toMatch(/export function localeAlternates\(\s*path: string,\s*locale\?: string/);
    expect(seo).toMatch(/canonical: locale \? canonicalFor\(path, locale\)/);
  });

  it.each(pages)("%s uses localeAlternates", (page) => {
    expect(read(page)).toMatch(/localeAlternates\(/);
  });

  it("the three routes that dropped hreflang no longer set a bare canonical", () => {
    for (const page of [
      "app/[locale]/artists/[slug]/page.tsx",
      "app/[locale]/shop/[category]/page.tsx",
      "app/[locale]/products/[handle]/page.tsx",
    ]) {
      expect(read(page), page).not.toMatch(/alternates:\s*\{\s*canonical:/);
    }
  });
});

describe("SEO-02 sitemap hreflang", () => {
  const sitemap = read("app/sitemap.ts");

  it("uses absolute URLs for every alternate", () => {
    expect(sitemap).toMatch(/en: `\$\{baseUrl\}\$\{en\}`/);
    expect(sitemap).toMatch(/hi: `\$\{baseUrl\}\$\{hi\}`/);
  });

  it("lists the cookie policy", () => {
    expect(sitemap).toMatch(/\/policies\/cookie/);
  });
});
