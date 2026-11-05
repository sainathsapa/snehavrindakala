import Link from "next/link";

export default function CheckoutPage() {
  return (
    <main className="py-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-ink mb-8">
          Checkout
        </h1>

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="col-span-1 lg:col-span-2 rounded-xl border border-border bg-surface p-8">
            <h2 className="text-xl font-serif font-semibold text-ink mb-6">
              Order Summary
            </h2>
            <div className="space-y-4 text-muted font-sans">
              <div className="flex justify-between border-b border-border pb-2">
                <span>Subtotal</span>
                <span>₹0.00</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span>Shipping</span>
                <span>Calculated at checkout</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span>Tax</span>
                <span>₹0.00</span>
              </div>
              <div className="flex justify-between font-serif font-semibold text-ink pt-2">
                <span>Total</span>
                <span>₹0.00</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-8">
            <h2 className="text-xl font-serif font-semibold text-ink mb-6">
              Customer Details
            </h2>
            <form className="space-y-4" noValidate>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">
                    Full name
                  </label>
                  <input
                    type="text"
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-terracotta"
                    placeholder="Full name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-terracotta"
                    placeholder="name@example.com"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-terracotta"
                  placeholder="+91 XXXXX XXXXX"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1">
                  Delivery address
                </label>
                <textarea
                  rows={3}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-terracotta"
                  placeholder="Street, area, city, PIN code"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1">
                  Pincode
                </label>
                <input
                  type="text"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-terracotta"
                  placeholder="XXXXXX"
                  required
                />
              </div>
            </form>
          </div>
        </div>

        <div className="mt-8 bg-paper/50 rounded-xl p-8">
          <h3 className="text-lg font-serif font-semibold text-ink mb-4">
            Payment
          </h3>
          <p className="text-sm text-muted font-sans mb-6">
            Payments are processed securely through Razorpay (UPI, cards, net
            banking). Your order is confirmed only after payment is verified
            server-side.
          </p>
          <button
            className="w-full py-4 bg-terracotta text-white rounded-xl font-semibold hover:bg-terracotta/90 focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 transition-colors"
          >
            Continue to Payment
          </button>
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/cart"
            className="text-sm text-muted font-sans hover:text-terracotta transition-colors"
          >
            ← Back to cart
          </Link>
        </div>
      </div>
    </main>
  );
}
