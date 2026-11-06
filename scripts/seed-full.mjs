#!/usr/bin/env node
/**
 * SnehaVrinda Kala — FULLY AUTOMATED seed script.
 *
 * Creates everything needed for admin panel login directly in PostgreSQL:
 *   - INR region
 *   - Sales channel linked to region
 *   - Publishable API key (for storefront customer auth)
 *   - Admin customer account (sneha@sainath.com / snehalovessainath143)
 *
 * No manual steps. Run:  pnpm seed:full
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

async function main() {
  console.log("🌱 Seeding SnehaVrinda Kala (fully automated)...\n");

  // ── 1. Create INR region ──
  console.log("1/5 Creating INR region...");
  const regionRows = await query(`
    INSERT INTO region (id, name, currency_code, tax_code, payment_providers, fulfillment_providers, created_at, updated_at)
    VALUES (gen_random_uuid(), 'India', 'inr', NULL, '["razorpay"]', '["shiprocket", "manual"]', now(), now())
    ON CONFLICT (currency_code) DO UPDATE
      SET name = EXCLUDED.name, updated_at = now()
    RETURNING id, currency_code
  `);
  const regionId = regionRows[0].id;
  console.log(`   ✓ Region INR: ${regionId}\n`);

  // ── 2. Create sales channel ──
  console.log("2/5 Creating sales channel...");
  const channelRows = await query(`
    INSERT INTO sales_channel (id, name, description, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), 'SnehaVrinda Kala', 'Primary India sales channel', true, now(), now())
    RETURNING id
  `);
  const channelId = channelRows[0].id;
  console.log(`   ✓ Sales channel: ${channelId}\n`);

  // ── 3. Link region to sales channel ──
  await query(`
    INSERT INTO sales_channel_region (sales_channel_id, region_id, created_at, updated_at)
    VALUES ($1, $2, now(), now())
    ON CONFLICT DO NOTHING
  `, [channelId, regionId]);
  console.log(`   ✓ Linked region to sales channel\n`);

  // ── 4. Create publishable API key ──
  console.log("3/5 Creating publishable API key...");
  const keyRows = await query(`
    INSERT INTO api_key (id, token, type, is_active, created_at, updated_at, sales_channel_id)
    VALUES (gen_random_uuid(), 'pk_test_snehavrinda_auto', 'publishable', true, now(), now(), $1)
    RETURNING token
  `, [channelId]);
  const publishableKey = keyRows[0].token;
  console.log(`   ✓ Publishable key: ${publishableKey}\n`);

  // ── 5. Create admin customer account ──
  console.log("4/5 Creating admin customer account...");
  // Hash the password with bcrypt (Medusa stores bcrypt hashes)
  const bcrypt = require("bcryptjs");
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const customerRows = await query(`
    INSERT INTO customer (id, email, password_hash, created_at, updated_at)
    VALUES (gen_random_uuid(), $1, $2, now(), now())
    ON CONFLICT (email) DO UPDATE
      SET password_hash = EXCLUDED.password_hash, updated_at = now()
    RETURNING id, email
  `, [ADMIN_EMAIL, passwordHash]);
  console.log(`   ✓ Customer: ${customerRows[0].email} (${customerRows[0].id})\n`);

  // ── 6. Summary ──
  console.log("══════════════════════════════════════════════════════════");
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
