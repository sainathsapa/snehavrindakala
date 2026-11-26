#!/usr/bin/env node
/**
 * Shiprocket integration check — one step at a time.
 *
 * "Invalid email and password combination" is the only thing Shiprocket says
 * when authentication fails, and it is said for at least four different
 * situations: a normal account used instead of an API user, a password with a
 * stray character, an API user whose modules do not include the endpoint being
 * called, and a token that has expired. One message for four causes makes a
 * guessing game out of a credential problem.
 *
 * This script walks the documented chain — auth → pickup locations →
 * serviceability → tracking — and stops at the first step that fails, printing
 * what Shiprocket actually answered. It never prints the password.
 *
 *   node scripts/shiprocket-check.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://apiv2.shiprocket.in/v1/external";

function readEnv(path) {
  let text = "";
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return {};
  }
  const out = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = { ...readEnv(join(ROOT, ".env")), ...process.env };
const email = String(env.SHIPROCKET_EMAIL || "").trim();
const passwordRaw = String(env.SHIPROCKET_PASSWORD || "");
const postcode = String(env.SHIPROCKET_PICKUP_POSTCODE || "302001").trim();

const mask = (v) => (v.length <= 2 ? "**" : `${v[0]}${"*".repeat(Math.max(1, v.length - 2))}${v[v.length - 1]}`);

console.log("Shiprocket check");
console.log("  base      ", BASE);
console.log("  email     ", email || "(unset)");
console.log("  password  ", `${mask(passwordRaw)} (${passwordRaw.length} chars)`);
if (passwordRaw !== passwordRaw.trim()) {
  console.log("  ! the password has leading or trailing whitespace");
}
if (/["']/.test(passwordRaw)) console.log("  ! the password still contains quote characters");
if (!email) {
  console.error("\nNo SHIPROCKET_EMAIL. Set the API user's email (Settings → API → Add New API User).");
  process.exit(1);
}

async function jsonFetch(path, init) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 300) };
  }
  return { status: res.status, ok: res.ok, body };
}

// ── 1. Authentication ───────────────────────────────────────────────────────
const trimmed = passwordRaw.trim();
const attempts = trimmed === passwordRaw ? [passwordRaw] : [passwordRaw, trimmed];

let token = null;
for (const [index, candidate] of attempts.entries()) {
  const res = await jsonFetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: candidate }),
  });
  const label = attempts.length > 1 ? (index === 0 ? "as stored" : "trimmed") : "as stored";
  const message = String(res.body?.message ?? "");

  // Shiprocket blocks an account after a run of failed logins, with the same
  // 400 for as long as the block lasts. Retrying makes it worse and longer, so
  // this stops immediately rather than trying the trimmed variant.
  if (/blocked/i.test(message)) {
    console.error(`
✗ auth        ${res.status} ${message}

The account is blocked for failed login attempts — a lockout, not a bad
password. Retrying pushes the block out, so stop here.

  • wait for the block to clear (Shiprocket normally lifts it after a while),
    or reset the password from the panel to clear it immediately
  • then create the API user again (Settings → API → Add New API User) and put
    the new pair in SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD

Do not run this script in a loop against a blocked account.`);
    process.exit(1);
  }

  if (res.ok && res.body?.token) {
    token = res.body.token;
    console.log(`\n✓ auth        token issued (${label}), ${token.length} chars`);
    break;
  }
  console.log(`✗ auth        ${res.status} ${JSON.stringify(res.body).slice(0, 160)} (${label})`);
}

if (!token) {
  console.error(`
Authentication failed. Shiprocket returns the same message for all of these:

  • the credentials are the shop's normal login, not an API user
      → Settings → API → Add New API User (the email must differ from your login;
        the password is shown once at creation and mailed to the account address)
  • the API user's password was mistyped or rotated since it was saved
      → recreate the API user and paste the new password
  • the API user was deleted or its access revoked
      → the panel lists existing API users under Settings → API

Nothing in this repository can fix that: it is an account-side credential.`);
  process.exit(1);
}

const auth = { Authorization: `Bearer ${token}`, Accept: "application/json" };

// ── 2. Pickup locations ─────────────────────────────────────────────────────
const pickup = await jsonFetch("/settings/company/pickup", { headers: auth });
if (pickup.ok) {
  const list = pickup.body?.data?.shipping_address ?? pickup.body?.shipping_address ?? [];
  const names = Array.isArray(list) ? list.map((p) => p.pickup_location) : [];
  console.log(`✓ pickup      ${names.length} location(s): ${names.join(", ") || "(none)"}`);
  const configured = String(env.SHIPROCKET_PICKUP_LOCATION || "").trim();
  if (configured && names.length && !names.includes(configured)) {
    console.log(
      `  ! SHIPROCKET_PICKUP_LOCATION is "${configured}" but the account has ${names.join(", ")}`
    );
  }
} else {
  console.log(`✗ pickup      ${pickup.status} ${JSON.stringify(pickup.body).slice(0, 160)}`);
}

// ── 3. Serviceability (rates) ───────────────────────────────────────────────
const serviceability = await jsonFetch(
  `/courier/serviceability/?pickup_postcode=${encodeURIComponent(postcode)}&delivery_postcode=110001&cod=0&weight=0.5`,
  { headers: auth }
);
if (serviceability.ok) {
  const companies = serviceability.body?.data?.available_courier_companies ?? [];
  console.log(`✓ serviceability ${companies.length} courier(s) for ${postcode} → 110001`);
} else {
  console.log(`✗ serviceability ${serviceability.status} ${JSON.stringify(serviceability.body).slice(0, 160)}`);
}

// ── 4. Tracking route (no AWB needed: a 404 proves the route exists) ────────
const tracking = await jsonFetch("/courier/track/awb/0000000000", { headers: auth });
console.log(
  tracking.status === 404 || tracking.ok
    ? `✓ tracking    route answers (${tracking.status})`
    : `✗ tracking    ${tracking.status} ${JSON.stringify(tracking.body).slice(0, 160)}`
);

console.log(`
Wallet note: Shiprocket has no sandbox. Assigning an AWB debits the wallet, so a
real shipment should be the next step taken deliberately, not by a test script.`);
