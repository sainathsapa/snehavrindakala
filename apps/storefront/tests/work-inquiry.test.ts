import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A work inquiry is only useful if it lands in the queue staff already watch.
 *
 * These checks are about wiring, not rendering: the PDP links a work, the route
 * stores that work with the ticket, and the admin list reads it back. The first
 * version of this feature would have been a second inbox nobody opens.
 */
const root = join(__dirname, "..");

describe("work inquiry", () => {
  const route = readFileSync(join(root, "app/api/tickets/route.ts"), "utf8");
  const pdp = readFileSync(join(root, "app/[locale]/products/[handle]/page.tsx"), "utf8");
  const schema = readFileSync(join(root, "db/schema.sql"), "utf8");

  it("stores the work a question is about", () => {
    expect(route).toMatch(/product_handle/);
    // The column must exist on a database that predates it, too.
    expect(route).toMatch(/ADD COLUMN IF NOT EXISTS product_handle/);
    expect(schema).toMatch(/product_handle text/);
  });

  it("reads the work back for the admin queue", () => {
    expect(route).toMatch(/product_handle/);
    expect(route).toMatch(/FROM support_tickets/);
  });

  it("is reachable from the product page", () => {
    expect(pdp).toMatch(/<WorkInquiryForm/);
  });

  it("refuses a question with no way to answer it", () => {
    expect(route).toMatch(/Invalid email/);
  });
});
