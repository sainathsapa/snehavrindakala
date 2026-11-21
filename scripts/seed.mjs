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
    console.warn(
      `⚠ Medusa admin login failed (${status}). Admin-only seeding skipped. `
        + "Use the Medusa Admin UI at /admin to create regions, products, etc."
    );
    adminToken = null;
    return;
  }
  // Medusa v2 admin auth uses session cookies, not bearer tokens.
  // Admin-only seeding (regions, products, etc.) must be done via Medusa Admin UI.
  adminToken = null;
  console.warn(
    "⚠ Medusa v2 admin auth uses session cookies. Admin-only seeding skipped. "
      + "Create catalogue data via the Medusa Admin UI at /admin instead."
  );
}

async function getList(path) {
  const { status, body } = await request(path);
  if (!status || !body) return [];
  // Handle Medusa v2 admin API response shapes
  if (Array.isArray(body)) return body;
  if (body?.result && Array.isArray(body.result)) return body.result;
  if (body?.regions && Array.isArray(body.regions)) return body.regions;
  if (body?.sales_channels && Array.isArray(body.sales_channels))
    return body.sales_channels;
  if (body?.artists && Array.isArray(body.artists)) return body.artists;
  if (body?.data && Array.isArray(body.data)) return body.data;
  if (body?.items && Array.isArray(body.items)) return body.items;
  console.warn(`⚠ Unexpected response shape from ${path}: ${JSON.stringify(body).slice(0, 200)}`);
  return [];
}

async function post(path, payload) {
  const { status, body } = await request(path, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return { status, body };
}

/**
 * Which payment providers the region should accept.
 *
 * These are Medusa provider ids, not brand names. The old seed wrote
 * `["razorpay"]`, which is not an id any module registers, so Medusa silently
 * created a region with no payment provider at all — checkout worked only
 * because the storefront asks for `pp_system_default` by name.
 *
 * The Razorpay provider is registered by medusa-config.ts only when its keys
 * are set, so the region is only told about it under the same condition.
 */
function desiredPaymentProviders() {
  const providers = ["pp_system_default"];
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    providers.push("pp_razorpay_razorpay");
  }
  return providers;
}

async function ensureRegion() {
  // Medusa v2: list regions, create INR if missing.
  const regions = await getList("/admin/regions");
  const inr = regions.find(
    (r) => String(r.currency_code || "").toUpperCase() === "INR"
  );

  const desired = desiredPaymentProviders();

  if (inr) {
    // Reconcile, do not just return. The seed is re-run on every deploy, and a
    // region that predates the Razorpay provider would otherwise never gain it.
    const current = (inr.payment_providers || []).map((p) =>
      typeof p === "string" ? p : p?.id
    );
    const missing = desired.filter((p) => !current.includes(p));
    if (missing.length) {
      const { status, body } = await post(`/admin/regions/${inr.id}`, {
        payment_providers: desired,
      });
      if (status !== 200 && status !== 201) {
        throw new Error(
          `Enable payment providers on the region failed (${status}): ${JSON.stringify(body)}`
        );
      }
      console.log(`✓ Region INR now accepts ${desired.join(", ")}`);
    } else {
      console.log(`✓ Region INR exists (${inr.id})`);
    }
    return inr.id;
  }

  const { status, body } = await post("/admin/regions", {
    currency_code: "inr",
    name: "India",
    payment_providers: desired,
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

async function ensureAdminCustomer() {
  // Register a customer account with the admin email so it can log into
  // the partner admin panel. Medusa customer registration via store API.
  try {
    const { status, body } = await post("/auth/customer/emailpass/register", {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    if (status === 200 || status === 201) {
      console.log(`✓ Admin customer registered (${ADMIN_EMAIL})`);
    } else if (status === 400 && body?.error?.includes("already exists")) {
      console.log(`✓ Admin customer already exists (${ADMIN_EMAIL})`);
    } else {
      console.log(
        `⚠ Admin customer registration returned ${status}: ${JSON.stringify(body)}`
      );
    }
  } catch (err) {
    console.log(
      `⚠ Admin customer registration skipped: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

async function main() {
  console.log(`🌱 Seeding SnehaVrinda Kala against ${BACKEND_URL}`);
  await adminLogin();

  // Admin-only seeding (requires Medusa system admin credentials).
  // These create regions, sales channels, products, artists — needed for
  // the storefront to have data, but optional for admin panel access.
  if (adminToken) {
    const regionId = await ensureRegion();
    const salesChannelId = await ensureSalesChannel(regionId);
    await ensurePublishableKey(salesChannelId);
    const categoryIds = await ensureCategories();
    const artistIds = await ensureArtists();
    await ensureProducts(categoryIds);
    if (artistIds[0]) await ensureCommission(artistIds[0]);
  } else {
    console.warn("⚠ Skipping admin-only seeding (regions, products, artists). "
      + "Create a Medusa system admin user to seed catalogue data.");
  }

  // Customer account creation is public — works without admin auth.
  // This is what lets you log into the admin panel.
  await ensureAdminCustomer();
  console.log("✅ Seed complete.");
}

main().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
