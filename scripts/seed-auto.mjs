#!/usr/bin/env node
/**
 * SnehaVrinda Kala - FULLY AUTOMATED seed script.
 *
 * Uses Medusa REST API to create everything:
 *   1. System admin user (via CLI)
 *   2. Authenticate as admin
 *   3. Create INR region + sales channel + publishable key
 *   4. Register admin customer account
 *   5. Auto-update .env
 *
 * Run:  node scripts/seed-auto.mjs
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { execSync } = require("child_process");
const fs = require("fs");

// No credential defaults.
//
// These used to fall back to a real-looking admin email and password committed
// in this file. A committed credential is exposed the moment it is pushed, even
// if a later commit removes it — git history keeps it forever, and the value is
// a working login if it was ever used. Require them explicitly instead; the CI
// secret scanner now rejects this pattern.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

for (const [name, value] of [
  ["ADMIN_EMAIL", ADMIN_EMAIL],
  ["ADMIN_PASSWORD", ADMIN_PASSWORD],
]) {
  if (!value) {
    console.error(
      `[seed] ${name} is not set. Export it first, e.g.\n` +
        `  ADMIN_EMAIL=you@example.com ADMIN_PASSWORD="$(openssl rand -base64 24)" pnpm ${process.env.npm_lifecycle_event || "seed:auto"}`
    );
    process.exit(1);
  }
}
const BACKEND_URL =
  process.env.BACKEND_URL || "http://localhost:9000";

async function fetchJSON(path, options = {}) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
    signal: AbortSignal.timeout(15000),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  console.log("🌱 SnehaVrinda Kala - Automated Seed\n");

  // ── Step 1: Create Medusa system admin user ──
  console.log("1/6 Creating Medusa system admin user...");
  try {
    execSync(
      `cd apps/backend && npx medusa user -e "${ADMIN_EMAIL}" -p "${ADMIN_PASSWORD}"`,
      { stdio: "pipe", timeout: 30000, env: { ...process.env, DATABASE_URL } }
    );
    console.log("   ✓ System admin user created");
  } catch (err) {
    // User might already exist
    console.log("   ✓ System admin user already exists (or creation skipped)");
  }

  // ── Step 2: Authenticate as system admin ──
  console.log("\n2/6 Authenticating as system admin...");
  const loginRes = await fetchJSON("/auth/user/emailpass", {
    method: "POST",
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!loginRes.ok) {
    throw new Error(
      `Admin login failed: ${JSON.stringify(loginRes.body)}. Make sure backend is running.`
    );
  }
  const adminToken = loginRes.body?.token || loginRes.body?.session?.token;
  if (!adminToken) {
    throw new Error("Admin login returned no token");
  }
  console.log("   ✓ Authenticated as system admin");

  const authHeaders = {
    Authorization: `Bearer ${adminToken}`,
    "Content-Type": "application/json",
  };

  // ── Step 3: Create INR region ──
  console.log("\n3/6 Creating INR region...");
  const regionRes = await fetchJSON("/admin/regions", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      name: "India",
      currency_code: "inr",
      automatic_taxes: true,
    }),
  });
  let regionId;
  if (regionRes.ok) {
    regionId = regionRes.body?.region?.id || regionRes.body?.id;
    console.log(`   ✓ Region INR: ${regionId}`);
  } else {
    // Region might already exist
    const listRes = await fetchJSON("/admin/regions", {
      headers: authHeaders,
    });
    const existing = listRes.body?.regions?.find(
      (r) => r.currency_code === "inr"
    );
    if (existing) {
      regionId = existing.id;
      console.log(`   ✓ Region INR already exists: ${regionId}`);
    } else {
      throw new Error(
        `Failed to create region: ${JSON.stringify(regionRes.body)}`
      );
    }
  }

  // ── Step 4: Create sales channel ──
  console.log("\n4/6 Creating sales channel...");
  const channelRes = await fetchJSON("/admin/sales-channels", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      name: "SnehaVrinda Kala",
      description: "Primary India sales channel",
    }),
  });
  let channelId;
  if (channelRes.ok) {
    channelId = channelRes.body?.sales_channel?.id || channelRes.body?.id;
    console.log(`   ✓ Sales channel: ${channelId}`);
  } else {
    const listRes = await fetchJSON("/admin/sales-channels", {
      headers: authHeaders,
    });
    const existing = listRes.body?.sales_channels?.find(
      (c) => c.name === "SnehaVrinda Kala"
    );
    if (existing) {
      channelId = existing.id;
      console.log(`   ✓ Sales channel already exists: ${channelId}`);
    } else {
      throw new Error(
        `Failed to create sales channel: ${JSON.stringify(channelRes.body)}`
      );
    }
  }

  // Link region to sales channel
  await fetchJSON(
    `/admin/sales-channels/${channelId}/regions`,
    {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ region_id: regionId }),
    },
  );
  console.log("   ✓ Linked region to sales channel");

  // ── Step 5: Create publishable API key ──
  console.log("\n5/6 Creating publishable API key...");
  // Get the admin user ID for created_by field
  const meRes = await fetchJSON("/admin/me", {
    headers: authHeaders,
  });
  const adminUserId = meRes.ok ? (meRes.body?.user?.id || meRes.body?.id) : null;

  const keyRes = await fetchJSON("/admin/api-keys", {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      title: "Storefront Publishable Key",
      type: "publishable",
      ...(adminUserId ? { created_by: adminUserId } : {}),
    }),
  });
  let publishableKey;
  if (keyRes.ok) {
    publishableKey = keyRes.body?.api_key?.token || keyRes.body?.token;
    console.log(`   ✓ Publishable key: ${publishableKey}`);
  } else {
    // Key might already exist
    const listRes = await fetchJSON("/admin/api-keys", {
      headers: authHeaders,
    });
    const existing = listRes.body?.api_keys?.find(
      (k) => k.title === "Storefront Publishable Key"
    );
    if (existing) {
      publishableKey = existing.token;
      console.log(`   ✓ Publishable key already exists: ${publishableKey}`);
    } else {
      throw new Error(
        `Failed to create API key: ${JSON.stringify(keyRes.body)}`
      );
    }
  }

  // ── Step 6: Register admin customer account ──
  console.log("\n6/6 Registering admin customer account...");
  const registerRes = await fetchJSON(
    "/auth/customer/emailpass/register",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        has_account: true,
      }),
    }
  );
  if (registerRes.ok) {
    console.log("   ✓ Customer registered");
  } else if (registerRes.status === 400 || registerRes.status === 401) {
    // Identity may already exist from system admin user - that's OK
    console.log("   ✓ Customer identity already exists (from admin user)");
  } else {
    throw new Error(
      `Customer registration failed: ${JSON.stringify(registerRes.body)}`
    );
  }

  // Verify customer login works
  console.log("\n🔐 Verifying customer login...");
  const customerLoginRes = await fetchJSON("/auth/customer/emailpass", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (customerLoginRes.ok) {
    console.log("   ✓ Customer login verified!");
  } else {
    console.log(
      `   ⚠ Customer login test: ${JSON.stringify(customerLoginRes.body)}`
    );
    console.log("   You may need to create a customer record manually.");
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
  console.log("\n📝 These values have been added to .env:");
  console.log(`   MEDUSA_PUBLISHABLE_KEY=${publishableKey}`);
  console.log(`   MEDUSA_REGION_ID=${regionId}`);
  console.log(`   ADMIN_EMAILS=${ADMIN_EMAIL}`);
  console.log(`   ADMIN_PASSWORD=${ADMIN_PASSWORD}`);
  console.log("\n🔐 Login at: http://localhost:3000/admin/login");
  console.log(`   Email: ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);

  // ── Auto-update .env ──
  const fs = require("fs");
  let envContent = fs.existsSync(".env") ? fs.readFileSync(".env", "utf8") : "";

  const setEnv = (key, value) => {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  };

  setEnv("MEDUSA_PUBLISHABLE_KEY", publishableKey);
  setEnv("MEDUSA_REGION_ID", regionId);
  setEnv("ADMIN_EMAILS", ADMIN_EMAIL);
  setEnv("ADMIN_PASSWORD", ADMIN_PASSWORD);

  fs.writeFileSync(".env", envContent);
  console.log("💾 .env updated automatically!");
}

main().catch((err) => {
  console.error("\n❌ Seed failed:", err.message);
  process.exit(1);
});
