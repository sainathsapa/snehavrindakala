import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const source = readFileSync(
  join(root, "app/api/account/data/route.ts"),
  "utf8"
);

describe("LEG-02 customer data export and deletion request", () => {
  it("exposes GET and POST with customer-token auth", () => {
    expect(source).toMatch(/export async function GET\(/);
    expect(source).toMatch(/export async function POST\(/);
    expect(source).toMatch(/getAuthToken\(\)/);
    expect(source).toMatch(/status: 401/);
  });

  it("exports the requested categories of data", () => {
    for (const section of [
      "profile",
      "orders",
      "wishlist",
      "newsletter",
      "commissions",
      "tickets",
    ]) {
      expect(source, `missing ${section}`).toMatch(new RegExp(`\\b${section}\\b`));
    }
  });

  it("records a deletion request instead of hard-deleting data", () => {
    // Requests go into the existing audit_log table, so the route does not
    // introduce a table that db/schema.sql does not define.
    expect(source).toMatch(/INSERT INTO audit_log/);
    expect(source).toMatch(/data_deletion_request/);
    expect(source).toMatch(/status: "pending"/);
    expect(source).toMatch(/status: 202/);
    expect(source).not.toMatch(/CREATE TABLE IF NOT EXISTS/);
    // No destructive statements against customer tables.
    expect(source).not.toMatch(/DELETE FROM (customer|order|users|support_tickets|newsletter_subscribers)/);
  });
});
