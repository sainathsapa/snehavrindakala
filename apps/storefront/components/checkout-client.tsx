"use client";

/**
 * Checkout island.
 *
 * Owns the three pieces of state a server component cannot: which delivery
 * address is in play, which courier the customer picked, and the Razorpay
 * handshake.
 *
 * The journey is a single page with two *steps*, not two page loads:
 *
 *   1. Delivery  — pick a saved address or enter one. The step is complete the
 *                  moment a valid address is submitted; it collapses to a
 *                  one-line summary with an Edit link.
 *   2. Payment   — courier options, the total, and one unmistakable button.
 *
 * Why this shape: the previous version re-rendered the entire route from a
 * server redirect after saving, which threw away everything the buyer had typed
 * and made them hunt for the pay button. Here the address is submitted from the
 * client, the page refreshes the *cart* data via `router.refresh()` while the
 * address draft stays in component state, and the pay step appears in place.
 *
 * Nothing about payment, shipping quotes, address persistence or the signed
 * order token changed — `createSession` still asks the server to price the
 * payment and `complete` still verifies the signature server-side.
 */

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatPrice } from "@/lib/medusa";
import { taxLabel, type TaxBreakdown } from "@/lib/tax";
import { RazorpayPayButton } from "./razorpay-checkout";
import { PromoCode } from "./promo-code";
import {
  AddressForm,
  type SavedAddress,
} from "./address-form";
import type { AddressDraft, AddressField } from "@/lib/location/search";
import { countryByCode } from "@/lib/location";

export interface ShippingRate {
  courier_name: string;
  service_name: string;
  rate: number;
  expected_delivery: string;
}

export interface CheckoutLine {
  id: string;
  title: string;
  variant_title?: string | null;
  quantity: number;
  total: number;
  /** Image URL, when the cart line carries one. */
  thumbnail?: string | null;
}

interface CheckoutClientProps {
  cartId: string;
  currency: string;
  lines: CheckoutLine[];
  subtotal: number;
  shippingRates: ShippingRate[];
  tax: TaxBreakdown | null;
  /** True when a usable delivery address already exists on the cart. */
  addressSaved: boolean;
  /** Amount already taken off by promotion codes, in major units. */
  discount?: number;
  promoCode?: string;
  /** Saved addresses on the customer's account (empty for guests). */
  savedAddresses?: SavedAddress[];
  /** The saved address the cart is currently using, if any. */
  selectedAddressId?: string | null;
  /** Prefill for the form when the cart has no address yet. */
  initialAddress?: Partial<AddressDraft> | null;
  /** A summary of the address on the cart, for the collapsed step. */
  addressSummary?: {
    name: string;
    lines: string[];
  } | null;
  /** Server actions, handed down so the client component stays one island. */
  saveAddress: (
    draft: AddressDraft,
    options: { saveToBook: boolean }
  ) => Promise<{ ok: boolean; error?: string }>;
  saveAddressToBook: (
    draft: AddressDraft,
    makeDefault: boolean
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Whether the buyer is signed in, which enables "save to my addresses". */
  canSaveToAccount?: boolean;
  /** Prefilled email, if known — hidden from the form when present. */
  lockedEmail?: string | null;
  /** Rendered placeholder while a refresh is in flight. */
  children?: ReactNode;
}

const rateKey = (rate: ShippingRate) =>
  `${rate.courier_name}::${rate.service_name}`;

/**
 * The option pre-selected when checkout opens: the least expensive one.
 *
 * Ties break on the printed key so the choice is stable across renders.
 */
function cheapestRateKey(rates: ShippingRate[]): string {
  if (rates.length === 0) return "";
  const cheapest = rates
    .slice()
    .sort((a, b) => a.rate - b.rate || rateKey(a).localeCompare(rateKey(b)))[0];
  return rateKey(cheapest);
}

export function CheckoutClient({
  cartId,
  currency,
  lines,
  subtotal,
  shippingRates,
  tax,
  addressSaved,
  discount = 0,
  promoCode,
  savedAddresses = [],
  selectedAddressId = null,
  initialAddress = null,
  addressSummary = null,
  saveAddress,
  saveAddressToBook,
  canSaveToAccount = false,
  lockedEmail = null,
}: CheckoutClientProps) {
  const router = useRouter();

  /** Step 1 collapses once a valid address exists; Edit re-opens it. */
  const [editingAddress, setEditingAddress] = useState(!addressSaved);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [focusField, setFocusField] = useState<AddressField | null>(null);
  /** The address the cart is using right now, mirrored locally. */
  const [activeAddressId, setActiveAddressId] = useState<string | null>(
    selectedAddressId
  );

  const [selectedRateKey, setSelectedRateKey] = useState(() =>
    cheapestRateKey(shippingRates)
  );
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRate = useMemo(
    () => shippingRates.find((rate) => rateKey(rate) === selectedRateKey),
    [shippingRates, selectedRateKey]
  );

  const shippingAmount = selectedRate?.rate ?? 0;
  // `subtotal` already has the discount taken off, so it is not subtracted
  // again here — doing that would charge the buyer once too often.
  const grandTotal = subtotal + shippingAmount;

  const addressStepComplete = addressSaved && !editingAddress;

  const handleAddressSubmit = useCallback(
    async (draft: AddressDraft, options: { saveToBook: boolean }) => {
      setSavingAddress(true);
      setAddressError(null);

      // Save to the address book first when asked. A failure there must not
      // block the order — the address is still perfectly usable for this cart.
      if (options.saveToBook && canSaveToAccount) {
        const bookResult = await saveAddressToBook(draft, savedAddresses.length === 0);
        if (!bookResult.ok) {
          setAddressError(bookResult.error ?? "We could not save that address to your account.");
        }
      }

      const result = await saveAddress(draft, options);
      setSavingAddress(false);

      if (!result.ok) {
        const message =
          result.error ??
          "We could not save your address. Please check the highlighted fields.";
        setAddressError(message);
        // Send focus back to the form so a screen reader lands on the message.
        setFocusField("full_name");
        return;
      }

      setEditingAddress(false);
      // Re-read the cart on the server so courier quotes and the total reflect
      // the new destination. The address draft stays in state, so nothing is
      // lost if this refresh is slow or fails.
      router.refresh();
    },
    [canSaveToAccount, router, saveAddress, saveAddressToBook, savedAddresses.length]
  );

  const handleSelectSaved = useCallback((address: SavedAddress) => {
    setActiveAddressId(address.id);
    setAddressError(null);
  }, []);

  const handlePaid = async (payment: {
    paymentId: string;
    orderId: string;
    signature: string;
  }) => {
    setCompleting(true);
    setError(null);
    try {
      const res = await fetch("/api/store/checkout/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cart_id: cartId,
          razorpay_payment_id: payment.paymentId,
          razorpay_order_id: payment.orderId,
          razorpay_signature: payment.signature,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          body.error ||
            "Your payment went through but the order could not be created. Please contact us with your payment ID."
        );
        setCompleting(false);
        return;
      }
      // The token is what lets a guest read their own order without a session.
      const params = new URLSearchParams({ paid: "1" });
      if (body.order_token) params.set("t", body.order_token);
      router.push(`/order/${body.order_id}?${params.toString()}`);
    } catch {
      setError(
        "Your payment went through but the order could not be created. Please contact us with your payment ID."
      );
      setCompleting(false);
    }
  };

  const addressCountry = countryByCode(initialAddress?.country_code);

  return (
    <ol className="space-y-6 lg:space-y-8">
      {/* ══ Step 1 — Delivery ════════════════════════════════════════════ */}
      <li>
        <section
          id="delivery"
          aria-labelledby="delivery-heading"
          className="overflow-hidden rounded-lg border border-sand-border/80 bg-surface"
        >
          <header className="flex items-start justify-between gap-4 border-b border-sand-border/60 px-5 py-4 sm:px-7">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-sans text-[11px] font-semibold ${
                  addressStepComplete
                    ? "bg-leaf/15 text-leaf"
                    : "bg-sindoor text-rang-paper"
                }`}
              >
                {addressStepComplete ? "✓" : "1"}
              </span>
              <div>
                <h2
                  id="delivery-heading"
                  className="font-serif text-lg font-semibold leading-tight text-deep-ink sm:text-xl"
                >
                  Delivery address
                </h2>
                <p className="mt-0.5 font-sans text-[13px] text-muted-ink">
                  {addressStepComplete
                    ? "Where your artwork is going."
                    : "Where should we send this?"}
                </p>
              </div>
            </div>

            {addressStepComplete && (
              <button
                type="button"
                onClick={() => setEditingAddress(true)}
                className="shrink-0 rounded-full border border-sand-border px-3 py-1 font-sans text-xs font-medium text-deep-ink transition-colors hover:border-sindoor hover:text-sindoor"
              >
                Edit address
              </button>
            )}
          </header>

          <div className="px-5 py-5 sm:px-7 sm:py-6">
            {addressStepComplete && addressSummary ? (
              <div className="font-sans text-sm leading-relaxed text-deep-ink">
                <p className="font-medium">{addressSummary.name}</p>
                {addressSummary.lines.map((line, index) => (
                  <p key={`${line}-${index}`} className="text-muted-ink">
                    {line}
                  </p>
                ))}
                {addressCountry && (
                  <p className="text-muted-ink">{addressCountry.name}</p>
                )}
              </div>
            ) : (
              <>
                {addressError && (
                  <p
                    role="alert"
                    className="mb-4 rounded-md border border-sindoor/40 bg-sindoor/5 px-3 py-2 font-sans text-sm text-sindoor"
                  >
                    {addressError}
                  </p>
                )}

                <AddressForm
                  initial={initialAddress}
                  saved={savedAddresses}
                  selectedId={activeAddressId}
                  onSubmit={handleAddressSubmit}
                  onSelectSaved={handleSelectSaved}
                  onSaveToBook={
                    canSaveToAccount
                      ? async (draft, makeDefault) => {
                          const result = await saveAddressToBook(draft, makeDefault);
                          if (!result.ok) {
                            setAddressError(result.error ?? "Could not save to your addresses.");
                          }
                        }
                      : undefined
                  }
                  submitting={savingAddress}
                  submitLabel={
                    addressSaved ? "Update delivery address" : "Continue to payment"
                  }
                  submitHint={
                    addressSaved
                      ? "Changing your address re-quotes the courier."
                      : "We quote couriers for your PIN and show every charge before you pay."
                  }
                  canSaveToAccount={canSaveToAccount}
                  focusField={focusField}
                  lockedEmail={lockedEmail}
                />

                {addressSaved && addressSummary && (
                  <button
                    type="button"
                    onClick={() => setEditingAddress(false)}
                    className="mt-4 font-sans text-sm text-muted-ink underline underline-offset-4 hover:text-sindoor"
                  >
                    Keep the current address
                  </button>
                )}
              </>
            )}
          </div>
        </section>
      </li>

      {/* ══ Step 2 — Speed and payment ═══════════════════════════════════ */}
      <li>
        <section
          id="payment"
          aria-labelledby="payment-heading"
          aria-disabled={!addressStepComplete}
          className={`overflow-hidden rounded-lg border bg-surface transition-opacity ${
            addressStepComplete
              ? "border-sand-border/80"
              : "border-sand-border/50 opacity-70"
          }`}
        >
          <header className="flex items-start gap-3 border-b border-sand-border/60 px-5 py-4 sm:px-7">
            <span
              aria-hidden="true"
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-sans text-[11px] font-semibold ${
                addressStepComplete
                  ? "bg-sindoor text-rang-paper"
                  : "bg-sand-border/70 text-muted-ink"
              }`}
            >
              2
            </span>
            <div>
              <h2
                id="payment-heading"
                className="font-serif text-lg font-semibold leading-tight text-deep-ink sm:text-xl"
              >
                Delivery speed and payment
              </h2>
              <p className="mt-0.5 font-sans text-[13px] text-muted-ink">
                {addressStepComplete
                  ? "Everything is included in the total below."
                  : "Add your delivery address to see courier options."}
              </p>
            </div>
          </header>

          <div className="space-y-6 px-5 py-5 sm:px-7 sm:py-6">
            {/* ── Order lines ──────────────────────────────────────── */}
            <ul className="space-y-3 font-sans text-sm">
              {lines.map((line) => (
                <li key={line.id} className="flex items-start gap-3">
                  {line.thumbnail ? (
                    // A thumbnail is the fastest way to confirm "this is the
                    // right painting" at the moment of paying.
                    <img
                      src={line.thumbnail}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-sm border border-sand-border/70 object-cover"
                    />
                  ) : null}
                  <span className="min-w-0 flex-1 text-deep-ink">
                    <span className="block leading-snug">{line.title}</span>
                    {line.variant_title ? (
                      <span className="block text-xs text-muted-ink">
                        {line.variant_title}
                      </span>
                    ) : null}
                    <span className="block text-xs text-muted-ink">
                      Quantity {line.quantity}
                    </span>
                  </span>
                  <span className="whitespace-nowrap text-deep-ink">
                    {formatPrice(line.total, currency)}
                  </span>
                </li>
              ))}
            </ul>

            {/* ── Totals ───────────────────────────────────────────── */}
            <dl className="space-y-2 border-t border-sand-border/60 pt-4 font-sans text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-ink">Subtotal</dt>
                <dd className="text-deep-ink">{formatPrice(subtotal + discount, currency)}</dd>
              </div>

              {discount > 0 && (
                <div className="flex justify-between gap-4 text-leaf">
                  <dt>
                    Discount
                    {promoCode ? (
                      <span className="ml-1 text-xs text-muted-ink">({promoCode})</span>
                    ) : null}
                  </dt>
                  <dd className="whitespace-nowrap font-medium">
                    −{formatPrice(discount, currency)}
                  </dd>
                </div>
              )}

              <div className="flex justify-between gap-4">
                <dt className="text-muted-ink">Shipping</dt>
                <dd className="text-deep-ink">
                  {!addressStepComplete ? (
                    <span className="text-muted-ink">Calculated next</span>
                  ) : shippingRates.length === 0 ? (
                    <span className="text-muted-ink">Confirmed by our team</span>
                  ) : shippingAmount === 0 ? (
                    <span className="font-medium text-leaf">Free</span>
                  ) : (
                    formatPrice(shippingAmount, currency)
                  )}
                </dd>
              </div>
            </dl>

            {/* ── Promo ────────────────────────────────────────────── */}
            <PromoCode applied={promoCode ? [promoCode] : []} />

            {/* ── Courier choice ───────────────────────────────────── */}
            {addressStepComplete && shippingRates.length > 0 && (
              <fieldset>
                <legend className="mb-3 font-sans text-[13px] font-medium text-deep-ink">
                  Delivery speed
                </legend>
                <div className="space-y-2">
                  {shippingRates.map((rate) => {
                    const key = rateKey(rate);
                    const checked = key === selectedRateKey;
                    return (
                      <label
                        key={key}
                        className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                          checked
                            ? "border-sindoor bg-sindoor/5"
                            : "border-sand-border hover:border-sindoor/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="shipping_rate"
                          value={key}
                          checked={checked}
                          onChange={() => setSelectedRateKey(key)}
                          className="mt-1 accent-sindoor focus:ring-sindoor"
                        />
                        <span className="flex-1 font-sans text-sm">
                          <span className="block font-medium text-deep-ink">
                            {rate.courier_name}
                          </span>
                          <span className="block text-xs text-muted-ink">
                            {rate.service_name}
                            {rate.expected_delivery ? ` · ${rate.expected_delivery}` : ""}
                          </span>
                        </span>
                        <span className="whitespace-nowrap font-sans text-sm font-medium text-deep-ink">
                          {rate.rate === 0 ? "Free" : formatPrice(rate.rate, currency)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {addressStepComplete && shippingRates.length === 0 && (
              <p className="rounded-md bg-rang-paper px-3 py-2.5 font-sans text-xs text-muted-ink">
                We could not quote couriers for this address. Our team will confirm
                shipping before dispatch, and you will not be charged more than the
                total shown.
              </p>
            )}

            {/* ── Total ────────────────────────────────────────────── */}
            <div className="flex items-baseline justify-between border-t border-sand-border/60 pt-4">
              <span className="font-sans text-sm font-medium uppercase tracking-[0.12em] text-muted-ink">
                Total
              </span>
              <span className="font-serif text-2xl font-semibold text-deep-ink sm:text-3xl">
                {formatPrice(grandTotal, currency)}
              </span>
            </div>

            {tax && (
              <p className="font-sans text-xs leading-relaxed text-muted-ink">
                Includes {taxLabel(tax)} ({formatPrice(tax.total_tax, currency)}).
                {currency.toUpperCase() === "INR" ? " Prices are GST-inclusive." : ""}
              </p>
            )}

            {/* Duties cannot be calculated reliably per destination, so they are
                disclosed rather than guessed. */}
            {currency.toUpperCase() !== "INR" && (
              <p className="font-sans text-xs leading-relaxed text-muted-ink">
                Shipping internationally. Import duties or local taxes may be charged
                by your customs authority on delivery, and are not included in this
                total.
              </p>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-md border border-sindoor/40 bg-sindoor/5 px-3 py-2 font-sans text-sm text-sindoor"
              >
                {error}
              </p>
            )}

            {/* ── The single primary action ────────────────────────── */}
            {addressStepComplete ? (
              <div>
                <RazorpayPayButton
                  amount={grandTotal}
                  currency={currency}
                  name="SnehaVrinda Kala"
                  description={`Order · ${formatPrice(grandTotal, currency)}`}
                  onSuccess={handlePaid}
                  onError={(message) => setError(message)}
                  createSession={async () => {
                    const res = await fetch("/api/store/checkout/payment-session", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        cart_id: cartId,
                        shipping_rate: selectedRate,
                      }),
                    });
                    const body = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      throw new Error(body.error || "We could not start the payment.");
                    }
                    return {
                      orderId: body.razorpay_order_id,
                      amount: body.amount,
                      currency: body.currency,
                    };
                  }}
                />
                {completing && (
                  <p className="mt-3 text-center font-sans text-sm text-muted-ink">
                    Completing your order…
                  </p>
                )}
                <p className="mt-3 text-center font-sans text-xs text-muted-ink">
                  Secure payment by Razorpay · UPI, cards &amp; net banking
                </p>
              </div>
            ) : (
              <Link
                href="#delivery"
                className="block w-full rounded-full bg-kumkum px-6 py-3.5 text-center font-sans text-sm font-semibold text-rang-paper transition-colors hover:bg-sindoor"
              >
                Add your delivery address
              </Link>
            )}
          </div>
        </section>
      </li>
    </ol>
  );
}
