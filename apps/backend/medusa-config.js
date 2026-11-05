// Production (CJS) Medusa config. `medusa start` loads config via `require()`,
// which cannot resolve `.ts` source in production. This mirrors medusa-config.ts.
"use strict";

const { defineConfig } = require("@medusajs/utils");

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS
        ? process.env.STORE_CORS.split(",")
        : ["http://localhost:3000"],
      adminCors: process.env.ADMIN_CORS
        ? process.env.ADMIN_CORS.split(",")
        : ["http://localhost:7000", "http://localhost:3000"],
      authCors: process.env.AUTH_CORS
        ? process.env.AUTH_CORS.split(",")
        : ["http://localhost:3000"],
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
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
