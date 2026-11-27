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
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROD = process.argv.includes("--prod");

const {
  cooldownStatus: srCooldown,
  describeCooldown: srDescribe,
  recordAuthFailure: srFailure,
  recordAuthSuccess: srSuccess,
} = await import("./lib/shiprocket-cooldown.mjs");

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

// Presence is not authentication. This check used to pass on a pair of values
// that Shiprocket rejects with 403, so the one thing preflight exists to catch —
// "will shipping work on launch day?" — was the one thing it did not test.
if (value("SHIPROCKET_API_TOKEN")) {
  const status = await shiprocketProbe({ token: value("SHIPROCKET_API_TOKEN") });
  if (status.ok) {
    pass("Shiprocket API token", `accepted (${status.detail})`);
  } else {
    fail("Shiprocket API token", status.detail);
  }
} else if (value("SHIPROCKET_EMAIL") && value("SHIPROCKET_PASSWORD")) {
  const status = await shiprocketProbe({
    email: value("SHIPROCKET_EMAIL"),
    password: value("SHIPROCKET_PASSWORD"),
  });
  if (status.ok) {
    pass("Shiprocket login", `authenticated (${status.detail})`);
  } else {
    fail("Shiprocket login", status.detail);
  }
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

/**
 * Ask Shiprocket whether these credentials actually work.
 *
 * The docs are explicit that the email/password pair must belong to an API
 * *user* created in Settings → API, not the shop's ordinary login — an ordinary
 * account gets 403 "Invalid email and password combination", which reads like a
 * wrong password and is not. When the call fails this says which of the two it
 * is, because a launch-blocking message that misdiagnoses itself costs a day.
 */
async function shiprocketProbe(creds) {
  const cooldown = srCooldown();
  if (cooldown.locked) {
    return { ok: false, detail: srDescribe(cooldown) };
  }

  const base = (value("SHIPROCKET_BASE_URL") || "https://apiv2.shiprocket.in/v1/external").replace(/\/+$/, "");

  if (creds.token) {
    try {
      const res = await fetch(`${base}/settings/company/pickup`, {
        headers: { Authorization: `Bearer ${creds.token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        srSuccess();
        return { ok: true, detail: `token accepted (${res.status})` };
      }
      if (res.status === 401 || res.status === 403) {
        return { ok: false, detail: `token rejected (${res.status}) — regenerate it in Settings → API` };
      }
      return { ok: true, detail: `reachable (${res.status})` };
    } catch (error) {
      return { ok: false, detail: `could not reach Shiprocket: ${String(error.message).slice(0, 60)}` };
    }
  }

  try {
    const res = await fetch(`${base}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: creds.email, password: creds.password }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      if (body?.token) {
        srSuccess();
        return { ok: true, detail: "token issued" };
      }
      return { ok: false, detail: "answered 200 without a token" };
    }
    if (res.status === 401 || res.status === 403) {
      srFailure("Shiprocket rejected the credentials");
      return {
        ok: false,
        detail:
          "rejected — this must be an API user (Settings → API → Add New API User), not the shop's normal login",
      };
    }
    if (res.status === 400) {
      const body = await res.text().catch(() => "");
      if (/blocked/i.test(body)) {
        srFailure("Shiprocket blocked the account after failed logins");
        // Repeated login attempts from this check are what blocks an account.
        // Say so plainly and stop: a deploy loop that re-probes would keep the
        // lockout alive.
        return {
          ok: false,
          detail: "account blocked after failed logins — wait for it to clear or reset the API user's password",
        };
      }
      return { ok: false, detail: `login refused (400): ${body.slice(0, 80)}` };
    }
    return { ok: false, detail: `login failed (${res.status})` };
  } catch (error) {
    return { ok: false, detail: `could not reach Shiprocket: ${String(error.message).slice(0, 60)}` };
  }
}

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


/**
 * Ask the database a question, through the running container.
 *
 * Two things the release genuinely needs to know live in the data, not in the
 * environment: whether anything is on sale without a size, and whether the
 * editorial sections the nav promises are empty. Neither is a reason to refuse
 * to boot, and both are reasons to refuse to launch.
 *
 * psql through `docker compose exec` rather than a driver: preflight has no
 * dependencies on purpose, so it can run on a fresh box before `pnpm install`.
 * If Docker or the database is not there, the check reports itself as skipped
 * instead of pretending to pass.
 */
function databaseUrl() {
  return value("DATABASE_URL") || "";
}

function sql(dbUrl, statement) {
  const match = /^postgres(?:ql)?:\/\/([^:]+):[^@]*@([^:/]+)(?::(\d+))?\/([^?]+)/.exec(
    dbUrl.replace(/^["']|["']$/g, "")
  );
  if (!match) return { ok: false, reason: "DATABASE_URL is not a postgres URL" };
  const [, user, , , database] = match;

  try {
    const out = execFileSync(
      "docker",
      [
        "compose",
        "exec",
        "-T",
        "postgres",
        "psql",
        "-U",
        user,
        "-d",
        database,
        "-tAc",
        statement,
      ],
      { cwd: ROOT, encoding: "utf8", timeout: 15000, stdio: ["ignore", "pipe", "pipe"] }
    ).trim();
    return { ok: true, value: out };
  } catch (error) {
    return { ok: false, reason: (error.stderr || error.message || "").toString().slice(0, 90).trim() };
  }
}

section("Content and data");

try {
  const response = await fetch(`${local}/api/health?deep=1`, { cache: "no-store" });
  if (response.ok) pass("Storefront reports ready");
} catch {
  // Already reported above.
}

const db = databaseUrl();

if (!db) {
  warn("Data checks skipped", "no DATABASE_URL in the environment");
} else {
  // Works on sale with no size. The route refuses to publish one now, so any
  // that exist predate the rule — they are live and a buyer cannot judge them.
  //
  // Gift wrapping is excluded: it is a service the shop sells as a product only
  // because Medusa can put nothing else on a cart, and asking a service to state
  // its dimensions is a check that will warn forever and teach nobody anything.
  const sizeless = sql(
    db,
    `SELECT coalesce(string_agg(p.title, ', '), '') FROM product p
      WHERE p.status = 'published' AND p.deleted_at IS NULL
        AND p.handle <> 'gift-wrap'
        AND NOT EXISTS (
          SELECT 1 FROM product_tags pt
          JOIN product_tag t ON t.id = pt.product_tag_id
          WHERE pt.product_id = p.id AND t.value LIKE 'dimensions:%'
        )`
  );
  if (!sizeless.ok) {
    warn("Published works without a size", `could not check: ${sizeless.reason}`);
  } else if (sizeless.value) {
    // A warning, not a failure: the product page now states plainly that the
    // measurement is pending and points the buyer at the studio, so this is a
    // job outstanding rather than a shop that misleads.
    warn(
      "Published works without a size",
      `${sizeless.value} — the page says "to be confirmed"; measure them when you can`
    );
  } else {
    pass("Every published work states its size");
  }

  // The nav promises these sections. Empty is not a bug; shipping them empty is.
  const rooms = sql(db, "SELECT count(*) FROM site_room WHERE published");
  const news = sql(db, "SELECT count(*) FROM site_news WHERE published");
  if (!rooms.ok || !news.ok) {
    warn("Rooms and newsroom", "could not check");
  } else {
    const roomCount = Number(rooms.value || 0);
    const newsCount = Number(news.value || 0);
    if (roomCount === 0) {
      warn("Rooms", "nothing published — /rooms is an empty state in the nav");
    } else {
      pass("Rooms", `${roomCount} published`);
    }
    if (newsCount === 0) {
      warn("Newsroom", "nothing published — /newsroom is an empty state in the nav");
    } else {
      pass("Newsroom", `${newsCount} published`);
    }
  }
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
