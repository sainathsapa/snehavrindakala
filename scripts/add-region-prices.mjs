#!/usr/bin/env node
/**
 * Add converted prices in every non-INR currency for each product variant.
 *
 * Prices are authored in rupees; other currencies are derived from them. A
 * straight conversion at spot makes the price move every time the rate moves, and
 * leaves no room for the higher cost of selling abroad, so a small buffer is
 * applied on top. `RATE_BUFFER` is the one number to change if margins are thin.
 *
 * Idempotent: a variant that already carries a price in a currency is left alone,
 * so a re-run never overwrites a price set by hand in the admin.
 *
 * Run inside the compose network:  node scripts/add-region-prices.mjs
 */

import { execFileSync } from "node:child_process";

// Indicative rates, rupees per unit of foreign currency. Override with
// RATES='{"usd":0.012}' to re-price without editing this file.
const DEFAULT_RATES = { usd: 0.0119, gbp: 0.0094, eur: 0.011 };
const RATES = process.env.RATES
  ? JSON.parse(process.env.RATES)
  : DEFAULT_RATES;

// Selling abroad carries real cost (payment fees, returns, freight), so a
// converted price should not land below the rupee equivalent.
const RATE_BUFFER = Number(process.env.RATE_BUFFER || 1.08);

const PG = [
  "exec",
  "snehavrinda-postgres",
  "psql",
  "-U",
  "medusa",
  "-d",
  "medusa",
  "-tAc",
];

function sql(statement) {
  return execFileSync("docker", [...PG, statement], { encoding: "utf8" }).trim();
}

/**
 * Round to a sensible retail price, and never let a converted price fall below a
 * floor for that currency.
 *
 * A straight conversion produces nonsense at the low end — a ₹100 bookmark
 * becomes $1.29, which does not cover international postage, let alone payment
 * fees. The floor is the smallest price at which shipping a parcel abroad still
 * makes sense, so cheap pieces are priced for export rather than converted.
 */
const FLOOR = { usd: 2500, gbp: 2000, eur: 2300 };

function roundRetail(minor, code) {
  const step = minor >= 100000 ? 5000 : 500;
  const rounded = Math.round(minor / step) * step;
  return Math.max(FLOOR[code] ?? 0, rounded);
}

const rows = sql(`
  select v.id, p.currency_code, p.amount, p.id
  from price p
  join product_variant_price_set pvps on pvps.price_set_id = p.price_set_id
  join product_variant v on v.id = pvps.variant_id
  where p.currency_code = 'inr'
`);

for (const line of rows.split("\n").filter(Boolean)) {
  const [variantId, , amount] = line.split("|");
  const inr = Number(amount);
  if (!inr) continue;

  const existing = sql(`
    select p.currency_code
    from price p
    join product_variant_price_set pvps on pvps.price_set_id = p.price_set_id
    where pvps.variant_id = '${variantId}'
  `);
  const have = new Set(existing.split("\n").filter(Boolean));

  const values = [];
  for (const [code, rate] of Object.entries(RATES)) {
    if (have.has(code)) continue;
    const converted = roundRetail(inr * rate * RATE_BUFFER, code);
    values.push(`('${code}', ${converted})`);
  }
  if (values.length === 0) {
    console.log(`skip   ${variantId} (already priced)`);
    continue;
  }

  // Reuse the variant's existing price set so the INR price stays authoritative.
  // raw_amount is jsonb, not a number, so the converted amount has to be cast.
  sql(`
    with target as (
      select pvps.price_set_id
      from product_variant_price_set pvps
      where pvps.variant_id = '${variantId}'
      limit 1
    )
    insert into price (id, price_set_id, currency_code, amount, raw_amount, rules_count)
    select gen_random_uuid()::text, target.price_set_id, v.code, v.amount,
           to_jsonb(v.amount), 0
    from target, (values ${values.join(",")}) as v(code, amount)
  `);
  console.log(`add    ${variantId} -> ${values.join(", ")}`);
}
