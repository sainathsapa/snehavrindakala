import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Every localized page declares itself as its own canonical.
 *
 * Calling `localeAlternates("/x")` without the locale returns the English URL as
 * the canonical, so a Hindi page told a crawler "index the English version
 * instead" — and the Hindi page never ranked, even though hreflang paired them
 * correctly. It is invisible in the browser and invisible in tests that only
 * check status codes, which is exactly why it survived.
 */

const ROOT = join(__dirname, "..");
const LOCALE_TREE = join(ROOT, "app", "[locale]");

/** Calls with no second argument, i.e. no locale. */
const UNLOCALISED = /localeAlternates\(\s*"[^"]*"\s*\)/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

describe("canonical URLs", () => {
  it("are never computed without the locale inside the localized tree", () => {
    const offenders: string[] = [];
    for (const file of walk(LOCALE_TREE)) {
      const source = readFileSync(file, "utf8");
      if (UNLOCALISED.test(source)) {
        offenders.push(relative(ROOT, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
