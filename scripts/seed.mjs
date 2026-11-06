/**
 * SnehaVrinda Kala — deterministic seed script.
 *
 * Seeds local/staging environments with repeatable, idempotent test data:
 *   - INR region + sales channel
 *   - Publishable API key (for the storefront)
 *   - Product categories + sample products
 *   - Artist records + a commission test record
 *
 * Usage:
 *   pnpm seed
 *
 * Requires the Medusa backend to be running (docker compose up -d backend).
 * Reads MEDUSA_BACKEND_URL, ADMIN_EMAIL, ADMIN_PASSWORD from .env.
 *
 * Idempotent: safe to run multiple times. Existing records are reused.
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);

const BACKEND_URL = (
  process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
).replace(/\/+$/, "");
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@snehavrindakala.example";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin-secret-change-me";

let adminToken = null;

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (adminToken) headers.Authorization = `Bearer ${adminToken}`;
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers,
    signal: AbortSignal.timeout(20000),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function adminLogin() {
  const { status, body } = await request("/auth/admin/emailpass", {
    method: "POST",
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (status !== 200 && status !== 201) {
    throw new Error(
      `Admin login failed (${status}): ${JSON.stringify(body)}. Set ADMIN_EMAIL/ADMIN_PASSWORD in .env.`
    );
  }
  adminToken = body.token || body.access_token || body.session?.token;
  if (!adminToken) {
    throw new Error(`Admin login returned no token: ${JSON.stringify(body)}`);
  }
  console.log("✓ Authenticated as admin");
}

async function getList(path) {
  const { status, body } = await request(path);
  if (!status) return [];
  return body?.result ?? body?.artists ?? body?.regions ?? body ?? [];
}

async function post(path, payload) {
  const { status, body } = await request(path, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return { status, body };
}

async function ensureRegion() {
  // Medusa v2: list regions, create INR if missing.
  const regions = await getList("/admin/regions");
  const inr = regions.find(
    (r) => String(r.currency_code || "").toUpperCase() === "INR"
  );
  if (inr) {
    console.log(`✓ Region INR exists (${inr.id})`);
    return inr.id;
  }
  const { status, body } = await post("/admin/regions", {
    currency_code: "inr",
    name: "India",
    payment_providers: ["razorpay"],
    fulfillment_providers: ["shiprocket", "manual"],
  });
  if (status !== 200 && status !== 201) {
    throw new Error(`Create region failed (${status}): ${JSON.stringify(body)}`);
  }
  const id = body?.region?.id || body?.id;
  console.log(`✓ Created INR region (${id})`);
  return id;
}

async function ensureSalesChannel(regionId) {
  const channels = await getList("/admin/sales-channels");
  const existing = channels.find((c) => c.name === "SnehaVrinda Kala");
  if (existing) {
    console.log(`✓ Sales channel exists (${existing.id})`);
    return existing.id;
  }
  const { status, body } = await post("/admin/sales-channels", {
    name: "SnehaVrinda Kala",
    description: "Primary India sales channel",
    regions: [regionId],
  });
  if (status !== 200 && status !== 201) {
    throw new Error(
      `Create sales channel failed (${status}): ${JSON.stringify(body)}`
    );
  }
  const id = body?.sales_channel?.id || body?.id;
  console.log(`✓ Created sales channel (${id})`);
  return id;
}

async function ensurePublishableKey(salesChannelId) {
  const keys = await getList("/admin/api-keys");
  const existing = keys.find(
    (k) => k.title === "Storefront publishable key"
  );
  if (existing) {
    console.log(`✓ Publishable key exists`);
    return existing.token;
  }
  const { status, body } = await post("/admin/api-keys", {
    title: "Storefront publishable key",
    sales_channel_id: salesChannelId,
    type: "publishable",
  });
  if (status !== 200 && status !== 201) {
    throw new Error(
      `Create API key failed (${status}): ${JSON.stringify(body)}`
    );
  }
  const token = body?.api_key?.token || body?.token;
  console.log(`✓ Created publishable key`);
  return token;
}

async function ensureCategories() {
  const cats = await getList("/admin/product-categories");
  const names = ["Painting & Drawing", "Home & Decor", "Textile & Fibre"];
  const ids = [];
  for (const name of names) {
    let cat = cats.find((c) => c.name === name);
    if (!cat) {
      const { status, body } = await post("/admin/product-categories", {
        name,
        description: `${name} artworks and objects`,
        is_internal: false,
      });
      if (status !== 200 && status !== 201) {
        throw new Error(
          `Create category "${name}" failed (${status}): ${JSON.stringify(body)}`
        );
      }
      cat = body?.product_category ?? body;
    }
    ids.push(cat.id);
    console.log(`✓ Category "${name}" (${cat.id})`);
  }
  return ids;
}

async function ensureArtists() {
  const artists = await getList("/admin/artists");
  const seedArtists = [
    {
      display_name: "Aanya Desai",
      slug: "aanya-desai",
      disciplines: ["Painting", "Illustration"],
      region: "Mumbai, Maharashtra",
      commission_available: true,
      bio: "Contemporary painter working in mineral pigments and indigo.",
    },
    {
      display_name: "Rohan Iyer",
      slug: "rohan-iyer",
      disciplines: ["Textile & Fibre", "Weaving"],
      region: "Kochi, Kerala",
      commission_available: true,
      bio: "Textile artist exploring handloom and natural dye techniques.",
    },
  ];
  const ids = [];
  for (const a of seedArtists) {
    let existing = artists.find((x) => x.slug === a.slug || x.display_name === a.display_name);
    if (!existing) {
      const { status, body } = await post("/admin/artists", a);
      if (status !== 200 && status !== 201) {
        throw new Error(
          `Create artist "${a.display_name}" failed (${status}): ${JSON.stringify(body)}`
        );
      }
      existing = body?.artist ?? body;
    }
    ids.push(existing.id);
    console.log(`✓ Artist "${existing.display_name}" (${existing.id})`);
  }
  return ids;
}

async function ensureProducts(categoryIds) {
  const products = await getList("/store/products");
  const seedProducts = [
    {
      title: "Indigo Mineral Study",
      handle: "indigo-mineral-study",
      description: "A layered indigo and mineral-inspired painting on handmade paper.",
      category_id: categoryIds[0],
      status: "published",
      options: [{ title: "Size", values: ["Small", "Medium", "Large"] }],
      variants: [
        { title: "Small", sku: "IMS-SMALL", prices: [{ currency_code: "inr", amount: 450000 }] },
        { title: "Medium", sku: "IMS-MEDIUM", prices: [{ currency_code: "inr", amount: 750000 }] },
        { title: "Large", sku: "IMS-LARGE", prices: [{ currency_code: "inr", amount: 1200000 }] }],
    },
    {
      title: "Handloom Throw — Natural Dye",
      handle: "handloom-throw-natural-dye",
      description: "Woven textile throw in natural dye, made in Kerala.",
      category_id: categoryIds[2],
      status: "published",
      options: [{ title: "Colour", values: ["Indigo", "Terracotta", "Leaf"] }],
      variants: [
        { title: "Indigo", sku: "HT-INDIGO", prices: [{ currency_code: "inr", amount: 320000 }] },
        { title: "Terracotta", sku: "HT-TERRACOTTA", prices: [{ currency_code: "inr", amount: 320000 }] }],
    },
  ];
  for (const p of seedProducts) {
    let existing = products.find((x) => x.handle === p.handle);
    if (!existing) {
      const { status, body } = await post("/admin/products", p);
      if (status !== 200 && status !== 201) {
        throw new Error(
          `Create product "${p.title}" failed (${status}): ${JSON.stringify(body)}`
        );
      }
      existing = body?.product ?? body;
    }
    console.log(`✓ Product "${existing.title}" (${existing.handle})`);
  }
}

async function ensureCommission(artistId) {
  const { status, body } = await post("/store/commissions", {
    customer_id: "seed-customer",
    art_form: "Painting",
    brief: "A personalised portrait for the living room, approximately 24x36 inches.",
    intended_use: "Home décor",
    budget_range: "₹40,000–₹60,000",
    target_date: "2027-02-01",
    delivery_region: "Maharashtra",
    delivery_pin: "400001",
    status: "New",
    assigned_artist_id: artistId,
  });
  if (status !== 200 && status !== 201) {
    // Commission endpoint may not accept customer-initiated seed in all setups; non-fatal.
    console.log(`⚠ Commission seed not accepted (${status}): ${JSON.stringify(body)}`);
    return;
  }
  const ref = body?.commission_request?.reference_id || body?.reference_id;
  console.log(`✓ Commission test record (${ref})`);
}

async function main() {
  console.log(`🌱 Seeding SnehaVrinda Kala against ${BACKEND_URL}`);
  await adminLogin();
  const regionId = await ensureRegion();
  const salesChannelId = await ensureSalesChannel(regionId);
  await ensurePublishableKey(salesChannelId);
  const categoryIds = await ensureCategories();
  const artistIds = await ensureArtists();
  await ensureProducts(categoryIds);
  if (artistIds[0]) await ensureCommission(artistIds[0]);
  console.log("✅ Seed complete.");
}

main().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
