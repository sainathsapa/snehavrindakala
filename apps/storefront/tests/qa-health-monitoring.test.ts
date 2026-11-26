/**
 * FINAL GO — QA production health / monitoring / observability readiness
 * (agent A105).
 *
 * STATIC + PURE ONLY. Nothing here opens a socket, sends a request, writes a
 * row, or uses a credential. It reads deployment files from disk and exercises
 * pure configuration helpers. It answers one question: is the health and
 * observability *wiring* present in the repository, and is it honest?
 *
 * The checks are written as "would fail if the control were removed" assertions:
 * delete a healthcheck, expose TLS off, drop an audit writer, hardcode a secret,
 * or make a presence-report echo a value, and the matching test goes red.
 *
 * Gate honesty: passing these tests means the mechanisms exist in code. It does
 * NOT mean the shop is monitored in production. Error alerting (SENTRY_DSN /
 * MONITORING_CONFIG), a domain + DNS + TLS certificate, and a backup destination
 * are owner inputs and are UNCONFIGURED until supplied — see
 * docs/release/HEALTH_AND_MONITORING.md and OWNER_INPUT_REQUIRED.md.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertProductionConfig,
  validateProductionConfig,
} from "../lib/startup-validation";

const appRoot = join(__dirname, "..");
const repoRoot = join(__dirname, "..", "..", "..");

const readApp = (rel: string): string => readFileSync(join(appRoot, rel), "utf8");
const readRepo = (rel: string): string => readFileSync(join(repoRoot, rel), "utf8");
const existsApp = (rel: string): boolean => existsSync(join(appRoot, rel));

const compose = readRepo("docker-compose.yml");
const caddyfile = readRepo("deploy/Caddyfile");

/** Extract one top-level service block from compose (2-space indent). */
function serviceBlock(name: string): string {
  const lines = compose.split("\n");
  const start = lines.findIndex((line) => line === `  ${name}:`);
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

/* ── 1. Container healthchecks + log rotation ────────────────────────────── */

describe("FINAL GO health: docker-compose healthchecks", () => {
  it("defines a real liveness healthcheck for each core service", () => {
    const postgres = serviceBlock("postgres");
    const redis = serviceBlock("redis");
    const backend = serviceBlock("backend");
    const storefront = serviceBlock("storefront");

    for (const [name, block] of [
      ["postgres", postgres],
      ["redis", redis],
      ["backend", backend],
      ["storefront", storefront],
    ] as const) {
      expect(block, `${name} service missing from compose`).not.toBe("");
      expect(block, `${name} has no healthcheck`).toMatch(/healthcheck:/);
      expect(block, `${name} healthcheck has no test command`).toMatch(/test:/);
      expect(block, `${name} healthcheck has no interval`).toMatch(/interval:/);
      expect(block, `${name} healthcheck has no retries`).toMatch(/retries:/);
    }

    expect(postgres).toMatch(/pg_isready/);
    expect(redis).toMatch(/redis-cli["',\s]+ping/);
    expect(backend).toMatch(/\/health/);
    expect(storefront).toMatch(/wget[\s\S]*127\.0\.0\.1:3000\//);
  });

  it("enforces startup order on health, not container start", () => {
    expect(serviceBlock("backend")).toMatch(/postgres:[\s\S]*condition: service_healthy/);
    expect(serviceBlock("backend")).toMatch(/redis:[\s\S]*condition: service_healthy/);
    expect(serviceBlock("storefront")).toMatch(/backend:[\s\S]*condition: service_healthy/);
    // The former one-shot seed job is now folded into the backend entrypoint.
    // Backend health must imply migrations + provisioning are done, so the
    // storefront never starts against an un-migrated or unprovisioned database.
    expect(serviceBlock("backend")).toMatch(/\/tmp\/store-provisioned/);
    expect(serviceBlock("seed")).toBe("");
  });

  it("uses a slow-start allowance and bounded log rotation (observability)", () => {
    // Migrations and publishable-key resolution take time: without start_period
    // a slow first boot is killed as unhealthy before it answers.
    expect(serviceBlock("backend")).toMatch(/start_period:/);
    expect(serviceBlock("storefront")).toMatch(/start_period:/);

    // Unbounded json-file logs fill a small VM disk and kill the shop.
    expect(compose).toMatch(/x-logging: &default-logging/);
    expect(compose).toMatch(/driver: json-file/);
    expect(compose).toMatch(/max-size:/);
    expect(compose).toMatch(/max-file:/);
    for (const svc of ["postgres", "redis", "backend", "storefront"]) {
      expect(serviceBlock(svc), `${svc} not using bounded logging`).toMatch(
        /logging: \*default-logging/
      );
    }
  });
});

/* ── 2. TLS at the edge (Caddy) ──────────────────────────────────────────── */

describe("FINAL GO monitoring: TLS front door", () => {
  it("Caddy terminates TLS for two hostnames with automatic certificates", () => {
    expect(caddyfile).toMatch(/\{\$STOREFRONT_DOMAIN\}/);
    expect(caddyfile).toMatch(/\{\$API_DOMAIN\}/);
    // Bare hostnames (no scheme) make Caddy obtain/renew certs automatically.
    // An explicit http:// or `auto_https off` would silently ship plaintext.
    expect(caddyfile).not.toMatch(/\bhttp:\/\//);
    expect(caddyfile).not.toMatch(/auto_https\s+off/);
  });

  it("Caddy proxies the right origins and the proxy publishes 443", () => {
    expect(caddyfile).toMatch(/reverse_proxy\s+storefront:3000/);
    expect(caddyfile).toMatch(/reverse_proxy\s+backend:9000/);

    const proxy = serviceBlock("proxy");
    expect(proxy).not.toBe("");
    expect(proxy).toMatch(/"443:443"/);
    expect(proxy).toMatch(/"443:443\/udp"/);
    // Certificates survive container recreation.
    expect(proxy).toMatch(/caddy_data:\/data/);
    expect(compose).toMatch(/caddy_data:/);
  });
});

/* ── 3. Start-up validation exists, is referenced, and fails closed ──────── */

describe("FINAL GO monitoring: production start-up validation", () => {
  const src = readApp("lib/startup-validation.ts");

  it("the module exports the fail-fast gate and its presence-only result", () => {
    expect(existsApp("lib/startup-validation.ts")).toBe(true);
    expect(src).toMatch(/export function validateProductionConfig/);
    expect(src).toMatch(/export function assertProductionConfig/);
    expect(src).toMatch(/export const BASELINE_KEYS/);
    expect(src).toMatch(/export const SESSION_SECRET_KEY/);
  });

  it("is referenced by a unit test and by the release docs", () => {
    const testSrc = readApp("tests/startup-validation.test.ts");
    expect(testSrc).toMatch(/from ["']\.\.\/lib\/startup-validation["']/);
    const ciDoc = readRepo("docs/release/CI_SECURITY.md");
    expect(ciDoc).toMatch(/startup-validation\.ts/);
    expect(ciDoc).toMatch(/assertProductionConfig/);
    const runbook = readRepo("docs/release/PRODUCTION_RUNBOOK.md");
    expect(runbook).toMatch(/startup-validation\.ts/);
  });

  it("bootstrap wiring is present in code OR tracked as a Lead action", () => {
    // At verification time assertProductionConfig is NOT yet called at runtime:
    // CI_SECURITY.md §6 carries the wiring note because this agent may not edit
    // instrumentation.ts. The test passes if wiring exists, and also passes if
    // the outstanding gap is honestly documented — but it fails if wiring is
    // both absent AND undocumented.
    const instrumentation = join(appRoot, "instrumentation.ts");
    if (existsSync(instrumentation)) {
      expect(readFileSync(instrumentation, "utf8")).toMatch(/assertProductionConfig/);
    } else {
      const ciDoc = readRepo("docs/release/CI_SECURITY.md");
      expect(ciDoc).toMatch(/Lead action/);
      expect(ciDoc).toMatch(/instrumentation\.ts/);
      expect(ciDoc).toMatch(/assertProductionConfig/);
    }
  });

  const completeProd = {
    NODE_ENV: "production",
    COOKIE_SECRET: "canary-cookie-secret",
    DATABASE_URL: "postgresql://db/shop",
    ADMIN_EMAIL: "admin@example.test",
    ADMIN_PASSWORD: "canary-admin-password",
    STOREFRONT_BASE_URL: "https://shop.example.test",
  };

  it("production with all baseline settings is ok", () => {
    expect(validateProductionConfig(completeProd)).toMatchObject({
      ok: true,
      missing: [],
    });
  });

  it("production with missing settings fails and names only the variables", () => {
    const result = validateProductionConfig({ NODE_ENV: "production" });
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("COOKIE_SECRET/JWT_SECRET");
    expect(result.missing).toContain("DATABASE_URL");
    expect(result.missing).toContain("ADMIN_EMAIL");
    expect(result.missing).toContain("STOREFRONT_BASE_URL");
    // The result is a presence report: never a value.
    expect(JSON.stringify(result)).not.toMatch(/canary/);
  });

  it("a partially wired integration is treated as enabled, not silently off", () => {
    const result = validateProductionConfig({
      ...completeProd,
      RAZORPAY_KEY_ID: "canary-key-id",
    });
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("RAZORPAY_KEY_SECRET");
    expect(result.missing).toContain("RAZORPAY_WEBHOOK_SECRET");
    expect(JSON.stringify(result)).not.toMatch(/canary-key-id/);
  });

  it("assertProductionConfig throws a safe, name-only message", () => {
    let message = "";
    try {
      assertProductionConfig({ NODE_ENV: "production", DATABASE_URL: "canary-dsn" });
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    }
    expect(message).toMatch(/Production configuration is incomplete/);
    expect(message).toMatch(/COOKIE_SECRET\/JWT_SECRET/);
    expect(message).not.toMatch(/canary-dsn/);
  });

  it("non-production runs stay advisory (CI and local commands still boot)", () => {
    const result = validateProductionConfig({ NODE_ENV: "test" });
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.warnings.join(" ")).toMatch(/advisory|not production/i);
    expect(() => assertProductionConfig({ NODE_ENV: "test" })).not.toThrow();
  });
});

/* ── 4. Presence-only config-status routes ──────────────────────────────── */

describe("FINAL GO monitoring: config-status routes", () => {
  it("v1 route is admin-only and reports presence via the checklist", () => {
    expect(existsApp("app/api/admin/config-status/route.ts")).toBe(true);
    const src = readApp("app/api/admin/config-status/route.ts");
    expect(src).toMatch(/export async function GET/);
    expect(src).toMatch(/requireAdmin\(\)/);
    expect(src).toMatch(/configurationChecklist\(\)/);
    expect(src).toMatch(/status: 401/);
    // The route must not echo env values itself.
    expect(src).not.toMatch(/process\.env/);
  });

  it("owner-input status route is permission-gated and presence-only", () => {
    expect(existsApp("app/api/admin/owner-input-status/route.ts")).toBe(true);
    const src = readApp("app/api/admin/owner-input-status/route.ts");
    expect(src).toMatch(/export async function GET/);
    expect(src).toMatch(/requirePermission\(["']settings:read["']\)/);
    expect(src).toMatch(/validateOwnerInputs\(\)/);
    expect(src).toMatch(/status: 401/);
    expect(src).not.toMatch(/process\.env/);
  });

  it("the admin settings UI actually reads the config-status route", () => {
    expect(readApp("app/admin/settings/page.tsx")).toMatch(/api\/admin\/config-status/);
  });
});

/* ── 5. No real secret values in compose / docs ─────────────────────────── */

describe("FINAL GO monitoring: no secret values in tracked config/docs", () => {
  it("secret settings are interpolated from .env, never hardcoded", () => {
    const secretVars = [
      "JWT_SECRET",
      "COOKIE_SECRET",
      "RAZORPAY_KEY_SECRET",
      "RAZORPAY_WEBHOOK_SECRET",
      "SHIPROCKET_PASSWORD",
      "SHIPROCKET_WEBHOOK_TOKEN",
      "AWS_S3_SECRET_ACCESS_KEY",
      "CRON_SECRET",
      "INTERNAL_NOTIFY_SECRET",
    ];
    for (const name of secretVars) {
      const match = compose.match(new RegExp(`^\\s*${name}:\\s*(.+)$`, "m"));
      expect(match, `${name} is not passed into compose`).not.toBeNull();
      expect(match![1], `${name} is hardcoded instead of interpolated`).toMatch(/\$\{/);
    }
  });

  it("compose, Caddyfile and release docs contain no real credential patterns", () => {
    const mdFiles = readdirSync(join(repoRoot, "docs", "release")).filter((f) =>
      f.endsWith(".md")
    );
    const corpus = [
      compose,
      caddyfile,
      ...mdFiles.map((f) => readRepo(`docs/release/${f}`)),
    ].join("\n");

    // Provider key formats and private keys are unambiguous real secrets.
    expect(corpus).not.toMatch(/AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}/);
    expect(corpus).not.toMatch(/\b(sk_live|rzp_live|rk_live)_[0-9A-Za-z]+/);
    expect(corpus).not.toMatch(/-----BEGIN [A-Z ]*PRIVATE KEY-----/);
    expect(corpus).not.toMatch(/\bghp_[0-9A-Za-z]{20,}\b/);
    expect(corpus).not.toMatch(/\bxox[baprs]-[0-9A-Za-z-]{10,}\b/);
    // A raw long hex blob is how HMAC/session secrets are generated.
    expect(corpus).not.toMatch(/\b[0-9a-f]{32,}\b/);
  });

  it(".env is gitignored so real values never enter the tree", () => {
    expect(readRepo(".gitignore")).toMatch(/^\.env$/m);
  });
});

/* ── 6. Audit logging present ────────────────────────────────────────────── */

describe("FINAL GO monitoring: audit logging", () => {
  it("admin actions are recorded who/what/when in audit_log", () => {
    expect(existsApp("lib/audit.ts")).toBe(true);
    const src = readApp("lib/audit.ts");
    expect(src).toMatch(/recordAdminAction/);
    expect(src).toMatch(/INSERT INTO audit_log/);
    expect(src).toMatch(/user_email/);
    expect(src).toMatch(/action/);
    expect(src).toMatch(/created_at/);
  });

  it("partner actions use an append-only, tenant-scoped audit log", () => {
    expect(existsApp("lib/partner-audit/audit.ts")).toBe(true);
    const src = readApp("lib/partner-audit/audit.ts");
    expect(src).toMatch(/append-only/i);
    expect(src).toMatch(/INSERT INTO partner_audit_log/);
    expect(src).toMatch(/tenantQuery/);
    expect(src).toMatch(/AUDIT_ACTIONS/);
    // Append-only: the audit module has no delete/update escape hatch.
    expect(src).not.toMatch(/DELETE FROM partner_audit_log/);
    expect(src).not.toMatch(/UPDATE partner_audit_log/);
  });

  it("finance writes to the partner audit trail too", () => {
    expect(readApp("lib/finance/commission-policy.ts")).toMatch(
      /INSERT INTO partner_audit_log/
    );
  });

  it("there is a read-only admin audit-log route and UI", () => {
    expect(existsApp("app/api/admin/audit-log/route.ts")).toBe(true);
    const route = readApp("app/api/admin/audit-log/route.ts");
    expect(route).toMatch(/requireAdmin\(\)/);
    expect(route).toMatch(/SELECT \* FROM audit_log/);
    expect(route).not.toMatch(/DELETE FROM audit_log/);
    expect(existsApp("app/admin/audit-log/page.tsx")).toBe(true);
  });

  it("both audit tables are backed by schema/migrations", () => {
    expect(readApp("db/schema.sql")).toMatch(/CREATE TABLE IF NOT EXISTS audit_log/);
    expect(readApp("db/migrations/002_partner_marketplace.sql")).toMatch(
      /CREATE TABLE IF NOT EXISTS partner_audit_log/
    );
  });
});
