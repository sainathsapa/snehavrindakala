import { getCart } from "@/lib/cart";
import { saveCheckoutDetailsAction } from "@/app/[locale]/cart/actions";
import { getCurrentCustomer, getAuthToken } from "@/lib/auth";
import { medusa } from "@/lib/medusa";
import { CheckoutClient } from "@/components/checkout-client";
import { PincodeAutofill } from "@/components/pincode-autofill";
import { MandalaMark } from "@/components/grounds";
import { taxForAmount } from "@/lib/tax-server";
import { getShippingRates } from "@/lib/shipping/shiprocket";
import Link from "next/link";
import {
  getPreferredCurrency,
  SHIPPING_COUNTRIES,
} from "@/lib/currency";

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
  const activeCurrency = await getPreferredCurrency();

  // Prefill from the saved address book when the cart has no address yet.
  // This is the whole point of saving an address: a returning buyer should not
  // retype it, and the default shipping address is the one they chose as
  // "default" precisely so it would be offered here.
  let savedAddress: any = null;
  if (!address) {
    const authToken = await getAuthToken();
    if (authToken) {
      try {
        const list = await medusa.listCustomerAddresses(authToken);
        savedAddress =
          list.find((entry: any) => entry.is_default_shipping) ?? list[0] ?? null;
      } catch {
        // No session or no addresses: the form is simply empty, as before.
      }
    }
  }

  // Address details count as given when the cart has an address, or when we
  // can prefill one from the buyer's address book. Previously only the cart
  // counted, so a returning buyer with a default address still had to submit
  // an address form they had already filled in, wait for a round trip, and only
  // then see a courier quote and a pay button.
  const deliverySaved = Boolean(
    (cart?.email || savedAddress) &&
      (address?.postal_code || savedAddress?.postal_code)
  );

  const customerState =
    address?.province || savedAddress?.province || undefined;
  const customerPincode =
    address?.postal_code || savedAddress?.postal_code || undefined;
  const subtotal = Number(cart?.total ?? 0);
  const currency = cart?.currency_code || activeCurrency;
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

  const prefill = address ?? savedAddress;
  const prefillName = [prefill?.first_name, prefill?.last_name]
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
            : error === "billing"
              ? "Please complete the billing address, or untick \"Use a different billing address\"."
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
            defaultValue={prefillName || undefined}
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
              defaultValue={prefill?.phone || customer?.phone || undefined}
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
            defaultValue={prefill?.address_1 || undefined}
            className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <PincodeAutofill initialPin={prefill?.postal_code || undefined} />
          <div>
            <label
              htmlFor="city"
              className="block text-sm font-medium text-deep-ink mb-1"
            >
              City / District
            </label>
            <input
              id="city"
              name="city"
              type="text"
              autoComplete="address-level2"
              required
              defaultValue={prefill?.city || undefined}
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
              defaultValue={prefill?.province || undefined}
              className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
            />
          </div>
          <div>
            <label
              htmlFor="country_code"
              className="block text-sm font-medium text-deep-ink mb-1"
            >
              Country
            </label>
            <select
              id="country_code"
              name="country_code"
              required
              autoComplete="country"
              defaultValue={
                (address as { country_code?: string } | null)?.country_code?.toLowerCase() ||
                // Default to a country that matches the chosen currency, so a
                // visitor browsing in pounds is not asked to enter an Indian
                // address. The operator precedence here matters: the previous
                // version left the `|| "in"` outside the ternary, so every
                // currency fell back to India.
                SHIPPING_COUNTRIES.find((c) => c.currency === activeCurrency)
                  ?.code ||
                "in"
              }
              className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
            >
              {SHIPPING_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Billing separate from delivery.

            Collapsed by default: most buyers pay from the same address they
            ship to, and showing six extra fields to everyone adds friction for
            the common case. The checkbox expands them, and the server rejects a
            half-filled billing address rather than guessing. */}
        <details className="rounded-md border border-sand-border bg-surface/60 px-4 py-3">
          <summary className="cursor-pointer font-sans text-sm font-medium text-deep-ink">
            Billing address differs from delivery address
          </summary>
          <label className="mt-3 flex items-center gap-2 font-sans text-sm text-muted-ink">
            <input
              type="checkbox"
              name="billing_differs"
              className="h-4 w-4 cursor-pointer accent-sindoor"
            />
            Use a different billing address
          </label>

          <div className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="billing_name"
                className="mb-1 block text-sm font-medium text-deep-ink"
              >
                Name on billing address
              </label>
              <input
                id="billing_name"
                name="billing_name"
                type="text"
                autoComplete="off"
                className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
              />
            </div>
            <div>
              <label
                htmlFor="billing_address"
                className="mb-1 block text-sm font-medium text-deep-ink"
              >
                Billing address
              </label>
              <textarea
                id="billing_address"
                name="billing_address"
                rows={2}
                autoComplete="off"
                className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
              />
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <label htmlFor="billing_city" className="mb-1 block text-sm font-medium text-deep-ink">
                  City
                </label>
                <input
                  id="billing_city"
                  name="billing_city"
                  type="text"
                  autoComplete="off"
                  className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                />
              </div>
              <div>
                <label htmlFor="billing_state" className="mb-1 block text-sm font-medium text-deep-ink">
                  State
                </label>
                <input
                  id="billing_state"
                  name="billing_state"
                  type="text"
                  autoComplete="off"
                  className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                />
              </div>
              <div>
                <label htmlFor="billing_postal_code" className="mb-1 block text-sm font-medium text-deep-ink">
                  Postal code
                </label>
                <input
                  id="billing_postal_code"
                  name="billing_postal_code"
                  type="text"
                  autoComplete="off"
                  className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                />
              </div>
              <div>
                <label htmlFor="billing_country_code" className="mb-1 block text-sm font-medium text-deep-ink">
                  Country
                </label>
                <select
                  id="billing_country_code"
                  name="billing_country_code"
                  autoComplete="off"
                  className="w-full rounded-md border border-sand-border bg-surface px-2 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                >
                  {SHIPPING_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </details>

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
    <main className="relative overflow-hidden py-10">
      <MandalaMark className="absolute -right-14 -top-10 hidden h-64 w-64 lg:block" />
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
          discount={Number(cart?.discount_total ?? 0)}
          promoCode={(cart?.promotions ?? [])
            .map((promotion) => promotion.code)
            .filter((code): code is string => Boolean(code))
            .join(", ")}
          saved={Boolean(saved)}
          deliverySaved={deliverySaved}
          deliveryForm={deliveryForm}
        />
      </div>
    </main>
  );
}
