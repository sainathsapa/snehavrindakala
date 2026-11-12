import { getCart } from "@/lib/cart";
import { saveCheckoutDetailsAction } from "@/app/cart/actions";
import { getCurrentCustomer } from "@/lib/auth";
import { CheckoutClient } from "@/components/checkout-client";
import { taxForAmount } from "@/lib/tax-server";
import { getShippingRates } from "@/lib/shipping/shiprocket";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

const PICKUP_POSTCODE = process.env.SHIPROCKET_PICKUP_POSTCODE || "560001";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { saved, error } = await searchParams;
  const [cart, customer] = await Promise.all([getCart(), getCurrentCustomer()]);
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

  const address = cart?.shipping_address ?? cart?.billing_address ?? null;
  const deliverySaved = Boolean(cart?.email && address?.postal_code);

  const customerState = address?.province || undefined;
  const customerPincode = address?.postal_code || undefined;
  const subtotal = Number(cart?.total ?? 0);
  const currency = cart?.currency_code || "inr";
  const tax = subtotal > 0 ? taxForAmount(subtotal, customerState) : null;

  // Quote couriers only once we know where it is going.
  let shippingRates: Awaited<ReturnType<typeof getShippingRates>> = [];
  if (customerPincode) {
    const totalWeight = items.reduce(
      (sum, item) => sum + (item.quantity || 1) * 0.5,
      0
    );
    try {
      shippingRates = await getShippingRates({
        pickup_postcode: PICKUP_POSTCODE,
        delivery_postcode: customerPincode,
        weight: totalWeight || 0.5,
        cod: false,
      });
      // Show at most three options — more than that is a decision, not a help.
      shippingRates = shippingRates.slice(0, 3);
    } catch (err) {
      console.error("Failed to quote shipping rates", err);
    }
  }

  const fullName = [address?.first_name, address?.last_name]
    .filter(Boolean)
    .join(" ");

  const deliveryForm = (
    <>
      {saved && (
        <div
          role="status"
          className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 font-sans"
        >
          Delivery details saved. Choose a delivery speed and pay below.
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 font-sans"
        >
          {error === "save"
            ? "We could not save your details. Please check the address and try again."
            : "Please fill in all required delivery details."}
        </div>
      )}
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
            defaultValue={fullName || undefined}
            className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              defaultValue={cart?.email || customer?.email || undefined}
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
              defaultValue={address?.phone || customer?.phone || undefined}
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
            defaultValue={address?.address_1 || undefined}
            className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
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
              defaultValue={address?.city || undefined}
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
              defaultValue={address?.province || undefined}
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
              title="6-digit PIN code"
              autoComplete="postal-code"
              required
              defaultValue={address?.postal_code || undefined}
              className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
            />
          </div>
        </div>
        <button
          type="submit"
          className={`w-full py-3 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 ${
            deliverySaved
              ? "border border-sindoor text-sindoor hover:bg-sindoor hover:text-rang-paper"
              : "bg-sindoor text-rang-paper hover:bg-sindoor/90"
          }`}
        >
          {deliverySaved ? "Update delivery details" : "Save delivery details"}
        </button>
        {!deliverySaved && (
          <p className="text-xs text-muted-ink font-sans">
            Save your address first — we then quote couriers for your PIN and
            you pay in one step.
          </p>
        )}
      </form>
    </>
  );

  return (
    <main className="py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <nav className="mb-6 text-sm font-sans">
          <Link
            href="/cart"
            className="text-muted-ink hover:text-sindoor transition-colors"
          >
            ← Back to cart
          </Link>
        </nav>
        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-deep-ink mb-8">
          Checkout
        </h1>

        <CheckoutClient
          cartId={cart?.id ?? ""}
          currency={currency}
          subtotal={subtotal}
          lines={items.map((item) => ({
            id: item.id,
            title: item.product_title || item.title || "Product",
            variant_title: item.variant_title,
            quantity: item.quantity,
            total: item.total ?? item.unit_price * item.quantity,
          }))}
          shippingRates={shippingRates}
          tax={tax}
          saved={Boolean(saved)}
          deliverySaved={deliverySaved}
          deliveryForm={deliveryForm}
        />
      </div>
    </main>
  );
}
