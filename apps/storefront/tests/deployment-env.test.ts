import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Every environment variable the code reads has to reach the container that
 * reads it.
 *
 * This is not hypothetical. `REFUND_APPROVAL_THRESHOLD`, `ABANDONED_CART_HOURS`,
 * `PLATFORM_MODE` and `STOREFRONT_BASE_URL` were all read by storefront code and
 * passed to no container, so in a `docker compose` deployment the two-admin
 * refund rule and the "unfinished" cutoff silently used their built-in defaults
 * no matter what the operator wrote in `.env`. `SHIPROCKET_WEBHOOK_TOKEN` did the
 * same to the backend's tracking callbacks. Nothing looked broken: the fallbacks
 * are sensible numbers, so the only symptom was an operator's setting quietly
 * not applying.
 *
 * The check is per service block, resolved through the shared anchor. An earlier
 * version searched the whole file and passed while the storefront still received
 * none of these values, because the names were in the backend's anchor and the
 * storefront service does not use it.
 */

const repoRoot = join(__dirname, "..", "..", "..");
const compose = readFileSync(join(repoRoot, "docker-compose.yml"), "utf8");

function serviceBlock(name: string): string {
  const lines = compose.split("\n");
  const start = lines.findIndex((l) => l === `  ${name}:`);
  if (start === -1) return "";
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^  [a-z][a-z-]*:$/.test(lines[i]) || /^[a-z]/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

/** Resolve `<<: *backend-environment`: an anchored name counts for its users. */
function envTextFor(service: string): string {
  let block = serviceBlock(service);
  if (block.includes("<<: *backend-environment")) {
    const anchorStart = compose.indexOf("x-backend-environment: &backend-environment");
    const anchorEnd = compose.indexOf("\n\n", anchorStart);
    block += "\n" + compose.slice(anchorStart, anchorEnd);
  }
  return block;
}

const SERVICE_ENV = {
  backend: envTextFor("backend"),
  storefront: envTextFor("storefront"),
};

/**
 * Names that legitimately never appear in compose.
 *
 * Kept short on purpose: adding to this list is how the guard gets defeated, so
 * each entry says why it cannot be a deployment variable.
 */
const ALLOWED: Record<string, string> = {
  // Build-time switch for the browser bundle; set by CI, not by a server.
  NEXT_PUBLIC_SANITY_PROJECT_ID: "build-time, injected by CI for studio previews",
  // Harness switches. Setting them in a deployment would be a test run against
  // real customers.
  E2E_DISABLE_RATE_LIMIT: "test harness only",
  NODE_ENV: "set by Next itself",
};

function sourceFiles(dir: string, exts = [".ts", ".tsx"]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "dist") continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...sourceFiles(full, exts));
    else if (exts.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

type Where = { file: string; service: "backend" | "storefront" };

function envNamesIn(files: string[]): Map<string, Where> {
  const names = new Map<string, Where>();
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const service: Where["service"] = file.includes("/apps/backend/")
      ? "backend"
      : "storefront";
    for (const match of text.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
      if (!names.has(match[1])) {
        names.set(match[1], { file: file.replace(repoRoot + "/", ""), service });
      }
    }
  }
  return names;
}

const readNames = envNamesIn([
  ...sourceFiles(join(repoRoot, "apps", "backend", "src")),
  ...sourceFiles(join(repoRoot, "apps", "storefront", "lib")),
  ...sourceFiles(join(repoRoot, "apps", "storefront", "app")),
]);

describe("deployment environment", () => {
  it("reads a believable number of variables", () => {
    // A quiet guard against the walker silently finding nothing.
    expect(readNames.size).toBeGreaterThan(30);
  });

  it("passes every variable into the container whose code reads it", () => {
    const missing = [...readNames]
      .filter(([name, where]) => !ALLOWED[name] && !SERVICE_ENV[where.service].includes(name))
      .map(
        ([name, where]) =>
          `${name} (read in ${where.file}, missing from the ${where.service} service)`
      );

    expect(missing).toEqual([]);
  });

  it("keeps the allowlist honest", () => {
    for (const name of Object.keys(ALLOWED)) {
      // An allowlisted name that is in no service block, or is read nowhere, is
      // stale and should be deleted rather than left to hide a future gap.
      const used = readNames.has(name);
      const passed = Object.values(SERVICE_ENV).some((block) => block.includes(name));
      expect(used || passed, `${name} is stale`).toBe(true);
    }
  });

  it("the refund threshold and the cart cutoff reach the storefront", () => {
    // Named individually because these two decide money and messaging.
    for (const name of ["REFUND_APPROVAL_THRESHOLD", "ABANDONED_CART_HOURS"]) {
      expect(readNames.has(name), `${name} is no longer read`).toBe(true);
      expect(
        SERVICE_ENV.storefront.includes(name),
        `${name} is not passed to the storefront service`
      ).toBe(true);
    }
  });
});
