import { defineConfig } from "@medusajs/medusa";
import { Modules } from "@medusajs/utils";

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS?.split(",") || [
        "http://localhost:3000",
      ],
      adminCors: process.env.ADMIN_CORS?.split(",") || [
        "http://localhost:7000",
        "http://localhost:3000",
      ],
      authCors: process.env.AUTH_CORS?.split(",") || [
        "http://localhost:3000",
      ],
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
  modules: [
    {
      resolve: "@medusajs/medusa/flavor/modules",
    },
    // Custom business modules (defined below)
    { resolve: "./src/modules/artist" },
    { resolve: "./src/modules/partner" },
    { resolve: "./src/modules/commission" },
    { resolve: "./src/modules/ledger" },
  ],
});
