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
 *   node scripts/check-redirects.mjs https://snehavrinda.in
 *
 * Exit code 0 only when every hop ends on a 200.
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
