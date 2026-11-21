/**
 * Reachability checks.
 *
 * The worst bug found in this codebase was not a crash: the footer posted email
 * addresses to `/api/newsletter`, which had never been written. Nothing failed
 * loudly, so the shop quietly discarded every signup for months. The test that
 * would have caught it is cheap — for every `action="/api/..."` there must be a
 * route file — so here it is, widened to cover fetch targets, admin navigation
 * and the two message bundles.
 *
 * These are static checks on purpose. They run in milliseconds, need no browser,
 * and they fail on the exact class of mistake that silence hides.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const sourceFiles = walk(root).filter((file) =>
  /\.(ts|tsx)$/.test(file) && !file.includes("/tests/")
);

const apiRoutes = new Set(
  sourceFiles
    .map((file) => relative(root, file))
    .map((file) => file.match(/^app\/api\/(.*)\/route\.ts$/)?.[1])
    .filter((match): match is string => Boolean(match))
    // Dynamic segments compare as `:param`, so `[id]` and `[refundId]` both work.
    .map((path) => path.replace(/\[[^\]]+\]/g, ":"))
);

/** Normalises a URL found in source into the same shape as `apiRoutes`. */
function normalise(url: string): string {
  return url
    .replace(/^\/api\//, "")
    .replace(/[?#].*$/, "")
    .replace(/\$\{[^}]*\}/g, ":")
    .replace(/\[[^\]]+\]/g, ":")
    .replace(/\/+$/, "");
}

function routeExists(called: string): boolean {
  if (!called) return false;
  for (const route of apiRoutes) {
    if (route === called) return true;
    // `/store/wishlist` matches its own route; `/store/orders/:id/shipment`
    // matches a dynamic one. A called path may also be longer than the route
    // only if the route ends in a dynamic segment, so require equal length.
    const routeParts = route.split("/");
    const calledParts = called.split("/");
    if (routeParts.length !== calledParts.length) continue;
    if (routeParts.every((part, index) => part === ":" || part === calledParts[index])) {
      return true;
    }
  }
  return false;
}

describe("API routes referenced from code", () => {
  it("finds a route file for every /api/… the UI calls", () => {
    const missing: string[] = [];

    for (const file of sourceFiles) {
      // `middleware.ts` holds path *matchers* (`/api/admin/:path*`) rather than
      // calls, so it is excluded: a matcher for a route that does not exist is
      // not a broken link, it is a guard that never fires.
      if (file.endsWith("middleware.ts")) continue;
      const source = readFileSync(file, "utf8");
      // `fetch("/api/…")`, `action="/api/…"`, and `useSWR("/api/…")`-style calls.
      const pattern = /["'`]\/api\/([A-Za-z0-9_\-/[\].${}]+)/g;
      for (const match of source.matchAll(pattern)) {
        // A trailing slash means a prefix (`/api/admin/`), not an endpoint.
        if (/\/$/.test(match[0])) continue;
        const called = normalise(match[0].slice(1));
        // A bare `/api/` prefix with nothing after it is not a call.
        if (!called) continue;
        if (!routeExists(called)) {
          missing.push(`${relative(root, file)} → /api/${match[1]}`);
        }
      }
    }

    expect(missing, `these calls have no route:\n${missing.join("\n")}`).toEqual([]);
  });

  it("has at least the routes the shop cannot work without", () => {
    for (const path of [
      "newsletter",
      "store/work-alerts",
      "store/wishlist",
      "store/checkout/gift",
      "admin/refunds",
      "admin/carts/remind",
      "cron/cart-reminders",
    ]) {
      expect(apiRoutes.has(path), `missing route: ${path}`).toBe(true);
    }
  });
});

describe("admin navigation", () => {
  it("points at pages that exist", () => {
    const pages = new Set(
      sourceFiles
        .map((file) => relative(root, file))
        .map((file) => file.match(/^app\/(.*)\/page\.tsx$/)?.[1])
        .filter((match): match is string => Boolean(match))
        .map((path) => `/${path}`.replace(/\[[^\]]+\]/g, ":"))
    );

    const chrome = readFileSync(join(root, "components/admin-chrome.tsx"), "utf8");
    const hrefs = [...chrome.matchAll(/href: "(\/admin[^"]*)"/g)].map((m) => m[1]);

    const missing = hrefs.filter((href) => !pages.has(href.replace(/\/$/, "")));
    expect(missing, `admin nav points nowhere: ${missing.join(", ")}`).toEqual([]);
  });
});

describe("message bundles", () => {
  const flatten = (value: unknown, prefix = ""): Map<string, string> => {
    const out = new Map<string, string>();
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (child && typeof child === "object") {
          for (const [k, v] of flatten(child, path)) out.set(k, v);
        } else {
          out.set(path, String(child ?? ""));
        }
      }
    }
    return out;
  };

  const en = flatten(JSON.parse(readFileSync(join(root, "messages/en.json"), "utf8")));
  const hi = flatten(JSON.parse(readFileSync(join(root, "messages/hi.json"), "utf8")));

  it("has the same keys in English and Hindi", () => {
    const onlyEn = [...en.keys()].filter((key) => !hi.has(key));
    const onlyHi = [...hi.keys()].filter((key) => !en.has(key));
    expect(onlyEn, `untranslated: ${onlyEn.slice(0, 10).join(", ")}`).toEqual([]);
    expect(onlyHi, `orphaned: ${onlyHi.slice(0, 10).join(", ")}`).toEqual([]);
  });

  it("has no empty strings", () => {
    for (const [name, bundle] of [["en", en], ["hi", hi]] as const) {
      const empty = [...bundle.entries()]
        .filter(([, value]) => value.trim() === "")
        .map(([key]) => key);
      expect(empty, `${name} has empty values: ${empty.slice(0, 10).join(", ")}`).toEqual([]);
    }
  });

  it("does not leave English text in the Hindi bundle", () => {
    // Keys whose value is identical to English and contains no Devanagari: brand
    // names and short codes are fine, whole sentences are not.
    const suspicious = [...hi.entries()]
      .filter(([key, value]) => {
        const english = en.get(key);
        return (
          english !== undefined &&
          value === english &&
          /[A-Za-z]{4,}\s+[A-Za-z]{3,}/.test(value) &&
          !/[\u0900-\u097F]/.test(value)
        );
      })
      .map(([key]) => key);
    expect(
      suspicious,
      `these Hindi strings are still English: ${suspicious.slice(0, 10).join(", ")}`
    ).toEqual([]);
  });
});
