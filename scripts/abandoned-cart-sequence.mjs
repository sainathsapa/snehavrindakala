#!/usr/bin/env node
/**
 * Two nudges for an unfinished cart, not one.
 *
 * A single reminder was sent by hand from the admin panel, one per cart, ever.
 * Most people who leave a cart do not come back on the first email; the second is
 * the one that works, and it has to be spaced far enough apart to not read as
 * nagging.
 *
 * Stage 1 — 24 hours idle.
 * Stage 2 — 72 hours idle, only if stage 1 was sent and the cart is still open.
 *
 * Run it from cron. Safe to run hourly: the stage is recorded per cart, so a pass
 * that finds nothing to do writes nothing and sends nothing.
 *
 *   node scripts/abandoned-cart-sequence.mjs
 *   node scripts/abandoned-cart-sequence.mjs --dry
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry");

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
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    out[trimmed.slice(0, trimmed.indexOf("=")).trim()] = trimmed
      .slice(trimmed.indexOf("=") + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = { ...readEnv(join(ROOT, ".env")), ...process.env };
const DATABASE_URL = String(env.DATABASE_URL || "").replace(/^["']|["']$/g, "");
const MEDUSA =
  (env.MEDUSA_BACKEND_URL || env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://127.0.0.1:9000").replace(/\/+$/, "");
const STOREFRONT = (env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000").replace(/\/+$/, "");
const SECRET = env.INTERNAL_NOTIFY_SECRET || "";

const STAGE_1_HOURS = Number(env.CART_REMINDER_1_HOURS || 24);
const STAGE_2_HOURS = Number(env.CART_REMINDER_2_HOURS || 72);

if (!DATABASE_URL) {
  console.error("No DATABASE_URL — nothing to do.");
  process.exit(1);
}

const { default: pg } = await import("pg");
const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

/** Carts that have items, an email, and have been still for N hours. */
async function idleCarts(hours, stage) {
  const sql = `
    SELECT c.id, c.email, c.updated_at,
           coalesce(sum(li.quantity), 0)::int AS units,
           coalesce(sum(li.unit_price * li.quantity), 0)::bigint AS total_minor,
           r.status AS reminder_status
      FROM cart c
      JOIN cart_line_item li ON li.cart_id = c.id AND li.deleted_at IS NULL
      LEFT JOIN cart_reminders r ON r.cart_id = c.id
     WHERE c.deleted_at IS NULL
       AND c.completed_at IS NULL
       AND c.email IS NOT NULL AND c.email <> ''
       AND c.updated_at < now() - ($1 || ' hours')::interval
       AND (
         ($2 = 1 AND r.cart_id IS NULL) OR
         ($2 = 2 AND r.status = 'reminded' AND c.updated_at < now() - ($3 || ' hours')::interval)
       )
     GROUP BY c.id, r.status
     HAVING sum(li.quantity) > 0
     LIMIT 200`;
  const { rows } = await client.query(sql, [String(hours), stage, String(STAGE_2_HOURS)]);
  return rows;
}

async function send(cart, stage) {
  if (!SECRET) {
    console.warn("  no INTERNAL_NOTIFY_SECRET — cannot send; run this on the server");
    return false;
  }
  const res = await fetch(`${MEDUSA}/internal/notifications/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-secret": SECRET },
    body: JSON.stringify({
      to: cart.email,
      template: "cart_reminder",
      eventKey: `cart_reminder:${cart.id}:${stage}`,
      data: {
        cart_id: cart.id,
        stage,
        item_count: cart.units,
        total: cart.total_minor,
        resume_url: `${STOREFRONT}/cart`,
      },
    }),
    signal: AbortSignal.timeout(20000),
  }).catch(() => null);
  if (!res) return false;
  if (!res.ok) {
    console.warn(`  send failed (${res.status}) for ${cart.email}`);
    return false;
  }
  const body = await res.json().catch(() => ({}));
  return body?.status === "sent";
}

let sent = 0;
for (const stage of [1, 2]) {
  const carts = await idleCarts(stage === 1 ? STAGE_1_HOURS : STAGE_2_HOURS, stage);
  for (const cart of carts) {
    if (DRY) {
      console.log(`  [dry] stage ${stage} → ${cart.email} (${cart.units} items)`);
      continue;
    }
    const ok = await send(cart, stage);
    if (!ok) continue;
    await client.query(
      `INSERT INTO cart_reminders (cart_id, status, sent_at)
       VALUES ($1, $2, now())
       ON CONFLICT (cart_id) DO UPDATE SET status = $2, sent_at = now()`,
      [cart.id, stage === 1 ? "reminded" : "reminded_2"]
    );
    sent += 1;
  }
  console.log(`stage ${stage}: ${carts.length} cart(s)${DRY ? " (dry run)" : ""}`);
}

console.log(`reminders sent: ${sent}`);
await client.end();
