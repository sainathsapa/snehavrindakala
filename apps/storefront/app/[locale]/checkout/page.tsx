import { getCart } from "@/lib/cart";
import { getCurrentCustomer, getAuthToken } from "@/lib/auth";
import { medusa } from "@/lib/medusa";
import { CheckoutClient } from "@/components/checkout-client";
import { TrustStrip } from "@/components/trust-strip";
import type { SavedAddress } from "@/components/address-form";
import { taxForAmount } from "@/lib/tax-server";
import { checkoutIsPossible } from "@/lib/config-status";
import { getShippingRates } from "@/lib/shipping/shiprocket";
import { countryByCode } from "@/lib/location";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { getPreferredCurrency, SHIPPING_COUNTRIES } from "@/lib/currency";
import {
  saveCheckoutAddressAction,
  saveAddressToBookAction,
} from "./address-actions";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  // The tab title is the first thing a Hindi reader sees; it must match the page.
  const t = await getTranslations("checkout");
  return { title: t("title"), robots: { index: false, follow: false } };
}

const PICKUP_POSTCODE = process.env.SHIPROCKET_PICKUP_POSTCODE || "560001";

/**
 * Checkout.
 *
 * Two steps on one page: delivery, then speed and payment. The page's job is
 * now only to gather facts — cart, addresses, courier quotes — and hand them to
 * one client island that owns the journey. It deliberately does *not* own the
 * address form's state: that lives on the client so a failed validation never
 * costs the customer their input (see `components/address-form.tsx`).
 */
export default async function CheckoutPage() {
  // Declared before any early return, so the empty-cart branch can translate too.
  const t = await getTranslations("checkout");
  const [cart, customer] = await Promise.all([getCart(), getCurrentCustomer()]);
  const items = cart?.items ?? [];

  if (items.length === 0) {
    return (
      <main className="py-10">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <h1 className="mb-8 font-serif text-3xl font-semibold text-deep-ink md:text-4xl">
            {t("title")}
          </h1>
          <div className="rounded-lg border border-sand-border bg-surface p-10 text-center">
            <p className="mb-6 font-sans text-lg text-muted-ink">
              {t("emptyCart")}
            </p>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 font-sans text-sm font-medium text-kumkum hover:underline"
            >
              {t("browseArtworks")} →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const activeCurrency = await getPreferredCurrency();
  const address = cart?.shipping_address ?? null;

  // The buyer's address book. Loaded once here so the client island can offer
  // "use this one" without a round trip per click.
  const token = await getAuthToken().catch(() => null);
  let savedAddresses: SavedAddress[] = [];
  if (token) {
    try {
      const list = await medusa.listCustomerAddresses(token);
      savedAddresses = list.map((entry: any) => ({
        id: entry.id,
        full_name: [entry.first_name, entry.last_name].filter(Boolean).join(" "),
        email: cart?.email ?? customer?.email ?? "",
        phone: entry.phone ?? "",
        country_code: entry.country_code ?? "",
        postal_code: entry.postal_code ?? "",
        province: entry.province ?? "",
        city: entry.city ?? "",
        address_1: entry.address_1 ?? "",
        address_2: entry.address_2 ?? "",
        is_default: Boolean(entry.is_default_shipping),
      }));
      // Default address first — that is the one the customer chose to be default.
      savedAddresses.sort((a, b) => Number(b.is_default) - Number(a.is_default));
    } catch {
      // No session or no addresses: the form is simply empty.
    }
  }

  const addressSaved = Boolean(address?.postal_code && address?.address_1);

  // Prefill for the form. A saved default beats an empty form, and the cart's
  // own address beats both — it is the one this order was started with.
  const preferredSaved =
    savedAddresses.find((entry) => entry.is_default) ?? savedAddresses[0] ?? null;

  const initialAddress = addressSaved
    ? {
        full_name: [address.first_name, address.last_name].filter(Boolean).join(" "),
        email: cart?.email ?? customer?.email ?? "",
        phone: address.phone ?? customer?.phone ?? "",
        country_code: (address as { country_code?: string }).country_code ?? "in",
        postal_code: address.postal_code ?? "",
        province: address.province ?? "",
        city: address.city ?? "",
        address_1: address.address_1 ?? "",
        address_2: (address as { address_2?: string }).address_2 ?? "",
      }
    : preferredSaved
      ? {
          full_name: preferredSaved.full_name,
          email: cart?.email ?? customer?.email ?? "",
          phone: preferredSaved.phone,
          country_code: preferredSaved.country_code,
          postal_code: preferredSaved.postal_code,
          province: preferredSaved.province,
          city: preferredSaved.city,
          address_1: preferredSaved.address_1,
          address_2: preferredSaved.address_2,
        }
      : {
          full_name: customer ? [customer.first_name, customer.last_name].filter(Boolean).join(" ") : "",
          email: cart?.email ?? customer?.email ?? "",
          phone: customer?.phone ?? "",
          country_code:
            SHIPPING_COUNTRIES.find((c) => c.currency === activeCurrency)?.code ?? "in",
          postal_code: "",
          province: "",
          city: "",
          address_1: "",
          address_2: "",
        };

  // Courier quotes depend on the destination and on how much is going there.
  const deliveryPostcode = address?.postal_code || preferredSaved?.postal_code || "";
  const customerState = address?.province || preferredSaved?.province || undefined;

  let shippingRates: Awaited<ReturnType<typeof getShippingRates>> = [];
  if (addressSaved && deliveryPostcode) {
    const totalWeight = items.reduce(
      (sum, item) => sum + (item.quantity || 1) * 0.5,
      0
    );
    try {
      shippingRates = await getShippingRates({
        pickup_postcode: PICKUP_POSTCODE,
        delivery_postcode: deliveryPostcode,
        weight: totalWeight || 0.5,
        cod: false,
      });
      // Show at most three options — more than that is a decision, not a help.
      shippingRates = shippingRates.slice(0, 3);
    } catch (err) {
      console.error("Failed to quote shipping rates", err);
    }
  }

  const subtotal = Number(cart?.total ?? 0);
  const currency = cart?.currency_code || activeCurrency;
  const tax = subtotal > 0 ? taxForAmount(subtotal, customerState) : null;

  const addressSummary = addressSaved
    ? {
        name: [address?.first_name, address?.last_name].filter(Boolean).join(" "),
        lines: [
          [address?.address_1, (address as { address_2?: string })?.address_2]
            .filter(Boolean)
            .join(", "),
          [address?.city, address?.province, address?.postal_code]
            .filter(Boolean)
            .join(", "),
          address?.phone ?? "",
        ].filter(Boolean),
      }
    : null;

  return (
    <main className="py-10 sm:py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <nav className="mb-6 font-sans text-sm">
          <Link
            href="/cart"
            className="text-muted-ink transition-colors hover:text-kumkum"
          >
            ← {t("backToCart")}
          </Link>
        </nav>

        <header className="mb-10 border-b border-sand-border/70 pb-6">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.24em] text-terracotta">
            {t("secureCheckoutEyebrow")}
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-deep-ink sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 max-w-xl font-sans text-sm leading-relaxed text-muted-ink">
            {t("checkoutIntro")}
          </p>
        </header>

        <CheckoutClient
          cartId={cart?.id ?? ""}
          currency={currency}
          giftNote={(cart?.metadata?.gift_note as string) || ""}
          giftWrap={cart?.metadata?.gift_wrap === "true"}
          paymentsAvailable={checkoutIsPossible()}
          subtotal={subtotal}
          lines={(items ?? []).map((item) => ({
            id: item.id,
            title: item.product_title || item.title || "Product",
            variant_title: item.variant_title,
            quantity: item.quantity,
            total: item.total ?? (item.unit_price ?? 0) * item.quantity,
            thumbnail:
              (item as { thumbnail?: string | null }).thumbnail ?? null,
          }))}
          shippingRates={shippingRates}
          tax={tax}
          discount={Number(cart?.discount_total ?? 0)}
          promoCode={(cart?.promotions ?? [])
            .map((promotion) => promotion.code)
            .filter((code): code is string => Boolean(code))
            .join(", ")}
          addressSaved={addressSaved}
          addressSummary={addressSummary}
          savedAddresses={savedAddresses}
          initialAddress={initialAddress}
          canSaveToAccount={Boolean(token)}
          lockedEmail={customer?.email ?? null}
          saveAddress={saveCheckoutAddressAction}
          saveAddressToBook={saveAddressToBookAction}
        />

        {/* Reassurance sits below the journey rather than beside it: the right
            column belongs to the totals, which have to stay visible while the
            buyer types. */}
        <section className="mt-14 border-t border-sand-border/70 pt-8">
          <div className="grid gap-6 sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-10">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-terracotta">
              {t("reassuranceEyebrow")}
            </p>
            <div>
              <TrustStrip compact />
              <p className="mt-4 max-w-2xl font-sans text-xs leading-relaxed text-muted-ink">
                {countryByCode(initialAddress.country_code)?.name
                  ? `${t("deliveringTo", {
                      country: countryByCode(initialAddress.country_code)!.name,
                    })} `
                  : ""}
                {t("reassuranceBody")}
              </p>
              <Link
                href="/policies/shipping"
                className="mt-2 inline-block font-sans text-xs font-medium text-terracotta underline-offset-4 hover:underline"
              >
                {t("shippingReturns")}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
