import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("ANA-01 GA4 consent mode", () => {
  const layout = read("app/[locale]/layout.tsx");

  it("denies analytics storage before the config call", () => {
    const deny = layout.indexOf("gtag('consent', 'default'");
    const config = layout.indexOf("gtag('config'");
    expect(deny).toBeGreaterThan(-1);
    expect(config).toBeGreaterThan(deny);
    expect(layout).toMatch(/analytics_storage: 'denied'/);
  });

  it("only loads the banner when a measurement id is configured", () => {
    expect(layout).toMatch(/gaMeasurementId && \(/);
    expect(layout).toMatch(/<AnalyticsConsent \/>/);
  });

  it("exports all five ecommerce events behind one consent gate", () => {
    const analytics = read("lib/analytics.ts");
    for (const event of [
      "view_item",
      "add_to_cart",
      "begin_checkout",
      "purchase",
      "refund",
    ]) {
      expect(analytics, `missing ${event}`).toMatch(new RegExp(`"${event}"`));
    }
    expect(analytics).toMatch(/getAnalyticsConsent\(\) !== "granted"\) return/);
    expect(analytics).toMatch(/new Set<string>\(\)/);
    expect(analytics).not.toMatch(/from "@\/lib\/db"/);
  });

  it("wires the events through the client bridge", () => {
    const consent = read("components/analytics-consent.tsx");
    for (const helper of [
      "trackViewItem",
      "trackAddToCart",
      "trackBeginCheckout",
      "trackPurchase",
      "trackRefund",
    ]) {
      expect(consent, `missing ${helper}`).toMatch(new RegExp(helper));
    }
    expect(consent).toMatch(/svk:cart-changed/);
    expect(consent).toMatch(/paid/);
    expect(consent).toMatch(/setAnalyticsConsent\("granted"\)/);
  });

  it("lets a visitor reopen the banner from the footer", () => {
    expect(read("components/footer.tsx")).toMatch(/CookieSettingsButton/);
  });
});
