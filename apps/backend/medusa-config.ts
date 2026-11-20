import { defineConfig } from "@medusajs/utils";

/**
 * Medusa configuration.
 *
 * ONE FILE, ON PURPOSE
 *
 * There used to be both `medusa-config.ts` and a hand-maintained
 * `medusa-config.js` copy, because someone found that `medusa start` could not
 * load the `.ts` file. The copies drifted: the `.js` one — the one the server
 * actually runs in production — never gained the `review` module, so
 * `/store/reviews` answered 500 with "Could not resolve 'review'" in deployed
 * environments while working in development. The `.ts` file also imported
 * `defineConfig` from `@medusajs/medusa`, which does not export it, so it could
 * not compile at all and the two configs were never interchangeable.
 *
 * The loader resolves `medusa-config` through Node resolution and imports
 * whichever exists, transpiling `.ts`. Keeping a single file removes the drift.
 * `defineConfig` comes from `@medusajs/utils`, which is where it is exported.
 */

const isProduction = process.env.NODE_ENV === "production";

function secret(name: string): string {
  const value =
    process.env[name] || (isProduction ? undefined : "supersecret");
  if (!value) {
    throw new Error(
      `${name} is required in production. Set it in the deployment environment.`
    );
  }
  return value;
}

const redisUrl = process.env.REDIS_URL;

/**
 * Redis-backed infrastructure modules.
 *
 * Without these Medusa falls back to in-memory equivalents and logs "Local
 * Event Bus installed. This is not recommended for production": events,
 * workflow state, cache entries and locks are all lost on restart, so a payment
 * webhook that arrives during a deploy is dropped rather than retried. Only
 * enabled when REDIS_URL is set so a single-container setup still runs.
 */
const redisModules: any[] = redisUrl
  ? [
      {
        resolve: "@medusajs/medusa/cache-redis",
        options: { redisUrl },
      },
      {
        resolve: "@medusajs/medusa/event-bus-redis",
        options: { redisUrl },
      },
      {
        // Workflow engine is the odd one out: it reads `options.redis.redisUrl`
        // (a nested object, because the same block carries queue options), while
        // cache and event bus read a flat `options.redisUrl`. Passing the flat form
        // here makes the loader crash with "Cannot destructure property 'url' of
        // undefined" and the whole backend fail to resolve the Workflows module.
        resolve: "@medusajs/medusa/workflow-engine-redis",
        options: { redis: { redisUrl } },
      },
      {
        resolve: "@medusajs/medusa/locking",
        options: {
          providers: [
            {
              resolve: "@medusajs/medusa/locking-redis",
              id: "locking-redis",
              is_default: true,
              options: { redisUrl },
            },
          ],
        },
      },
    ]
  : [];

/**
 * Payment and fulfilment providers: NOT ENABLED — they are Medusa v1 adapters.
 *
 * `src/providers/payment/razorpay` and `src/providers/fulfilment/shiprocket` are
 * plain classes with a v1 factory (`export default function ({container, options})`)
 * and v1 method names (`createPayment`, `createFulfillment`). Medusa v2 loads a
 * provider module by iterating the module's exported services and registering each
 * one by its static `identifier`, and it requires the class to extend
 * `AbstractPaymentProvider` / `AbstractFulfillmentProviderService` with v2 method
 * names (`initiatePayment`, `authorizePayment`, `getFulfillmentOptions`, ...).
 *
 * Registering them makes the backend crash on boot with
 * "TypeError: moduleProviderServices is not iterable". Leaving the old top-level
 * `payment_providers` key in place is equally wrong: v2 rejects that key entirely,
 * so the providers were never loaded and checkout silently fell back to Medusa's
 * system (manual) provider.
 *
 * Until the adapters are ported to v2, checkout uses `pp_system_default` and
 * fulfilment uses `manual_manual`. Both are registered by the seed script, so the
 * store is fully orderable as shipped.
 */

/**
 * `any[]` on purpose: the declaration type for a module array only accepts a
 * custom `key` on a statically known element, and this list is assembled from the
 * blocks above. Medusa validates the shape at boot, so a mistake still fails loud.
 */
const modules: any[] = [
  // Custom business modules (Medusa v2 module system)
  { resolve: "./src/modules/artist" },
  { resolve: "./src/modules/commission" },
  { resolve: "./src/modules/ledger" },
  { resolve: "./src/modules/audit" },
  { resolve: "./src/modules/integration_event" },
  {
    // Medusa ships its own `notification` module. Registering ours under the same
    // key silently lost the contest: the container kept Medusa's service, so
    // `sendNotification` — a method only our service has — did not exist and every
    // transactional email failed at runtime. A distinct key and table keep the two
    // modules apart.
    resolve: "./src/modules/notification",
    key: "app_notification",
  },
  { resolve: "./src/modules/review" },

  ...redisModules,
];

export default defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl,
    http: {
      // Medusa expects a comma-separated string of origins (or a single origin).
      storeCors: process.env.STORE_CORS || "http://localhost:3000",
      adminCors:
        process.env.ADMIN_CORS || "http://localhost:7000,http://localhost:3000",
      authCors: process.env.AUTH_CORS || "http://localhost:3000",
      jwtSecret: secret("JWT_SECRET"),
      cookieSecret: secret("COOKIE_SECRET"),
    },
  },

  modules,
});
