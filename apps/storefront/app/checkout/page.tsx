import { getCart } from "@/lib/cart";
import { formatPrice } from "@/lib/medusa";
import { saveCheckoutDetailsAction } from "@/app/cart/actions";
import Link from "next/link";
import { CheckoutPayment } from "@/components/checkout-payment";

export const dynamic = "force-dynamic";

const contactEmail =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hello@snehavrindakala.example";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const cart = await getCart();
  const items = cart?.items ?? [];

  if (items.length === 0) {
    return (
      <main className="py-10">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl md:text-4xl font-serif font-semibold text-deep-ink mb-8">
            Checkout
          </h1>
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
        </div>
      </main>
    );
  }

  return (
    <main className="py-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-deep-ink mb-8">
          Checkout
        </h1>

        {saved && (
          <CheckoutPayment
            cartTotal={cart?.total ?? 0}
            currency={cart?.currency_code || "inr"}
            cartId={cart?.id ?? ""}
          />
        )}

        {error && (
          <div
            role="alert"
            className="mb-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 font-sans"
          >
            Please fill in all required delivery details and try again.
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8">
          <section className="rounded-xl border border-sand-border bg-surface p-8">
            <h2 className="text-xl font-serif font-semibold text-deep-ink mb-6">
              Order Summary
            </h2>
            <ul className="space-y-4 text-muted-ink font-sans">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex justify-between gap-4 border-b border-sand-border pb-3"
                >
                  <span>
                    {item.product_title || item.title || "Product"}{" "}
                    <span className="text-xs">× {item.quantity}</span>
                  </span>
                  <span className="whitespace-nowrap">
                    {formatPrice(
                      item.total ?? item.unit_price * item.quantity,
                      cart?.currency_code
                    )}
                  </span>
                </li>
              ))}
              <li className="flex justify-between font-serif font-semibold text-deep-ink pt-2">
                <span>Total</span>
                <span>{formatPrice(cart?.total ?? 0, cart?.currency_code)}</span>
              </li>
            </ul>
          </section>

          <section className="rounded-xl border border-sand-border bg-surface p-8">
            <h2 className="text-xl font-serif font-semibold text-deep-ink mb-6">
              Delivery Details
            </h2>
            <form action={saveCheckoutDetailsAction} className="space-y-4">
              <div>
                <label
                  htmlFor="full_name"
                  className="block text-sm font-medium text-deep-ink mb-1"
                >
                  Full name
                </label>
                <input
                  id="full_name"
                  name="full_name"
                  type="text"
                  autoComplete="name"
                  required
                  className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-deep-ink mb-1"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                  />
                </div>
                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-medium text-deep-ink mb-1"
                  >
                    Phone
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    required
                    className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="address"
                  className="block text-sm font-medium text-deep-ink mb-1"
                >
                  Delivery address
                </label>
                <textarea
                  id="address"
                  name="address"
                  rows={3}
                  autoComplete="street-address"
                  required
                  className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="city"
                    className="block text-sm font-medium text-deep-ink mb-1"
                  >
                    City
                  </label>
                  <input
                    id="city"
                    name="city"
                    type="text"
                    autoComplete="address-level2"
                    required
                    className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                  />
                </div>
                <div>
                  <label
                    htmlFor="state"
                    className="block text-sm font-medium text-deep-ink mb-1"
                  >
                    State
                  </label>
                  <input
                    id="state"
                    name="state"
                    type="text"
                    autoComplete="address-level1"
                    required
                    className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                  />
                </div>
                <div>
                  <label
                    htmlFor="postal_code"
                    className="block text-sm font-medium text-deep-ink mb-1"
                  >
                    PIN code
                  </label>
                  <input
                    id="postal_code"
                    name="postal_code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    autoComplete="postal-code"
                    required
                    className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-sindoor text-rang-paper rounded-md font-medium hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 transition-colors"
              >
                Save delivery details
              </button>
              <p className="text-xs text-muted-ink font-sans">
                Online payment is not enabled in this environment. Your cart and
                delivery details are saved on the backend; our team will contact
                you to complete payment.
              </p>
            </form>
          </section>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/cart"
            className="text-sm text-muted-ink font-sans hover:text-sindoor transition-colors"
          >
            ← Back to cart
          </Link>
        </div>
      </div>
    </main>
  );
}
