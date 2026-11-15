import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards the end of the checkout.
 *
 * A buyer paid, landed on the confirmation page, and found the same items still
 * sitting in their cart. Two separate things caused that:
 *
 *   - nothing deleted the cart cookie after the order was placed, so the id
 *     outlived the cart it pointed at;
 *   - `getCart` treated "Medusa answered" as "the cart is live", and Medusa
 *     still answers reads for a cart it has already converted into an order.
 *
 * Neither shows up as an error: the cart simply keeps working, which is exactly
 * why it went unnoticed. This test pins both halves, because either one coming
 * back would restore the bug on its own.
 */

const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("checkout clears the cart", () => {
  it("deletes the cart cookie once the order exists", () => {
    const route = read("app/api/store/checkout/complete/route.ts");

    // The deletion has to come after the cart is completed, or a failed
    // payment would empty a cart the buyer still needs.
    const completedAt = route.indexOf("completeOrder(");
    const deleteAt = route.indexOf("delete(CART_COOKIE)");

    expect(completedAt).toBeGreaterThan(-1);
    expect(deleteAt).toBeGreaterThan(-1);
    expect(deleteAt).toBeGreaterThan(completedAt);
  });

  it("treats a completed cart as empty, not as a live cart", () => {
    const cart = read("lib/cart.ts");

    // The state check is what stops a stale cookie resurrecting a finished
    // cart if the cookie write above ever fails.
    expect(cart).toMatch(/completed_at/);

    const getCartBody = cart.slice(
      cart.indexOf("export async function getCart"),
      cart.indexOf("export async function ensureCart")
    );
    expect(getCartBody).toMatch(/completed_at/);
  });
});
