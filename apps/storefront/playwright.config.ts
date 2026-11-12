import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests for the storefront.
 *
 * `test:e2e` has pointed at Playwright since the project was scaffolded without
 * a config or a single test. These specs drive the journeys that matter and
 * that unit tests cannot cover: browsing, cart, the commission brief, the
 * search box, and the admin gate.
 *
 * The dev server is started automatically. Set E2E_BASE_URL to test a deployed
 * environment instead.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",

  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3200",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        // `next build && next start`, not `next dev`. In dev, Next's HMR
        // websocket keeps the browser context alive, so Playwright teardown can
        // exceed the test timeout even when every assertion passes. A production
        // server also matches what users actually hit.
        command: "npx next build && npx next start -p 3200",
        url: "http://localhost:3200",
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
      },
});
