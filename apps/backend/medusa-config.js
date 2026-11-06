// Production (CJS) Medusa config. `medusa start` loads config via `require()`,
// which cannot resolve `.ts` source in production. This mirrors medusa-config.ts.
"use strict";

const { defineConfig } = require("@medusajs/utils");

const isProduction = process.env.NODE_ENV === "production";

function secret(name) {
  const value = process.env[name] || (isProduction ? undefined : "supersecret");
  if (!value) {
    throw new Error(
      `${name} is required in production. Set it in the deployment environment.`
    );
  }
  return value;
}

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      // Medusa expects a comma-separated string of origins (or a single origin).
      storeCors: process.env.STORE_CORS || "http://localhost:3000",
      adminCors: process.env.ADMIN_CORS || "http://localhost:7000,http://localhost:3000",
      authCors: process.env.AUTH_CORS || "http://localhost:3000",
      jwtSecret: secret("JWT_SECRET"),
      cookieSecret: secret("COOKIE_SECRET"),
    },
  },
  // Custom business modules (Medusa v2 module system)
  modules: [
    { resolve: "./src/modules/artist" },
    { resolve: "./src/modules/commission" },
    { resolve: "./src/modules/ledger" },
    { resolve: "./src/modules/audit" },
    { resolve: "./src/modules/integration_event" },
    { resolve: "./src/modules/notification" },
  ],
  // Payment provider: Razorpay
  payment_providers: [
    {
      resolve: "./src/providers/payment/razorpay",
      id: "razorpay",
      options: {
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
        webhook_secret: process.env.RAZORPAY_WEBHOOK_SECRET,
      },
    },
  ],
  // Fulfilment provider: Shiprocket
  fulfillment_providers: [
    {
      resolve: "./src/providers/fulfilment/shiprocket",
      id: "shiprocket",
      options: {
        email: process.env.SHIPROCKET_EMAIL,
        password: process.env.SHIPROCKET_PASSWORD,
        api_token: process.env.SHIPROCKET_API_TOKEN,
      },
    },
  ],
});
