import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { isValidEmail, normalizeEmail } from "../lib/newsletter";

const ROOT = join(__dirname, "..");

describe("normalizeEmail", () => {
  it("trims and lowercases so one person is one row", () => {
    expect(normalizeEmail("  Sneha@Example.COM ")).toBe("sneha@example.com");
  });

  it("returns an empty string for anything that is not a string", () => {
    expect(normalizeEmail(null)).toBe("");
    expect(normalizeEmail(42)).toBe("");
    expect(normalizeEmail(undefined)).toBe("");
  });
});

describe("isValidEmail", () => {
  it("accepts ordinary addresses", () => {
    for (const email of [
      "sneha@example.com",
      "a.b+tag@sub.domain.co.in",
      "first_last@example.org",
    ]) {
      expect(isValidEmail(email), email).toBe(true);
    }
  });

  it("rejects what is almost certainly a typo", () => {
    for (const email of [
      "",
      "sneha",
      "sneha@",
      "@example.com",
      "sneha@example",
      "sneha@@example.com",
      "sneha @example.com",
      "sneha@exa mple.com",
      "sneha@.com",
      "sneha@example..com",
    ]) {
      expect(isValidEmail(email), email).toBe(false);
    }
  });

  it("refuses addresses longer than the 254-character limit", () => {
    const long = `${"a".repeat(250)}@example.com`;
    expect(isValidEmail(long)).toBe(false);
  });
});

/**
 * The bug that motivated this file.
 *
 * The footer posted to `/api/newsletter` for as long as the footer has existed,
 * and no such route was ever written: every signup was answered with a 404 and
 * discarded. Nothing failed loudly, because a plain HTML form posting to a
 * missing route just navigates to an error page.
 *
 * This walks the source for form actions pointing at the site's own API and
 * asserts the route file is there, so the next missing endpoint is a test
 * failure rather than a feature nobody can tell is broken.
 */
describe("form actions point at routes that exist", () => {
  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.tsx?$/.test(entry)) out.push(full);
    }
    return out;
  }

  const files = [...walk(join(ROOT, "app")), ...walk(join(ROOT, "components"))];

  const actions = files.flatMap((file) => {
    const source = readFileSync(file, "utf8");
    const found: { action: string; file: string }[] = [];
    for (const match of source.matchAll(/action="(\/api\/[^"]*)"/g)) {
      found.push({ action: match[1], file });
    }
    return found;
  });

  it("finds the forms it is meant to check", () => {
    // If the regex stops matching, the test below passes vacuously.
    expect(actions.length).toBeGreaterThan(0);
  });

  it("resolves every /api form action to a route handler", () => {
    const missing = actions
      .map(({ action }) => action.split("?")[0])
      .filter((action) => {
        const route = join(ROOT, "app", action.replace(/^\//, ""), "route.ts");
        try {
          return !statSync(route).isFile();
        } catch {
          return true;
        }
      });

    expect(missing).toEqual([]);
  });
});
