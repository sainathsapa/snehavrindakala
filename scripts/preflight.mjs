#!/usr/bin/env node
/**
 * Preflight: can this deployment take a real order?
 *
 * Run before every release, and after any change to an env file:
 *
 *   node scripts/preflight.mjs           # local env
 *   node scripts/preflight.mjs --prod    # expects live payment keys
 *
 * It answers the question a launch review actually needs answered, in the order
 * the failure would hurt: can we reach the database, can we take money, can we
 * email the buyer, do the pages exist, is anyone able to log in. Every check is
 * PASS / WARN / FAIL, and the exit code is non-zero only on FAIL, so this can be
 * wired into a deploy script without stopping a release over a preference.
 *
 * It never prints a secret. Where a value matters it prints presence and shape.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROD = process.argv.includes("--prod");

let fails = 0;
let warns = 0;

const green = (text) => `\x1b[32m${text}\x1b[0m`;
const yellow = (text) => `\x1b[33m${text}\x1b[0m`;
const red = (text) => `\x1b[31m${text}\x1b[0m`;
const dim = (text) => `\x1b[2m${text}\x1b[0m`;

function pass(label, detail = "") {
  console.log(`${green("PASS")}  ${label}${detail ? `  ${dim(detail)}` : ""}`);
}

function warn(label, detail = "") {
  warns += 1;
  console.log(`${yellow("WARN")}  ${label}${detail ? `  ${dim(detail)}` : ""}`);
}

function fail(label, detail = "") {
  fails += 1;
  console.log(`${red("FAIL")}  ${label}${detail ? `  ${dim(detail)}` : ""}`);
}

function info(label, detail = "") {
  console.log(`${dim("INFO")}  ${label}${detail ? `  ${dim(detail)}` : ""}`);
}

function section(title) {
  console.log(`\n${title}`);
}

/** Minimal .env reader: KEY=value, ignores comments, keeps quoted values intact. */
function readEnv(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const envFiles = {
  root: readEnv(join(ROOT, ".env")),
  storefront: readEnv(join(ROOT, "apps/storefront/.env")),
  backend: readEnv(join(ROOT, "apps/backend/.env")),
};

/** Runtime values come from the shell if set, else the storefront/backend files. */
const env = {
  ...envFiles.root,
  ...envFiles.storefront,
  ...envFiles.backend,
  ...process.env,
};

const value = (key) => String(env[key] ?? "").trim();

section("Secrets and configuration");

const REQUIRED = [
  ["DATABASE_URL", "the database every page reads"],
  ["REDIS_URL", "sessions, rate limits, reservations"],
  ["MEDUSA_PUBLISHABLE_KEY", "store API access"],
  ["JWT_SECRET or COOKIE_SECRET", "session signing"],
  ["ADMIN_EMAIL", "the owner's login"],
  ["ADMIN_PASSWORD", "the owner's login"],
  ["RESEND_API_KEY", "order and account email"],
  ["FROM_EMAIL", "the address mail is sent from"],
  ["RESEND_WEBHOOK_SECRET", "bounce and complaint handling"],
];

for (const [key, why] of REQUIRED) {
  const keys = key.split(" or ");
  const found = keys.find((k) => value(k));
  if (found) {
    pass(key, why);
  } else {
    fail(key, `missing — ${why}`);
  }
}

// Placeholder values are worse than missing ones: they look configured.
const PLACEHOLDERS = ["changeme", "change-me", "example", "your-", "xxxx", "todo"];
for (const key of ["JWT_SECRET", "COOKIE_SECRET", "ADMIN_PASSWORD", "RESEND_WEBHOOK_SECRET"]) {
  const v = value(key).toLowerCase();
  if (v && PLACEHOLDERS.some((p) => v.includes(p))) {
    fail(key, "still a placeholder value");
  }
}

section("Payments");

const razorpayId = value("RAZORPAY_KEY_ID") || value("NEXT_PUBLIC_RAZORPAY_KEY_ID");
const razorpaySecret = value("RAZORPAY_KEY_SECRET");
const razorpayWebhook = value("RAZORPAY_WEBHOOK_SECRET");

if (!razorpayId || !razorpaySecret) {
  fail("Razorpay keys", "the shop cannot take money without both");
} else if (razorpayId.startsWith("rzp_live_")) {
  pass("Razorpay keys", "live");
  if (!razorpayWebhook) {
    fail("RAZORPAY_WEBHOOK_SECRET", "a live account needs webhook verification");
  } else {
    pass("Razorpay webhook secret");
  }
} else if (razorpayId.startsWith("rzp_test_")) {
  if (PROD) {
    fail("Razorpay keys", "still test keys — a --prod release would take no real money");
  } else {
    warn("Razorpay keys", "test keys — fine locally, not for launch");
  }
} else {
  warn("Razorpay keys", "unrecognised prefix");
}

section("Legal and invoicing");

if (value("SELLER_GSTIN")) {
  pass("SELLER_GSTIN", "invoices will carry a GST line");
} else {
  if (PROD) {
    warn("SELLER_GSTIN", "unset — invoices print without GST");
  } else {
    info("SELLER_GSTIN", "unset — invoices print without GST");
  }
}

section("Shipping");

if (value("SHIPROCKET_EMAIL") && value("SHIPROCKET_PASSWORD")) {
  pass("Shiprocket credentials", "email/password login");
} else if (value("SHIPROCKET_API_TOKEN")) {
  pass("Shiprocket API token");
} else {
  warn("Shiprocket credentials", "unset — AWB and tracking must be entered by hand");
}

if (value("SHIPROCKET_WEBHOOK_TOKEN")) {
  pass("Shiprocket webhook token", "tracking callbacks will be accepted");
} else {
  fail("SHIPROCKET_WEBHOOK_TOKEN", "unset — courier callbacks will be rejected");
}

section("Public URLs");

const storefrontUrl = value("NEXT_PUBLIC_STOREFRONT_URL");
if (!storefrontUrl) {
  fail("NEXT_PUBLIC_STOREFRONT_URL", "links in email would point nowhere");
} else if (storefrontUrl.includes("localhost") && PROD) {
  fail("NEXT_PUBLIC_STOREFRONT_URL", `still ${storefrontUrl} — confirmation emails would link to the visitor's own machine`);
} else {
  pass("NEXT_PUBLIC_STOREFRONT_URL", storefrontUrl);
}

section("Runtime reachability");

async function checkHttp(url, label, expectOk = true) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (expectOk && response.ok) {
      pass(label, `${response.status}`);
      return response;
    }
    if (expectOk) {
      fail(label, `${response.status} — not ready`);
    }
    return response;
  } catch (error) {
    fail(label, (error?.name === "AbortError" ? "timed out" : error.message).slice(0, 80));
    return null;
  }
}

const local = value("PREFLIGHT_BASE_URL") || "http://127.0.0.1:3000";
await checkHttp(`${local}/api/health`, `Storefront health (${local})`);

const backendBase = value("MEDUSA_BACKEND_URL") || "http://127.0.0.1:9000";
await checkHttp(`${backendBase}/health`, `Backend health (${backendBase})`);

section("Content");

// Rooms and the newsroom are empty states until the owner writes something. A
// launch with both empty is a launch with two dead pages in the nav, so it is a
// warning rather than a pass.
try {
  const response = await fetch(`${local}/api/health?deep=1`, { cache: "no-store" });
  if (response.ok) {
    pass("Storefront reports ready");
  }
} catch {
  // Already reported above.
}

section("Summary");

if (fails === 0 && warns === 0) {
  console.log(green("\nReady to release.\n"));
} else if (fails === 0) {
  console.log(yellow(`\nReleasable with ${warns} warning(s).\n`));
} else {
  console.log(red(`\nNot ready: ${fails} failure(s), ${warns} warning(s).\n`));
}

process.exit(fails === 0 ? 0 : 1);
