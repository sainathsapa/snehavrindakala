#!/usr/bin/env node
/**
 * Provision a freshly migrated Medusa backend so the storefront is usable.
 *
 * Runs once per `docker compose up` (the `seed` service) and is idempotent:
 * every step checks for what it is about to create.
 *
 * WHY THIS EXISTS
 *
 * A migrated database contains no shop. It has tables, and nothing else: no
 * region, no sales channel, no publishable key, no products. The storefront then
 * renders an empty catalogue at best, and at worst fails every store API call
 * with "Publishable key not valid" — an error that reads like a code bug but is
 * really a missing row. Nothing in `up -d` created those rows, so a fresh
 * machine was never actually ready, however cleanly the containers started.
 *
 * What gets created, in order:
 *   1. Medusa admin users (email/password from .env) — for /app and the
 *      storefront admin panel, which calls the admin API as that user.
 *   2. INR region with India as its country (prices, tax, checkout).
 *   3. Sales channel — what the publishable key grants access to.
 *   4. Publishable API key — the storefront cannot call the Store API without it.
 *   5. Stock location, service zone and a flat shipping option, so the cart has
 *      a shipping method to select at checkout.
 *   6. Categories + starter catalogue (skippable with SEED_CATALOGUE=0).
 *
 * Every API call uses the Medusa Admin API rather than raw SQL, so versions of
 * Medusa that change column names do not silently break seeding.
 */

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

import { CATEGORIES, PRODUCTS, inr } from "./catalogue-data.mjs";

const require = createRequire(import.meta.url);
const { Client } = require("pg");

const BACKEND = (
  process.env.MEDUSA_BACKEND_URL || "http://backend:9000"
).replace(/\/+$/, "");

const ADMIN_EMAIL = (
  process.env.ADMIN_EMAIL || "admin@snehavrindakala.example"
).trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "changeme-admin-password";
const SYSTEM_EMAIL = (process.env.MEDUSA_ADMIN_EMAIL || "").trim();
const SYSTEM_PASSWORD = process.env.MEDUSA_ADMIN_PASSWORD || "";

const SEED_CATALOGUE = process.env.SEED_CATALOGUE !== "0";
const CURRENCY = (process.env.MEDUSA_CURRENCY_CODE || "inr").toLowerCase();
const REGION_NAME = process.env.SEED_REGION_NAME || "India";
const CHANNEL_NAME = process.env.SEED_SALES_CHANNEL_NAME || "SnehaVrinda Kala";

const ARTIST = "Sneha Sainath Sapa";

let token = null;

// ── helpers ─────────────────────────────────────────────────────────────────

const log = (msg) => console.log(`[seed] ${msg}`);
const ok = (msg) => console.log(`[seed] ✓ ${msg}`);
const warn = (msg) => console.warn(`[seed] ! ${msg}`);
const fail = (msg) => {
  console.error(`[seed] ✗ ${msg}`);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForBackend(timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "no response";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BACKEND}/health`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (res.ok) return;
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err.message;
    }
    await sleep(2_000);
  }
  throw new Error(`backend not healthy after ${timeoutMs}ms (${lastError})`);
}

async function api(path, { method = "GET", body } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BACKEND}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { ok: res.ok, status: res.status, body: parsed };
}

/** Authenticate as the shop admin. Retries while the auth module warms up. */
async function authenticate() {
  for (let attempt = 1; attempt <= 15; attempt++) {
    const res = await api("/auth/user/emailpass", {
      method: "POST",
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    const value = res.body?.token || res.body?.session?.token;
    if (res.ok && value) {
      token = value;
      return;
    }
    if (attempt === 15) {
      throw new Error(
        `admin authentication failed (${res.status}): ${
          typeof res.body === "string" ? res.body : JSON.stringify(res.body)
        }`
      );
    }
    await sleep(2_000);
  }
}

/**
 * Create a Medusa admin user through the CLI.
 *
 * There is no "create user" endpoint on the admin API: the first user comes from
 * `medusa user`. A duplicate email exits non-zero, which is the "already exists"
 * case and must not fail provisioning.
 */
function ensureMedusaUser(email, password, label) {
  if (!email || !password) return;
  try {
    execFileSync(
      "./node_modules/.bin/medusa",
      ["user", "-e", email, "-p", password],
      { stdio: "pipe", env: process.env, timeout: 120_000 }
    );
    ok(`${label} user created: ${email}`);
  } catch (err) {
    const output = `${err.stdout || ""}${err.stderr || ""}`;
    if (/already exists|duplicate|unique/i.test(output)) {
      ok(`${label} user already present: ${email}`);
    } else {
      warn(`${label} user could not be created: ${output.trim().slice(-400)}`);
    }
  }
}

async function listAll(path) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await api(`${path}${sep}limit=200`);
  if (!res.ok) return [];
  const body = res.body ?? {};
  for (const key of Object.keys(body)) {
    if (Array.isArray(body[key])) return body[key];
  }
  return Array.isArray(body) ? body : [];
}

// ── database probes ─────────────────────────────────────────────────────────
// Provider ids (`pp_*`, `fp_*`) are generated by the payment/fulfillment
// modules, and the admin API has no endpoint that lists payment providers. The
// rows the modules registered at boot are the authoritative list, so read them
// straight from the tables they maintain.
async function dbColumn(sql) {
  if (!process.env.DATABASE_URL) return [];
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const res = await client.query(sql);
    return res.rows.map((r) => r.id).filter(Boolean);
  } catch (err) {
    warn(`could not read providers (${err.message})`);
    return [];
  } finally {
    await client.end().catch(() => {});
  }
}

// ── region ──────────────────────────────────────────────────────────────────
async function ensureRegion() {
  const enabled = await dbColumn(
    "SELECT id FROM payment_provider WHERE is_enabled = true"
  );
  // `pp_system_default` always exists and is what the storefront initialises its
  // payment session with; keep it even if the query came back empty.
  const providers = enabled.length ? enabled : ["pp_system_default"];

  const regions = await listAll("/admin/regions");
  let region = regions.find(
    (r) => String(r.currency_code || "").toLowerCase() === CURRENCY
  );

  if (!region) {
    const res = await api("/admin/regions", {
      method: "POST",
      body: {
        name: REGION_NAME,
        currency_code: CURRENCY,
        countries: ["in"],
        automatic_taxes: true,
        // Prices are entered GST-inclusive; the storefront extracts tax from
        // the listed price rather than adding it on top.
        is_tax_inclusive: true,
        payment_providers: providers,
      },
    });
    if (!res.ok) throw new Error(`create region failed (${res.status}): ${JSON.stringify(res.body)}`);
    region = res.body.region;
    ok(`region created: ${region.name} (${region.id})`);
    return region;
  }

  // An existing region can still be unusable here: no country, so no shipping
  // zone matches, or no payment provider, so checkout cannot start.
  const update = {};
  const codes = (region.countries ?? []).map((c) => c.iso_2 ?? c.code);
  if (codes.length && !codes.includes("in")) update.countries = codes;
  else if (!codes.length) update.countries = ["in"];

  const have = (region.payment_providers ?? []).map((p) => p.id ?? p);
  const missing = providers.filter((id) => !have.includes(id));
  if (missing.length) update.payment_providers = [...have, ...missing];

  if (Object.keys(update).length) {
    const res = await api(`/admin/regions/${region.id}`, { method: "POST", body: update });
    if (!res.ok) warn(`region update failed (${res.status}): ${JSON.stringify(res.body)}`);
    else region = res.body.region ?? region;
  }
  ok(`region ready: ${region.name} (${region.id})`);
  return region;
}

// ── sales channel + publishable key ─────────────────────────────────────────
async function ensureSalesChannel() {
  const channels = await listAll("/admin/sales-channels");
  const existing = channels.find((c) => c.name === CHANNEL_NAME);
  if (existing) {
    ok(`sales channel ready: ${existing.name} (${existing.id})`);
    return existing;
  }
  const res = await api("/admin/sales-channels", {
    method: "POST",
    body: { name: CHANNEL_NAME, description: "Primary storefront channel" },
  });
  if (!res.ok) throw new Error(`create sales channel failed (${res.status}): ${JSON.stringify(res.body)}`);
  ok(`sales channel created (${res.body.sales_channel.id})`);
  return res.body.sales_channel;
}

async function ensurePublishableKey(channelId) {
  const res = await api(
    "/admin/api-keys?type=publishable&fields=id,title,token,*sales_channels"
  );
  const keys = res.ok ? res.body.api_keys ?? [] : [];
  const channelsOf = (key) => (key.sales_channels ?? []).map((c) => c.id ?? c);

  const usable =
    keys.find((k) => channelsOf(k).includes(channelId)) ??
    keys.find((k) => channelsOf(k).length === 0);

  if (usable) {
    if (channelsOf(usable).length === 0) {
      const link = await api(`/admin/api-keys/${usable.id}/sales-channels`, {
        method: "POST",
        body: { add: [channelId] },
      });
      if (!link.ok) warn(`could not attach key to sales channel (${link.status})`);
    }
    ok(`publishable key ready: ${usable.token}`);
    return usable.token;
  }

  const created = await api("/admin/api-keys", {
    method: "POST",
    body: { title: "SnehaVrinda Storefront", type: "publishable" },
  });
  if (!created.ok) throw new Error(`create api key failed (${created.status}): ${JSON.stringify(created.body)}`);

  const key = created.body.api_key;
  const link = await api(`/admin/api-keys/${key.id}/sales-channels`, {
    method: "POST",
    body: { add: [channelId] },
  });
  if (!link.ok) warn(`could not attach key to sales channel (${link.status}): ${JSON.stringify(link.body)}`);

  ok(`publishable key created: ${key.token}`);
  return key.token;
}

// ── stock location, service zone, shipping option ───────────────────────────
async function refetchLocation(id) {
  const res = await api(
    `/admin/stock-locations/${id}?fields=*fulfillment_sets,*fulfillment_sets.service_zones`
  );
  return res.ok ? res.body.stock_location : null;
}

async function ensureFulfillment(channelId) {
  const providers = await dbColumn(
    "SELECT id FROM fulfillment_provider WHERE is_enabled = true"
  );
  const providerId =
    providers.find((p) => p.startsWith("fp_manual")) ?? providers[0] ?? "manual";

  const locations = await listAll("/admin/stock-locations");
  let location = locations.find((l) => l.name === "SnehaVrinda Kala Studio");

  if (!location) {
    const res = await api("/admin/stock-locations", {
      method: "POST",
      body: {
        name: "SnehaVrinda Kala Studio",
        address: {
          address_1: "Studio",
          city: "Bengaluru",
          country_code: "in",
          postal_code: process.env.SHIPROCKET_PICKUP_POSTCODE || "560001",
        },
      },
    });
    if (!res.ok) throw new Error(`create stock location failed (${res.status}): ${JSON.stringify(res.body)}`);
    location = res.body.stock_location;
    ok(`stock location created (${location.id})`);
  }

  // The sales channel must be able to sell from this location.
  const linkChannel = await api(`/admin/stock-locations/${location.id}/sales-channels`, {
    method: "POST",
    body: { add: [channelId] },
  });
  if (!linkChannel.ok) warn(`could not link location to sales channel (${linkChannel.status})`);

  // A stock location only offers the fulfilment providers that were enabled on
  // it. Shipping options are created against one of those providers, so without
  // this the API answers "Providers (x) are not enabled for the service
  // location" and checkout has no shipping method at all.
  const linkProvider = await api(
    `/admin/stock-locations/${location.id}/fulfillment-providers`,
    { method: "POST", body: { add: [providerId] } }
  );
  if (!linkProvider.ok) {
    warn(`could not enable fulfillment provider ${providerId} on the location (${linkProvider.status})`);
  }

  location = (await refetchLocation(location.id)) ?? location;
  let set = (location.fulfillment_sets ?? [])[0];

  if (!set) {
    const res = await api(`/admin/stock-locations/${location.id}/fulfillment-sets`, {
      method: "POST",
      body: { name: "Shipping", type: "shipping" },
    });
    if (!res.ok) throw new Error(`create fulfillment set failed (${res.status}): ${JSON.stringify(res.body)}`);
    location = (await refetchLocation(location.id)) ?? location;
    set = (location.fulfillment_sets ?? [])[0];
  }
  if (!set) throw new Error("fulfillment set missing after creation");

  let zones = set.service_zones ?? [];
  if (!zones.length) {
    const res = await api(`/admin/fulfillment-sets/${set.id}/service-zones`, {
      method: "POST",
      body: {
        name: "India",
        geo_zones: [{ type: "country", country_code: "in" }],
      },
    });
    if (!res.ok) throw new Error(`create service zone failed (${res.status}): ${JSON.stringify(res.body)}`);
    location = (await refetchLocation(location.id)) ?? location;
    set = (location.fulfillment_sets ?? [])[0];
    zones = set?.service_zones ?? [];
  }
  const zone = zones[0];
  if (!zone) throw new Error("service zone missing after creation");

  const profiles = await listAll("/admin/shipping-profiles");
  const profile = profiles.find((p) => p.type === "default") ?? profiles[0];
  if (!profile) throw new Error("no shipping profile found");

  const options = await listAll("/admin/shipping-options");
  const existing = options.find((o) => o.name === "Standard delivery (India)");
  if (existing) {
    ok("shipping option ready");
    return;
  }

  const res = await api("/admin/shipping-options", {
    method: "POST",
    body: {
      name: "Standard delivery (India)",
      service_zone_id: zone.id,
      shipping_profile_id: profile.id,
      provider_id: providerId,
      // The real courier charge is quoted from Shiprocket at checkout and
      // collected there. This option exists so Medusa can complete the cart, so
      // its own price is zero rather than a second shipping charge.
      price_type: "flat",
      type: { label: "Standard", description: "Pan-India delivery", code: "standard" },
      prices: [{ currency_code: CURRENCY, amount: 0 }],
    },
  });
  if (!res.ok) throw new Error(`create shipping option failed (${res.status}): ${JSON.stringify(res.body)}`);
  ok(`shipping option created (${res.body.shipping_option?.id ?? "ok"})`);
}

// ── categories + tags ───────────────────────────────────────────────────────
async function ensureCategories() {
  const existing = await listAll("/admin/product-categories");
  const byHandle = new Map(existing.map((c) => [c.handle, c]));
  const ids = new Map();

  for (const [name, handle] of CATEGORIES) {
    const found = byHandle.get(handle);
    if (found) {
      ids.set(handle, found.id);
      continue;
    }
    const res = await api("/admin/product-categories", {
      method: "POST",
      body: {
        name,
        handle,
        description: `${name} at SnehaVrinda Kala`,
        is_internal: false,
        is_active: true,
      },
    });
    if (!res.ok) {
      warn(`category "${name}" not created (${res.status}): ${JSON.stringify(res.body)}`);
      continue;
    }
    ids.set(handle, res.body.product_category.id);
  }
  ok(`categories ready (${ids.size}/${CATEGORIES.length})`);
  return ids;
}

const tagCache = new Map();

/**
 * Tags carry the attributes the Store API does not expose in `metadata`
 * (`artist:`, `stock:`, `medium:`, `dimensions:`, `tradition:`), which is what
 * the product page and the shop filters read.
 */
async function ensureTag(value) {
  if (tagCache.has(value)) return tagCache.get(value);
  const res = await api("/admin/product-tags", { method: "POST", body: { value } });
  const id = res.ok ? res.body.product_tag?.id : null;
  if (id) tagCache.set(value, id);
  return id;
}

// ── starter catalogue ───────────────────────────────────────────────────────
async function ensureProducts(channelId, categoryIds) {
  const existing = await listAll("/admin/products?fields=id,handle");
  const handles = new Set(existing.map((p) => p.handle));
  let created = 0;

  for (const item of PRODUCTS) {
    if (handles.has(item.handle)) continue;

    const tagIds = (
      await Promise.all(
        [
          `artist:${ARTIST}`,
          `stock:${item.stock}`,
          `medium:${item.medium}`,
          `dimensions:${item.dimensions}`,
          `tradition:${item.tradition}`,
        ]
          .map((value) => ensureTag(value))
          .filter(Boolean)
      )
    ).filter(Boolean);

    const sizes = item.sizes ?? ["Original"];
    const optionTitle = sizes.length > 1 ? "Size" : "Edition";
    const categoryId = categoryIds.get(item.category);

    const payload = {
      title: item.title,
      handle: item.handle,
      subtitle: `${item.tradition} · ${item.medium}`,
      description: item.description,
      status: "published",
      thumbnail: item.image,
      images: [{ url: item.image }],
      options: [{ title: optionTitle, values: sizes }],
      variants: sizes.map((value, index) => ({
        title: value,
        sku: `${item.handle}-${index + 1}`.toUpperCase().slice(0, 32),
        // The catalogue is not stock-managed, so a fresh install does not depend
        // on stock levels having been entered in the admin before the first sale.
        manage_inventory: false,
        allow_backorder: true,
        options: { [optionTitle]: value },
        prices: [
          { currency_code: CURRENCY, amount: inr(item.price * (1 + index * 0.4)) },
        ],
      })),
      metadata: {
        artist: ARTIST,
        stock_type: item.stock,
        tradition: item.tradition,
      },
      tags: tagIds.map((id) => ({ id })),
      // A product only appears on the storefront when it belongs to the channel
      // the publishable key grants access to. Omitting this produced an empty
      // shop with a fully seeded database.
      sales_channels: [{ id: channelId }],
    };
    if (categoryId) payload.categories = [{ id: categoryId }];

    const res = await api("/admin/products", { method: "POST", body: payload });
    if (!res.ok) {
      warn(
        `product "${item.title}" not created (${res.status}): ${JSON.stringify(res.body).slice(0, 400)}`
      );
      continue;
    }
    created++;
  }

  ok(
    created
      ? `catalogue ready (${created} new, ${handles.size} already present)`
      : `catalogue already present (${handles.size} products)`
  );
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  log(`provisioning ${BACKEND}`);

  await waitForBackend();
  ok("backend healthy");

  ensureMedusaUser(ADMIN_EMAIL, ADMIN_PASSWORD, "Admin");
  if (SYSTEM_EMAIL && SYSTEM_EMAIL !== ADMIN_EMAIL) {
    ensureMedusaUser(SYSTEM_EMAIL, SYSTEM_PASSWORD, "System");
  }

  await authenticate();
  ok("authenticated as admin");

  // Fatal on purpose: without a region and a publishable key the storefront
  // cannot read a single product, so a silent success would just move the
  // failure somewhere less legible.
  const region = await ensureRegion();
  const channel = await ensureSalesChannel();
  const publishableKey = await ensurePublishableKey(channel.id);

  // Non-fatal: checkout needs a shipping option, but a shop without one should
  // still start so the gap is visible in the UI instead of stopping the stack.
  try {
    await ensureFulfillment(channel.id);
  } catch (err) {
    warn(`checkout wiring incomplete: ${err.message}`);
  }

  if (SEED_CATALOGUE) {
    try {
      const categoryIds = await ensureCategories();
      await ensureProducts(channel.id, categoryIds);
    } catch (err) {
      warn(`catalogue seeding stopped: ${err.message}`);
    }
  } else {
    log("SEED_CATALOGUE=0 — catalogue left untouched");
  }

  console.log("");
  console.log("  SnehaVrinda Kala is provisioned");
  console.log("  ----------------------------------------------");
  console.log(`  Storefront        http://localhost:3000`);
  console.log(`  Admin panel       http://localhost:3000/admin`);
  console.log(`  Medusa dashboard  http://localhost:9000/app`);
  console.log(`  Admin email       ${ADMIN_EMAIL}`);
  console.log(`  Region            ${region.name} (${region.id})`);
  console.log(`  Sales channel     ${channel.name} (${channel.id})`);
  console.log(`  Publishable key   ${publishableKey}`);
  console.log("");
  console.log("  The storefront reads the key from the API at start-up, so it");
  console.log("  never has to be copied into .env by hand.");
  console.log("");
}

main().catch((err) => {
  fail(err.message);
  process.exit(1);
});
