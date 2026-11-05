import { medusa } from "@/lib/medusa";
import Link from "next/link";

export default async function CartPage() {
  let cart: any = null;
  try {
    // In production, cart ID would come from customer session/cookie
    const carts = await medusa.listOrders?.({ limit: 1 });
    cart = null;
  } catch (err) {
    console.error("Failed to load cart", err);
  }

  return (
    <main className="py-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-ink mb-8">
          Your cart
        </h1>

        {!cart || cart.items.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-8 text-center">
            <p className="text-lg text-muted font-sans mb-6">
              Your cart is empty.
            </p>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 text-sm font-medium text-terracotta hover:underline"
            >
              Browse products →
            </Link>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-border bg-surface p-8">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-4 text-muted font-sans">Item</th>
                    <th className="py-4 text-muted font-sans text-right">Price</th>
                    <th className="py-4 text-muted font-sans text-right">Qty</th>
                    <th className="py-4 text-muted font-sans text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.items.map((item: any) => (
                    <tr key={item.id} className="border-b border-border">
                      <td className="py-4 text-muted font-sans">
                        {item.title || "Product"}
                      </td>
                      <td className="py-4 text-muted font-sans text-right">
                        ₹{(item.unit_price || 0) / 100}
                      </td>
                      <td className="py-4 text-muted font-sans text-right">
                        {item.quantity}
                      </td>
                      <td className="py-4 text-muted font-sans text-right">
                        ₹{(((item.unit_price || 0) * item.quantity) / 100).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-8 flex justify-between">
              <div className="text-lg font-serif font-semibold text-ink">
                Total:{""}
                <span className="ml-2 text-terracotta font-bold">
                  ₹{(cart.total / 100).toLocaleString("en-IN")}
                </span>
              </div>
              <Link
                href="/checkout"
                className="px-6 py-3 bg-terracotta text-white rounded-xl font-semibold hover:bg-terracotta/90 focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 transition-colors"
              >
                Proceed to Checkout
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
