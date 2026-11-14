import { getCart } from "@/lib/cart";
import { formatPrice } from "@/lib/medusa";
import { removeCartItemAction, updateCartItemAction } from "./actions";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const cart = await getCart();
  const items = cart?.items ?? [];

  return (
    <main className="py-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-deep-ink mb-8">
          Your cart
        </h1>

        {items.length === 0 ? (
          <div className="rounded-xl border border-sand-border bg-surface p-8 text-center">
            <p className="text-lg text-muted-ink font-sans mb-6">
              Your cart is empty.
            </p>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 text-sm font-medium text-sindoor hover:underline"
            >
              Browse products →
            </Link>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-sand-border bg-surface p-8">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-sand-border">
                    <th className="py-4 text-muted-ink font-sans">Item</th>
                    <th className="py-4 text-muted-ink font-sans text-right">
                      Price
                    </th>
                    <th className="py-4 text-muted-ink font-sans text-center">
                      Qty
                    </th>
                    <th className="py-4 text-muted-ink font-sans text-right">
                      Total
                    </th>
                    <th className="py-4" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-sand-border">
                      <td className="py-4 text-muted-ink font-sans">
                        {item.product_title || item.title || "Product"}
                        {item.variant_title && (
                          <span className="block text-xs text-muted-ink">
                            {item.variant_title}
                          </span>
                        )}
                      </td>
                      <td className="py-4 text-muted-ink font-sans text-right">
                        {formatPrice(item.unit_price, cart?.currency_code)}
                      </td>
                      <td className="py-4">
                        <div className="flex items-center justify-center gap-2">
                          <form action={updateCartItemAction}>
                            <input
                              type="hidden"
                              name="line_id"
                              value={item.id}
                            />
                            <input
                              type="hidden"
                              name="quantity"
                              value={Math.max(1, item.quantity - 1)}
                            />
                            <button
                              type="submit"
                              aria-label="Decrease quantity"
                              className="h-8 w-8 rounded border border-sand-border text-muted-ink hover:text-sindoor"
                            >
                              −
                            </button>
                          </form>
                          <span className="w-6 text-center text-sm text-deep-ink">
                            {item.quantity}
                          </span>
                          <form action={updateCartItemAction}>
                            <input
                              type="hidden"
                              name="line_id"
                              value={item.id}
                            />
                            <input
                              type="hidden"
                              name="quantity"
                              value={item.quantity + 1}
                            />
                            <button
                              type="submit"
                              aria-label="Increase quantity"
                              className="h-8 w-8 rounded border border-sand-border text-muted-ink hover:text-sindoor"
                            >
                              +
                            </button>
                          </form>
                        </div>
                      </td>
                      <td className="py-4 text-muted-ink font-sans text-right">
                        {formatPrice(
                          item.total ?? item.unit_price * item.quantity,
                          cart?.currency_code
                        )}
                      </td>
                      <td className="py-4 text-right">
                        <form action={removeCartItemAction}>
                          <input type="hidden" name="line_id" value={item.id} />
                          <button
                            type="submit"
                            className="text-xs text-muted-ink hover:text-sindoor"
                          >
                            Remove
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
              <div className="text-lg font-serif font-semibold text-deep-ink">
                Total:
                <span className="ml-2 text-sindoor font-bold">
                  {formatPrice(cart?.total ?? 0, cart?.currency_code)}
                </span>
              </div>
              <Link
                href="/checkout"
                className="px-6 py-3 bg-sindoor text-rang-paper rounded-xl font-semibold hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 transition-colors"
              >
                Continue to Checkout
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
