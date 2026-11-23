import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gstConfigStatus } from "../lib/tax-server";

const root = join(__dirname, "..");
const invoice = readFileSync(
  join(root, "app/admin/orders/[id]/invoice/page.tsx"),
  "utf8"
);

describe("GST-02 invoice gating", () => {
  it("never presents a statutory invoice without validated config", () => {
    expect(invoice).toMatch(/gstConfigStatus\(\)/);
    expect(invoice).toMatch(/const statutory = gst\.ready/);
    expect(invoice).toMatch(/Not a statutory tax invoice/);
    expect(invoice).toMatch(/statutory \? "TAX INVOICE" : "ORDER STATEMENT"/);
    expect(invoice).toMatch(/Not valid as a tax invoice/);
  });

  it("renders HSN/seller identity/tax split only when statutory config is ready", () => {
    expect(invoice).toMatch(/\{statutory && \(/);
    expect(invoice).toMatch(/SELLER_LEGAL_NAME/);
    expect(invoice).toMatch(/SELLER_GSTIN/);
    expect(invoice).toMatch(/HSN_SAC_DEFAULT/);
    expect(invoice).toMatch(/taxBreakdown\.igst/);
    expect(invoice).toMatch(/taxBreakdown\.cgst/);
    expect(invoice).toMatch(/taxBreakdown\.sgst/);
  });

  it("a configuration without mandatory fields is never ready", () => {
    expect(gstConfigStatus({}).ready).toBe(false);
    expect(gstConfigStatus({}).missing).toContain("SELLER_GSTIN");
  });
});
