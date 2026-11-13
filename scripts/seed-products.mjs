#!/usr/bin/env node
/**
 * Seed the six starter works as real Medusa products through the admin API.
 *
 * The storefront used to fall back to a hardcoded catalogue in
 * apps/storefront/data/products.ts. Those six works appeared on /shop but did
 * not exist in the database: they could not be edited, priced or deleted from
 * the admin panel, and their links 404'd whenever handles changed.
 *
 * This creates them as ordinary products so the admin owns them. Safe to re-run:
 * products whose handle already exists are skipped.
 */

const BASE = process.env.STORE_URL || "http://localhost:3000";
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

const ARTIST = "Sneha Sainath Sapa";

const CATEGORIES = {
  painting: "Painting & Drawing",
  folk: "Traditional & Folk Art",
  home: "Home & Decorative Art",
  textile: "Textile & Fibre Art",
  paper: "Paper, Stationery & Books",
  wearable: "Wearable Art",
};

const PRODUCTS = [
  {
    title: "Hand-painted Terracotta Vase",
    slug: "hand-painted-terracotta-vase",
    price: 2200,
    category: "home",
    stock_type: "ready_to_ship",
    image: "/images/products/terracotta-vase.jpg",
    description:
      "A hand-thrown terracotta vase painted with folk motifs in natural pigment. Made one at a time, so no two are identical.",
  },
  {
    title: "Madhubani Folk Painting",
    slug: "madhubani-folk-painting",
    price: 8500,
    category: "folk",
    stock_type: "ready_to_ship",
    image: "/images/products/madhubani-painting.jpg",
    description:
      "Hand-painted in the Madhubani tradition of Mithila, with natural dyes on handmade paper. The border and the symbols carry meaning the maker can explain.",
  },
  {
    title: "Embroidered Cotton Throw",
    slug: "embroidered-cotton-throw",
    price: 4200,
    category: "textile",
    stock_type: "made_to_order",
    image: "/images/products/cotton-throw.jpg",
    description:
      "Hand-embroidered cotton, woven and stitched in small runs. Made to order, so allow time for the work.",
  },
  {
    title: "Custom Portrait Commission",
    slug: "custom-portrait-commission",
    price: 15000,
    category: "painting",
    stock_type: "custom_only",
    image: "/images/products/commission-portrait.jpg",
    description:
      "A portrait made to a brief, in the medium that suits the subject. Send a brief and receive a quote before any work begins.",
  },
  {
    title: "Block-Printed Journal Set",
    slug: "block-printed-journal-set",
    price: 1100,
    category: "paper",
    stock_type: "ready_to_ship",
    image: "/images/products/journal-set.jpg",
    description:
      "Hand block-printed covers on handmade paper, stitched by hand. Each set is printed from a carved wooden block.",
  },
  {
    title: "Wearable Art Pendant",
    slug: "wearable-art-pendant",
    price: 3400,
    category: "wearable",
    stock_type: "ready_to_ship",
    image: "/images/products/art-pendant.jpg",
    description:
      "Hand-painted ceramic on a cotton cord. A small painted work intended to be worn rather than framed.",
  },
];

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD in the environment.");
    process.exit(1);
  }

  // Log in and keep the cookie.
  const login = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!login.ok) {
    console.error("Login failed:", login.status, await login.text());
    process.exit(1);
  }
  const cookie = (login.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");

  const auth = { Cookie: cookie, "Content-Type": "application/json" };

  // Map display names to category ids.
  const catRes = await fetch(`${BASE}/api/admin/categories?limit=100`, {
    headers: { Cookie: cookie },
  });
  const catData = await catRes.json();
  const byName = new Map(
    (catData.categories ?? []).map((c) => [c.name, c.id])
  );

  // Existing handles, so a re-run is a no-op rather than a pile of duplicates.
  const existing = new Set(
    ((await (await fetch(`${BASE}/api/admin/products?limit=200`, {
      headers: { Cookie: cookie },
    })).json()).products ?? []).map((p) => p.slug ?? p.handle)
  );

  for (const p of PRODUCTS) {
    if (existing.has(p.slug)) {
      console.log(`skip   ${p.slug} (exists)`);
      continue;
    }
    const res = await fetch(`${BASE}/api/admin/products`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        title: p.title,
        slug: p.slug,
        status: "published",
        total: p.price * 100,
        currency_code: "inr",
        artist: ARTIST,
        stock_type: p.stock_type,
        description: p.description,
        image: p.image,
        ...(byName.get(CATEGORIES[p.category])
          ? { category_id: byName.get(CATEGORIES[p.category]) }
          : {}),
      }),
    });
    const body = await res.text();
    console.log(
      `${res.ok ? "create" : "FAIL  "} ${p.slug} -> ${res.status} ${
        res.ok ? "" : body.slice(0, 160)
      }`
    );
  }

  // Backfill: products created before the tag mirror existed carry the maker
  // only in metadata, which the store API never returns. Re-PATCH each one so
  // its tags are written. Harmless on a fresh database.
  const all = (
    await (
      await fetch(`${BASE}/api/admin/products?limit=200`, {
        headers: { Cookie: cookie },
      })
    ).json()
  ).products ?? [];

  for (const p of PRODUCTS) {
    const match = all.find((row) => row.handle === p.slug);
    if (!match) continue;
    const res = await fetch(`${BASE}/api/admin/products/${match.id}`, {
      method: "PATCH",
      headers: auth,
      body: JSON.stringify({
        title: p.title,
        artist: ARTIST,
        stock_type: p.stock_type,
      }),
    });
    console.log(`tag    ${p.slug} -> ${res.status}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
