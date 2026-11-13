#!/usr/bin/env node
/**
 * Backfill `artist:` and `stock:` tags onto the starter products.
 *
 * The storefront reads the maker and availability from Medusa tags, because the
 * store API does not expose product `metadata` at all. Products created before
 * the admin began writing tags carry the values only in metadata, so they need
 * one PATCH each. Safe to re-run.
 */

const BASE = process.env.STORE_URL || "http://localhost:3000";
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
const ARTIST = "Sneha Sainath Sapa";

const WANTED = {
  "hand-painted-terracotta-vase": "ready_to_ship",
  "madhubani-folk-painting": "ready_to_ship",
  "embroidered-cotton-throw": "made_to_order",
  "custom-portrait-commission": "custom_only",
  "block-printed-journal-set": "ready_to_ship",
  "wearable-art-pendant": "ready_to_ship",
};

async function main() {
  const login = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!login.ok) {
    console.error("Login failed", login.status);
    process.exit(1);
  }
  const cookie = (login.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");

  const list = await (
    await fetch(`${BASE}/api/admin/products?limit=200`, { headers: { Cookie: cookie } })
  ).json();

  for (const [handle, stock] of Object.entries(WANTED)) {
    const row = (list.products ?? []).find((p) => p.handle === handle);
    if (!row) {
      console.log(`skip   ${handle} (not found)`);
      continue;
    }
    const res = await fetch(`${BASE}/api/admin/products/${row.id}`, {
      method: "PATCH",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: row.title,
        artist: ARTIST,
        stock_type: stock,
      }),
    });
    console.log(`${res.ok ? "tag   " : "FAIL  "} ${handle} -> ${res.status}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
