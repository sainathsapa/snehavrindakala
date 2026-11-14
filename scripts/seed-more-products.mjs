#!/usr/bin/env node
/**
 * Add a wider spread of Indian art forms to the catalogue.
 *
 * The shop shipped with six works, which does not read as a house of arts: there
 * was nothing from Warli, Pattachitra, Gond, Kalamkari, Phulkari or Bidriware,
 * and no ceramics or prints. These listings fill those gaps so the art-form
 * pages have real work behind them instead of empty grids.
 *
 * Idempotent: products are skipped when their handle already exists.
 *
 * Run with the compose stack up:  node scripts/seed-more-products.mjs
 */

const BASE = process.env.STORE_URL || "http://localhost:3000";
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
const ARTIST = "Sneha Sainath Sapa";

const PRODUCTS = [
  {
    title: "Warli Harvest Painting",
    slug: "warli-harvest-painting",
    price: 6800,
    category: "Traditional & Folk Art",
    image: "/images/artforms/folk.jpg",
    stock_type: "ready_to_ship",
    description:
      "Rice-paste white pigment on a mud-brown ground, in the Warli tradition of the Thane region. Figures are built from two triangles and a circle — the geometry is fixed, the scene is not.",
  },
  {
    title: "Pattachitra Scroll Panel",
    slug: "pattachitra-scroll-panel",
    price: 12400,
    category: "Traditional & Folk Art",
    image: "/images/artforms/folk.jpg",
    stock_type: "made_to_order",
    description:
      "Painted on cloth treated with tamarind seed and chalk, then outlined in black. Made in the Odisha style, where the border is painted before the figure, not after.",
  },
  {
    title: "Gond Tree of Life",
    slug: "gond-tree-of-life",
    price: 18500,
    category: "Painting & Drawing",
    image: "/images/artforms/painting.jpg",
    stock_type: "made_to_order",
    description:
      "Gond painting from Madhya Pradesh. The whole canvas is filled with a single motif that repeats — in this tradition, empty space is not decoration, it is unfinished work.",
  },
  {
    title: "Kalamkari Penwork Panel",
    slug: "kalamkari-penwork-panel",
    price: 9800,
    category: "Textile & Fibre Art",
    image: "/images/artforms/textile.jpg",
    stock_type: "made_to_order",
    description:
      "Drawn with a bamboo pen dipped in fermented jaggery and iron, then dyed in myrobalan and madder. The black here is iron, not pigment, which is why it does not fade.",
  },
  {
    title: "Phulkari Embroidered Dupatta",
    slug: "phulkari-embroidered-dupatta",
    price: 7400,
    category: "Textile & Fibre Art",
    image: "/images/artforms/textile.jpg",
    stock_type: "ready_to_ship",
    description:
      "Floss silk on handspun cotton, worked from the reverse so the front reads as flat satin stitch. Phulkari means flower-work, and the darning stitch is the whole technique.",
  },
  {
    title: "Madhubani Fish and Lotus",
    slug: "madhubani-fish-and-lotus",
    price: 11200,
    category: "Traditional & Folk Art",
    image: "/images/artforms/folk.jpg",
    stock_type: "ready_to_ship",
    description:
      "Fish and lotus as fertility symbols, painted with a nib on handmade paper and filled with flat colour. No shading: in Mithila painting, a shadow would change the meaning.",
  },
  {
    title: "Hand-thrown Stoneware Bowl",
    slug: "hand-thrown-stoneware-bowl",
    price: 3200,
    category: "Home & Decorative Art",
    image: "/images/artforms/home-decor.jpg",
    stock_type: "ready_to_ship",
    description:
      "Wheel-thrown and glazed in a celadon that pools at the foot. Food-safe. Slight variation in the rim is from the hand, not a defect.",
  },
  {
    title: "Block-printed Cotton Table Runner",
    slug: "block-printed-table-runner",
    price: 2800,
    category: "Home & Decorative Art",
    image: "/images/artforms/home-decor.jpg",
    stock_type: "ready_to_ship",
    description:
      "Hand-carved teak blocks printed in repeat with a natural indigo and madder palette. Registration is by eye, so the pattern breathes slightly along its length.",
  },
  {
    title: "Bidriware Silver Inlay Box",
    slug: "bidriware-silver-inlay-box",
    price: 16500,
    category: "Home & Decorative Art",
    image: "/images/artforms/home-decor.jpg",
    stock_type: "made_to_order",
    description:
      "Bidriware from Bidar: silver hammered into an alloy of zinc and copper, then blackened with soil from the fort. The black is a chemical reaction, not a paint.",
  },
  {
    title: "Hand-marbled Paper Journal",
    slug: "hand-marbled-paper-journal",
    price: 2400,
    category: "Paper, Stationery & Books",
    image: "/images/artforms/paper.jpg",
    stock_type: "ready_to_ship",
    description:
      "Covers marbled in a size bath, then bound by hand with a Coptic stitch so the book opens flat. 120 pages of unruled cotton paper.",
  },
  {
    title: "Lacquer Wooden Pen Case",
    slug: "lacquer-wooden-pen-case",
    price: 1900,
    category: "Paper, Stationery & Books",
    image: "/images/artforms/paper.jpg",
    stock_type: "ready_to_ship",
    description:
      "Turned from seasoned mango wood and finished with natural lac, worked on a lathe while still warm. The colour is in the lac, not painted on top.",
  },
  {
    title: "Silver Filigree Earrings",
    slug: "silver-filigree-earrings",
    price: 8900,
    category: "Wearable Art",
    image: "/images/artforms/wearable.jpg",
    stock_type: "ready_to_ship",
    description:
      "Fine silver wire drawn thin, twisted and soldered into a frame. Filigree is measured by how little metal holds the shape together. Hallmarked.",
  },
  {
    title: "Hand-woven Ikat Stole",
    slug: "hand-woven-ikat-stole",
    price: 5600,
    category: "Wearable Art",
    image: "/images/artforms/wearable.jpg",
    stock_type: "made_to_order",
    description:
      "Threads bound and dyed before weaving, so the pattern appears as the loom advances. The blurred edge is characteristic of true ikat and cannot be printed.",
  },
  {
    title: "Gold-leaf Miniature Portrait",
    slug: "gold-leaf-miniature-portrait",
    price: 34000,
    category: "Painting & Drawing",
    image: "/images/artforms/painting.jpg",
    stock_type: "custom_only",
    description:
      "A portrait miniature in the Kishangarh manner, painted with a squirrel-hair brush on wasli paper and finished with burnished gold leaf. Commission only, three to four months.",
  },
];

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

  const cats = await (
    await fetch(`${BASE}/api/admin/categories?limit=100`, {
      headers: { Cookie: cookie },
    })
  ).json();
  const byName = new Map(
    (cats.categories ?? []).map((c) => [c.name, c.id])
  );

  const existing = await (
    await fetch(`${BASE}/api/admin/products?limit=200`, {
      headers: { Cookie: cookie },
    })
  ).json();
  const have = new Set((existing.products ?? []).map((p) => p.handle));

  for (const p of PRODUCTS) {
    if (have.has(p.slug)) {
      console.log(`skip   ${p.slug}`);
      continue;
    }
    const res = await fetch(`${BASE}/api/admin/products`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
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
        ...(byName.get(p.category)
          ? { category_id: byName.get(p.category) }
          : {}),
      }),
    });
    const body = await res.text();
    console.log(
      `${res.ok ? "create" : "FAIL  "} ${p.slug} -> ${res.status}${
        res.ok ? "" : " " + body.slice(0, 160)
      }`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
