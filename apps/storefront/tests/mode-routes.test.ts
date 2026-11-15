/**
 * Guards the single-brand / platform split.
 *
 * One codebase serves two products selected by `PLATFORM_MODE`, and the two
 * directories are mutually exclusive: `/makers` 404s in platform mode and
 * `/artists` 404s in single-brand mode.
 *
 * This is not hypothetical. The PDP record block linked every maker to
 * `/makers#<slug>` unconditionally, which put a dead link behind the maker's
 * name on all twenty-one product pages in platform mode. Nothing caught it,
 * because the development env is single-brand by default and the link looked
 * perfectly correct there.
 *
 * The test below therefore checks the property that actually broke — no source
 * file may hardcode a link to a mode-exclusive route without reading the mode —
 * rather than trying to render React trees, which would be brittle and would
 * not have caught it either.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(__dirname, "..");

/** Routes that exist in exactly one of the two modes. */
const MODE_EXCLUSIVE = ["/makers", "/artists", "/sell"];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Files that are allowed to name these routes, each for a stated reason.
 */
const ALLOWED = [
  // The pages themselves, and the router that owns the mode branch.
  "app/[locale]/makers/page.tsx",
  "app/[locale]/artists/page.tsx",
  "app/[locale]/sell/page.tsx",
  "app/sitemap.ts",
  "lib/settings.ts",
  // The PDP resolves the correct directory per mode before rendering.
  "app/[locale]/products/[handle]/page.tsx",
  // Layout decides which nav entries to show, based on the mode.
  "app/[locale]/layout.tsx",
  "app/[locale]/page.tsx",
  // A detail page linking to its own parent directory on the same side of the
  // split — /artists/[slug] can only be reached when /artists exists.
  "app/[locale]/artists/[slug]/page.tsx",
  "components/header.tsx",
  "components/footer.tsx",
];

/** Playwright specs drive the UI and may name any route, in any mode. */
const IS_TEST_FILE = (rel: string) =>
  rel.startsWith("tests/") || rel.startsWith("e2e/");

describe("mode-exclusive routes", () => {
  it("are never hardcoded outside a file that reads the mode", () => {
    const offenders: string[] = [];

    for (const file of walk(ROOT)) {
      const rel = relative(ROOT, file);
      if (ALLOWED.some((a) => rel.endsWith(a))) continue;
      if (IS_TEST_FILE(rel)) continue;

      const source = readFileSync(file, "utf8");

      for (const route of MODE_EXCLUSIVE) {
        // Match the route as the start of an href value, in any quoting style
        // JSX or a string literal produces. Prose mentions are ignored, which
        // is why this looks for `href=` rather than the bare path.
        const linkPattern = new RegExp(
          `href=[^"'\`]{0,4}["'\`]${route}(?=["'\`/#?]|$)`
        );
        if (linkPattern.test(source)) {
          offenders.push(`${rel} -> ${route}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
