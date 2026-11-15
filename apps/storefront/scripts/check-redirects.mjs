#!/usr/bin/env node
/**
 * Verify that every redirect destination in next.config.js actually resolves.
 *
 * Why this exists: a `permanent: true` redirect is a promise to a crawler that
 * the old URL has moved somewhere good. When the destination is itself a 404,
 * the crawler drops the old URL and indexes the broken one instead. That is
 * exactly what happened to five seed-product redirects, and nothing in the
 * build noticed because the redirect table is static and the catalogue is not.
 *
 * The redirect list cannot be imported from a Next config — it is wrapped by
 * `withNextIntl` — so it is parsed out of the file text. That keeps this script
 * dependency-free and free of a second copy of the table that could drift.
 *
 * Usage:
 *   node scripts/check-redirects.mjs                     # against localhost:3000
 *   node scripts/check-redirects.mjs http://localhost:3001
 *   node scripts/check-redirects.mjs https://snehavrinda.in
 *
 * Exit codes:
 *   0  every hop ends on a 200
 *   1  at least one redirect is broken
 *   2  the target is not running this repository's redirect table, so no score
 *      was produced (see the guard below)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const configPath = join(here, "..", "next.config.js");
const base = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");

const source = readFileSync(configPath, "utf8");

// Match the object literals of the redirect array, tolerating either quote
// style and any spacing. Only `source`/`destination` are needed here.
const pairPattern =
  /source:\s*["']([^"']+)["']\s*,\s*destination:\s*["']([^"']+)["']/g;

const redirects = [];
for (const match of source.matchAll(pairPattern)) {
  redirects.push({ from: match[1], to: match[2] });
}

if (redirects.length === 0) {
  console.error("No redirects found in next.config.js — has the format changed?");
  process.exit(1);
}

let failures = 0;

// Guard against silently auditing the wrong server.
//
// The default target is localhost:3000, which on a developer machine is often a
// stale container left running from an earlier session. Auditing that instead
// of the build under test produced a confident, entirely false "1/6 redirects
// resolve" while the real build was passing 6/6 — the worst kind of result,
// because it looks like a regression rather than a mistake in the harness.
//
// Reachability is not a usable signal: a stale server answers happily and even
// has its own (different) redirects for the same URLs. What distinguishes the
// builds is the redirect *table* itself. So one known rule is used as a
// fingerprint — if the server does not send `/products/001` where this config
// says it should, it is not running this config and the run refuses to score.
const fingerprint = redirects[0];
if (fingerprint) {
  let actual = "";
  try {
    const res = await fetch(`${base}${fingerprint.from}`, { redirect: "manual" });
    actual = res.headers.get("location") || "";
  } catch {
    actual = "";
  }

  // Compare on path only; the Location header may be absolute.
  let actualPath = actual;
  try {
    actualPath = actual ? new URL(actual, base).pathname : "";
  } catch {
    actualPath = actual;
  }

  if (actualPath && actualPath !== fingerprint.to) {
    console.error(
      `REFUSING to score ${base} — it is not serving this repository's ` +
        `redirect table.\n` +
        `  ${fingerprint.from} -> ${actualPath || "(no redirect)"}\n` +
        `  next.config.js says -> ${fingerprint.to}\n` +
        `Pass the origin of the build under test, e.g. ` +
        `node scripts/check-redirects.mjs http://localhost:3001`
    );
    process.exit(2);
  }
}

for (const { from, to } of redirects) {
  // `redirect: "manual"` so the hop is observed rather than followed, which
  // lets us report both the status of the redirect and of its destination.
  let hopStatus = 0;
  let location = "";
  try {
    const hop = await fetch(`${base}${from}`, { redirect: "manual" });
    hopStatus = hop.status;
    location = hop.headers.get("location") || "";
  } catch (error) {
    console.error(`ERR   ${from} — could not reach ${base}: ${error.message}`);
    failures += 1;
    continue;
  }

  const isRedirect = hopStatus === 301 || hopStatus === 308 || hopStatus === 307;
  if (!isRedirect) {
    console.error(`FAIL  ${from} -> expected a redirect, got ${hopStatus}`);
    failures += 1;
    continue;
  }

  // The Location header may be absolute. Compare paths, not origins, so the
  // check works the same against localhost and production.
  const landedPath = location.startsWith("http")
    ? new URL(location).pathname
    : location;
  if (landedPath !== to) {
    console.error(
      `FAIL  ${from} -> redirected to ${landedPath}, config says ${to}`
    );
    failures += 1;
    continue;
  }

  let destStatus = 0;
  try {
    const dest = await fetch(`${base}${to}`, { redirect: "manual" });
    destStatus = dest.status;
  } catch (error) {
    console.error(`ERR   ${from} -> ${to} — ${error.message}`);
    failures += 1;
    continue;
  }

  if (destStatus !== 200) {
    console.error(`FAIL  ${from} -> ${to} resolves ${destStatus}, not 200`);
    failures += 1;
  } else {
    console.log(`ok    ${from} -> ${to} (200)`);
  }
}

console.log(
  `\n${redirects.length - failures}/${redirects.length} redirects resolve.`
);
process.exit(failures === 0 ? 0 : 1);
