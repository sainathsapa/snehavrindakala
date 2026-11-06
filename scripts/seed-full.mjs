#!/usr/bin/env node
/**
 * SnehaVrinda Kala — FULLY AUTOMATED seed script.
 *
 * Creates everything needed for admin panel login:
 *   - INR region
 *   - Sales channel
 *   - Publishable API key (for storefront customer auth)
 *   - Admin customer account (sneha@sainath.com / snehalovessainath143)
 *
 * Uses direct SQL for simple tables and the Medusa Store API for customer
 * registration (since Medusa v2 stores password hashes in provider_identity,
 * not the customer table).
 *
 * Run:  pnpm seed:full
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { Pool } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_URL || "postgresql://medusa:medusa@localhost:5432/medusa";
const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL || "sneha@sainath.com";
const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "snehalovessainath143";
const BACKEND_URL =
  process.env.BACKEND_URL || process.env.MEDUSA_BACKEND_URL || "http://localhost:9000";

const pool = new Pool({ connectionString: DATABASE_URL });

async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const res = await client.query(sql, params);
    return res.rows;
  } finally {
    client.release();
  }
}

async function fetchJSON(path, options = {}) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  console.log("🌱 Seeding SnehaVrinda Kala (fully automated)...\n");

  // ── 1. Create INR region ──
  console.log("1/5 Creating INR region...");
  const existingRegion = await query(
    `SELECT id FROM region WHERE currency_code = 'inr' LIMIT 1`
  );
  let regionId;
  if (existingRegion.length > 0) {
    regionId = existingRegion[0].id;
    console.log(`   ✓ Region INR already exists: ${regionId}\n`);
  } else {
    const regionRows = await query(`
      INSERT INTO region (id, name, currency_code, automatic_taxes, created_at, updated_at)
      VALUES (gen_random_uuid(), 'India', 'inr', true, now(), now())
      RETURNING id, currency_code
    `);
    regionId = regionRows[0].id;
    console.log(`   ✓ Region INR: ${regionId}\n`);
  }

  // ── 2. Create sales channel ──
  console.log("2/5 Creating sales channel...");
  const existingChannel = await query(
    `SELECT id FROM sales_channel WHERE name = 'SnehaVrinda Kala' LIMIT 1`
  );
  let channelId;
  if (existingChannel.length > 0) {
    channelId = existingChannel[0].id;
    console.log(`   ✓ Sales channel already exists: ${channelId}\n`);
  } else {
    const channelRows = await query(`
      INSERT INTO sales_channel (id, name, description, is_disabled, created_at, updated_at)
      VALUES (gen_random_uuid(), 'SnehaVrinda Kala', 'Primary India sales channel', false, now(), now())
      RETURNING id
    `);
    channelId = channelRows[0].id;
    console.log(`   ✓ Sales channel: ${channelId}\n`);
  }

  // ── 3. Create publishable API key ──
  console.log("3/5 Creating publishable API key...");
  const bcrypt = require("bcryptjs");
  const salt = await bcrypt.genSalt(10);

  // Check for existing publishable key first (idempotent)
  const existingKeys = await query(
    `SELECT id, token FROM api_key WHERE type = 'publishable' LIMIT 1`
  );
  let publishableKey;
  let keyId;
  if (existingKeys.length > 0) {
    keyId = existingKeys[0].id;
    publishableKey = existingKeys[0].token;
    console.log(`   ✓ Publishable key already exists: ${publishableKey}\n`);
  } else {
    const token = `pk_test_${Buffer.from(crypto.randomUUID().replace(/-/g, ""), "hex").toString("base64")}`;
    const redacted = token.slice(0, 8) + "…" + token.slice(-4);
    keyId = `pk_${Buffer.from(crypto.randomUUID().replace(/-/g, ""), "hex").toString("base64url")}`;

    const keyRows = await query(`
      INSERT INTO api_key (id, token, salt, redacted, title, type, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'publishable', $6, now(), now())
      RETURNING id, token
    `, [keyId, token, salt, redacted, "Storefront publishable key", keyId]);
    publishableKey = keyRows[0].token;
    console.log(`   ✓ Publishable key: ${publishableKey}\n`);
  }

  // ── 3b. Link API key to sales channel ──
  await query(`
    INSERT INTO publishable_api_key_sales_channel (id, publishable_key_id, sales_channel_id, created_at, updated_at)
    VALUES (gen_random_uuid(), $1, $2, now(), now())
    ON CONFLICT DO NOTHING
  `, [keyId, channelId]);
  console.log(`   ✓ Linked API key to sales channel\n`);

  // ── 4. Register admin customer account via Store API ──
  console.log("4/5 Registering admin customer account...");
  const registerRes = await fetchJSON("/auth/customer/emailpass/register", {
    method: "POST",
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      has_account: true,
    }),
  });
  if (registerRes.ok) {
    console.log(`   ✓ Customer registered (${ADMIN_EMAIL})`);
    // Create the customer record linked to the auth session
    const authToken = registerRes.body?.token;
    if (authToken) {
      const createRes = await fetchJSON("/store/customers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "x-publishable-api-key": publishableKey,
        },
        body: JSON.stringify({
          email: ADMIN_EMAIL,
          first_name: "Sneha",
          last_name: "Sainath",
        }),
      });
      if (createRes.ok) {
        console.log(`   ✓ Customer record created (${ADMIN_EMAIL})`);
      } else if (createRes.status === 400 && createRes.body?.message?.includes("already exists")) {
        console.log(`   ✓ Customer record already exists (${ADMIN_EMAIL})`);
      } else {
        console.log(`   ⚠ Customer record creation returned ${createRes.status}: ${JSON.stringify(createRes.body)}`);
      }
    }
  } else if (registerRes.status === 400 && registerRes.body?.message?.includes("already exists")) {
    console.log(`   ✓ Customer identity already exists (${ADMIN_EMAIL})`);
  } else {
    console.log(`   ⚠ Registration returned ${registerRes.status}: ${JSON.stringify(registerRes.body)}`);
  }

  // Verify customer login works
  console.log("5/5 Verifying customer login...");
  const loginRes = await fetchJSON("/auth/customer/emailpass", {
    method: "POST",
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (loginRes.ok) {
    console.log(`   ✓ Customer login verified!`);
  } else {
    console.log(`   ⚠ Login test returned ${loginRes.status}: ${JSON.stringify(loginRes.body)}`);
  }

  // ── Summary ──
  console.log("\n══════════════════════════════════════════════════════════");
  console.log("✅ SEED COMPLETE");
  console.log("══════════════════════════════════════════════════════════");
  console.log(`Region ID:       ${regionId}`);
  console.log(`Sales Channel:   ${channelId}`);
  console.log(`Publishable Key: ${publishableKey}`);
  console.log(`Admin Email:     ${ADMIN_EMAIL}`);
  console.log(`Admin Password:  ${ADMIN_PASSWORD}`);
  console.log("══════════════════════════════════════════════════════════");
  console.log("\n📝 Add these to your .env:");
  console.log(`   MEDUSA_PUBLISHABLE_KEY=${publishableKey}`);
  console.log(`   MEDUSA_REGION_ID=${regionId}`);
  console.log(`   ADMIN_EMAILS=${ADMIN_EMAIL}`);
  console.log(`   ADMIN_PASSWORD=${ADMIN_PASSWORD}`);
  console.log("\n🔐 Login at: http://localhost:3000/admin/login");
  console.log(`   Email: ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
}

main().then(() => pool.end()).catch((err) => {
  console.error("❌ Seed failed:", err.message);
  pool.end();
  process.exit(1);
});
