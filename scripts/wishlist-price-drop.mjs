#!/usr/bin/env node
/**
 * Wishlist price drops.
 *
 * A heart on a product saved a row and nothing ever read it back for the buyer:
 * the wishlist was a demand signal for the studio, not an alert for the person
 * who asked. When the price of a saved work moves down, this tells them — once,
 * with both numbers, and only for works that are still for sale.
 *
 * Idempotent per price: the wishlist row stores the price the buyer saw, so a
 * second pass at the same price sends nothing. Set the stored price forward on
 * every successful send.
 *
 *   node scripts/wishlist-price-drop.mjs
 *   node scripts/wishlist-price-drop.mjs --dry
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
const PK = env.MEDUSA_PUBLISHABLE_KEY || "";
const SECRET = env.INTERNAL_NOTIFY_SECRET || "";

if (!DATABASE_URL) {
  console.error("No DATABASE_URL — nothing to do.");
  process.exit(1);
}

const { default: pg } = await import("pg");
const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

// One row per (buyer, work): the newest saved price is the one they remember.
const { rows: saved } = await client.query(`
  SELECT DISTINCT ON (lower(c.email), w.handle)
         lower(c.email) AS email, w.handle, w.title, w.price, w.currency
    FROM customer_wishlist w
    JOIN customer c ON c.id = w.customer_id
   WHERE c.deleted_at IS NULL AND c.email IS NOT NULL AND c.email <> ''
   ORDER BY lower(c.email), w.handle, w.created_at DESC
   LIMIT 500
`);

let sent = 0;
let checked = 0;

for (const item of saved) {
  checked += 1;
  let current = null;
  try {
    const res = await fetch(
      `${MEDUSA}/store/products?handle=${encodeURIComponent(item.handle)}`,
      { headers: PK ? { "x-publishable-api-key": PK } : {}, signal: AbortSignal.timeout(15000) }
    );
    if (res.ok) {
      const body = await res.json();
      const variant = body?.products?.[0]?.variants?.[0];
      const price =
        variant?.calculated_price?.calculated_amount ?? variant?.prices?.[0]?.amount ?? null;
      current = price == null ? null : Number(price);
    }
  } catch {
    current = null;
  }

  if (current == null) continue; // withdrawn or unpriced: no news is good news
  if (item.price == null) continue;
  if (current >= Number(item.price)) continue; // not cheaper than what they saw

  if (DRY) {
    console.log(`  [dry] ${item.email} · ${item.title}: ${item.price} → ${current}`);
    continue;
  }
  if (!SECRET) {
    console.warn("  no INTERNAL_NOTIFY_SECRET — cannot send");
    break;
  }

  const res = await fetch(`${MEDUSA}/internal/notifications/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-internal-secret": SECRET },
    body: JSON.stringify({
      to: item.email,
      template: "price_drop",
      eventKey: `price_drop:${item.email}:${item.handle}:${current}`,
      data: {
        title: item.title,
        was: Number(item.price),
        now: current,
        currency: (item.currency || "inr").toUpperCase(),
        url: `${STOREFRONT}/products/${item.handle}`,
      },
    }),
    signal: AbortSignal.timeout(20000),
  }).catch(() => null);

  if (!res?.ok) continue;

  await client.query(
    `UPDATE customer_wishlist SET price = $1 WHERE handle = $2 AND customer_id IN (
       SELECT id FROM customer WHERE lower(email) = $3
     )`,
    [current, item.handle, item.email]
  );
  sent += 1;
}

console.log(`checked ${checked} saved work(s), sent ${sent}${DRY ? " (dry run)" : ""}`);
await client.end();
