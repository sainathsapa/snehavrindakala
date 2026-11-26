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

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { formatPrice } from "@/lib/medusa";
import { taxLabel, type TaxBreakdown } from "@/lib/tax";
import { RazorpayPayButton } from "./razorpay-checkout";
import { PaymentProcessing } from "./checkout/payment-processing";
import { PromoCode } from "./promo-code";
import {
  AddressForm,
  type SavedAddress,
} from "./address-form";
import type {
  AddressDraft,
  AddressField,
  BillingAddress,
} from "@/lib/location/search";
import {
  cheapestRateKey,
  resolveSelectedRate,
} from "@/lib/shipping/select-rate";
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
    options: { saveToBook: boolean; billing?: BillingAddress | null }
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
  /** A note already saved on the cart, so a refresh does not lose it. */
  giftNote?: string;
  giftWrap?: boolean;
  /** False when no payment provider is configured; hides the pay button. */
  paymentsAvailable?: boolean;
}

const rateKey = (rate: ShippingRate) =>
  `${rate.courier_name}::${rate.service_name}`;

/**
 * The option pre-selected when checkout opens: the least expensive one.
 *
 * The rule lives in `lib/shipping/select-rate.ts` so it can be tested without a
 * browser — see the comment there for the bug this encodes.
 */

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
  giftNote: savedGiftNote = "",
  giftWrap: savedGiftWrap = false,
  paymentsAvailable = true,
}: CheckoutClientProps) {
  const router = useRouter();
  const t = useTranslations("checkout");

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

  /**
   * Courier quotes only exist once a delivery address is on the cart, so on the
   * first render `shippingRates` is empty and the initial state above settles on
   * "". The quotes then arrive after the address is saved and the page
   * refreshes — but a `useState` initialiser never runs again, so no courier was
   * ever selected: every radio rendered unchecked and shipping showed "Free"
   * beside three quotes of ₹99–₹118, with the total silently too low.
   *
   * This adopts the cheapest option whenever the available set changes and the
   * current choice is not among them. It never overrides a choice the buyer
   * made, because that key is still present in the new set.
   */
  useEffect(() => {
    if (shippingRates.length === 0) return;
    setSelectedRateKey((current) => resolveSelectedRate(shippingRates, current));
  }, [shippingRates]);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gift note. Saved onto the cart rather than kept in state, so a refresh at
  // the payment step does not lose words someone took time over.
  const [giftNote, setGiftNote] = useState(savedGiftNote);
  const [giftWrap, setGiftWrap] = useState(savedGiftWrap);
  const [giftState, setGiftState] = useState<"idle" | "saving" | "saved" | "failed">(
    "idle"
  );

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
    async (
      draft: AddressDraft,
      options: { saveToBook: boolean; billing?: BillingAddress | null }
    ) => {
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
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start lg:gap-14">
      {/* ══ Left — the two steps, separated by a hairline ══════════ */}
      <ol className="lg:divide-y lg:divide-sand-border/70">
        {/* ── Step 1 — Delivery ──────────────────────────────────── */}
        <li className="pb-7 lg:pb-10 lg:pr-4">
          <section id="delivery" aria-labelledby="delivery-heading">
            <header className="mb-6 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-sans text-[11px] font-semibold ${
                    addressStepComplete
                      ? "border-leaf/50 bg-leaf/10 text-leaf"
                      : "border-kumkum/50 bg-kumkum/5 text-kumkum"
                  }`}
                >
                  {addressStepComplete ? "✓" : "1"}
                </span>
                <div>
                  <h2
                    id="delivery-heading"
                    className="font-serif text-xl font-semibold tracking-tight text-deep-ink"
                  >
                    {t("stepDelivery")}
                  </h2>
                  <p className="mt-0.5 font-sans text-[13px] text-muted-ink">
                    {addressStepComplete ? t("step1Hint") : t("step1Intro")}
                  </p>
                </div>
              </div>

              {addressStepComplete && (
                <button
                  type="button"
                  onClick={() => setEditingAddress(true)}
                  className="shrink-0 font-sans text-xs font-medium text-terracotta underline underline-offset-4 hover:text-kumkum"
                >
                  {t("editAddress")}
                </button>
              )}
            </header>

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
                    className="mb-5 border-l-2 border-sindoor bg-sindoor/5 px-3 py-2 font-sans text-sm text-sindoor"
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
                    addressSaved ? t("updateAddress") : t("saveAndContinue")
                  }
                  submitHint={
                    addressSaved ? t("hintChangeAddress") : t("hintNewAddress")
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
                    {t("keepCurrent")}
                  </button>
                )}
              </>
            )}
          </section>
        </li>

        {/* ── Step 2 — Speed and payment ─────────────────────────── */}
        <li className="border-t border-sand-border/70 pt-7 lg:border-t-0 lg:pt-10 lg:pr-4">
          <section id="payment" aria-labelledby="payment-heading">
            <header className="mb-6 flex items-start gap-3">
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-sans text-[11px] font-semibold ${
                  addressStepComplete
                    ? "border-kumkum/50 bg-kumkum/5 text-kumkum"
                    : "border-sand-border/80 text-muted-ink"
                }`}
              >
                2
              </span>
              <div>
                <h2
                  id="payment-heading"
                  className="font-serif text-xl font-semibold tracking-tight text-deep-ink"
                >
                  {t("stepPayment")}
                </h2>
                <p className="mt-0.5 font-sans text-[13px] text-muted-ink">
                  {addressStepComplete ? t("step2Hint") : t("step2Locked")}
                </p>
              </div>
            </header>

            <div className="space-y-6">
              {/* ── Courier choice ────────────────────────────────── */}
              {addressStepComplete && shippingRates.length > 0 && (
                <fieldset>
                  <legend className="mb-3 font-sans text-[13px] font-medium uppercase tracking-[0.14em] text-deep-ink">
                    {t("deliverySpeed")}
                  </legend>
                  <div className="space-y-2">
                    {shippingRates.map((rate) => {
                      const key = rateKey(rate);
                      const checked = key === selectedRateKey;
                      return (
                        <label
                          key={key}
                          className={`flex cursor-pointer items-start gap-3 rounded-sm border bg-surface/60 px-4 py-3 transition-colors ${
                            checked
                              ? "border-kumkum/60 bg-kumkum/[0.05]"
                              : "border-sand-border hover:border-kumkum/40"
                          }`}
                        >
                          <input
                            type="radio"
                            name="shipping_rate"
                            value={key}
                            checked={checked}
                            onChange={() => setSelectedRateKey(key)}
                            className="mt-1 accent-kumkum focus:ring-kumkum"
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
                            {rate.rate === 0 ? t("free") : formatPrice(rate.rate, currency)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {addressStepComplete && shippingRates.length === 0 && (
                <p className="bg-rang-paper px-3 py-2.5 font-sans text-xs leading-relaxed text-muted-ink">
                  {t("quoteFailed")}
                </p>
              )}

              {/* ── Order lines — a confirmation before paying ───── */}
              <div>
                <ul className="space-y-3 font-sans text-sm">
                  {lines.map((line) => (
                    <li key={line.id} className="flex items-start gap-3">
                      {line.thumbnail ? (
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
                          {t("quantity")} {line.quantity}
                        </span>
                      </span>
                      <span className="whitespace-nowrap text-deep-ink">
                        {formatPrice(line.total, currency)}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 border-t border-sand-border/60 pt-4">
                  <PromoCode applied={promoCode ? [promoCode] : []} />
                </div>

                {error && (
                  <p
                    role="alert"
                    className="mt-4 border-l-2 border-sindoor bg-sindoor/5 px-3 py-2 font-sans text-sm text-sindoor"
                  >
                    {error}
                  </p>
                )}

                {/* A note for whoever opens the box. Closed by default so it
                    never competes with the payment button, and saved onto the
                    cart so it survives a refresh at this step. */}
                <details className="mt-5 border-t border-sand-border/60 pt-4">
                  <summary className="cursor-pointer font-sans text-sm text-terracotta underline-offset-4 hover:text-kumkum hover:underline">
                    {t("giftHeading")}
                  </summary>
                  <div className="mt-3 grid gap-3">
                    <label className="grid gap-1">
                      <span className="font-sans text-[10px] uppercase tracking-[0.18em] text-muted-ink/70">
                        {t("giftNoteLabel")}
                      </span>
                      <textarea
                        rows={3}
                        maxLength={300}
                        value={giftNote}
                        onChange={(event) => setGiftNote(event.target.value)}
                        placeholder={t("giftPlaceholder")}
                        className="resize-y border-b border-sand-border bg-transparent py-2 font-sans text-sm text-deep-ink focus:border-terracotta focus:outline-none"
                      />
                    </label>
                    <label className="flex items-start gap-2 font-sans text-sm text-muted-ink">
                      <input
                        type="checkbox"
                        checked={giftWrap}
                        onChange={(event) => setGiftWrap(event.target.checked)}
                        className="mt-0.5 h-4 w-4"
                      />
                      <span>{t("giftWrapLabel")}</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={giftState === "saving"}
                        onClick={async () => {
                          setGiftState("saving");
                          try {
                            const res = await fetch("/api/store/checkout/gift", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                cart_id: cartId,
                                note: giftNote,
                                wrap: giftWrap,
                              }),
                            });
                            setGiftState(res.ok ? "saved" : "failed");
                          } catch {
                            setGiftState("failed");
                          }
                        }}
                        className="border border-ink/20 px-3 py-1.5 font-sans text-[10px] uppercase tracking-[0.18em] text-ink transition-colors hover:border-terracotta hover:text-terracotta disabled:opacity-60"
                      >
                        {t("giftSave")}
                      </button>
                      <p role="status" aria-live="polite" className="font-sans text-xs text-muted-ink">
                        {giftState === "saved"
                          ? t("giftSaved")
                          : giftState === "failed"
                            ? t("giftFailed")
                            : t("giftHint")}
                      </p>
                    </div>
                  </div>
                </details>

                {/* ── The single primary action ───────────────────── */}
                {!paymentsAvailable ? (
                  <div className="mt-6 border-l-2 border-terracotta bg-terracotta/5 px-4 py-3">
                    <p className="font-sans text-sm text-deep-ink">
                      {t("paymentsUnavailable")}
                    </p>
                    <p className="mt-1 font-sans text-xs text-muted-ink">
                      {t("paymentsUnavailableDetail")}
                    </p>
                  </div>
                ) : addressStepComplete ? (
                  <div className="mt-6">
                    <RazorpayPayButton
                      amount={grandTotal}
                      currency={currency}
                      name="SnehaVrinda Kala"
                      description={`Order · ${formatPrice(grandTotal, currency)}`}
                      // The buyer typed their name, email and phone one step ago.
                      // Prefilling them means Razorpay opens on the method list
                      // instead of stopping to ask for a number we already have,
                      // and the number it does receive is the one the courier
                      // will call rather than a second, possibly wrong, one.
                      prefill={{
                        name: initialAddress?.full_name || addressSummary?.name,
                        email: lockedEmail ?? initialAddress?.email,
                        contact: initialAddress?.phone,
                      }}
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
                    {completing && <PaymentProcessing />}
                    <p className="mt-3 text-center font-sans text-xs text-muted-ink">
                      {t("paySecure")}
                    </p>
                  </div>
                ) : (
                  // No second button here. Step 1's own submit already says
                  // "Continue to payment", and repeating that instruction as
                  // another filled button made the two steps look like they were
                  // arguing about what to do next.
                  <p className="mt-6 border-t border-sand-border/60 pt-4 font-sans text-xs leading-relaxed text-muted-ink">
                    {t("addAddressFirst")}
                  </p>
                )}
              </div>
            </div>
          </section>
        </li>
      </ol>

      {/* ══ Right — the totals, sticky on desktop ═══════════════════ */}
      <aside
        className="mx-auto max-w-xl lg:sticky lg:top-24 lg:order-none lg:max-w-none"
      >
        <div className="lg:border-t-2 lg:border-kumkum/70 lg:pt-5">
          <h2 className="sr-only">{t("orderSummary")}</h2>

          {/* What is actually being paid for. Collapsed, because the totals are
              the question the buyer came here with; expandable, because paying
              for something you can no longer see is unnerving. */}
          <details className="mb-4 border-b border-sand-border/60 pb-4" open>
            <summary className="flex cursor-pointer items-baseline justify-between gap-3 font-sans text-sm text-deep-ink">
              <span className="font-medium">
                {lines.reduce((sum, line) => sum + (line.quantity || 0), 0)} item
                {lines.reduce((sum, line) => sum + (line.quantity || 0), 0) === 1
                  ? ""
                  : "s"}
              </span>
              <span className="text-xs text-muted-ink underline underline-offset-4">
                show / hide
              </span>
            </summary>
            <ul className="mt-3 space-y-3">
              {lines.map((line) => (
                <li key={line.id} className="flex items-start gap-3">
                  {line.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={line.thumbnail}
                      alt=""
                      className="h-12 w-10 shrink-0 rounded border border-sand-border object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="h-12 w-10 shrink-0 rounded border border-dashed border-sand-border/70" />
                  )}
                  <div className="min-w-0 flex-1 font-sans text-[13px] leading-snug">
                    <p className="truncate text-deep-ink">{line.title}</p>
                    <p className="text-xs text-muted-ink">
                      {line.variant_title ? `${line.variant_title} · ` : ""}×
                      {line.quantity}
                    </p>
                  </div>
                  <span className="shrink-0 whitespace-nowrap font-sans text-[13px] text-deep-ink">
                    {formatPrice(line.total, currency)}
                  </span>
                </li>
              ))}
            </ul>
          </details>

          <dl className="space-y-3 font-sans text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-ink">{t("subtotal")}</dt>
              <dd className="text-deep-ink">{formatPrice(subtotal + discount, currency)}</dd>
            </div>

            {discount > 0 && (
              <div className="flex items-baseline justify-between gap-4 text-leaf">
                <dt>
                  {t("discount")}
                  {promoCode ? (
                    <span className="ml-1 text-xs text-muted-ink">({promoCode})</span>
                  ) : null}
                </dt>
                <dd className="whitespace-nowrap font-medium">
                  −{formatPrice(discount, currency)}
                </dd>
              </div>
            )}

            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-ink">{t("shipping")}</dt>
              <dd className="text-deep-ink">
                {!addressStepComplete ? (
                  <span className="text-muted-ink">{t("shippingCalculatedNext")}</span>
                ) : shippingRates.length === 0 ? (
                  <span className="text-muted-ink">{t("shippingConfirmed")}</span>
                ) : shippingAmount === 0 ? (
                  <span className="font-medium text-leaf">{t("free")}</span>
                ) : (
                  <span className="text-deep-ink">{formatPrice(shippingAmount, currency)}</span>
                )}
              </dd>
            </div>

            {shippingAmount > 0 && (
              // The rate is real, and the studio covers it as an automatic
              // discount. Showing only "Free" would hide both the charge and the
              // gift; showing only the charge would look like a coupon was missed.
              <div className="flex items-baseline justify-between gap-4 text-leaf">
                <dt>Free shipping (applied automatically)</dt>
                <dd className="whitespace-nowrap font-medium">
                  −{formatPrice(shippingAmount, currency)}
                </dd>
              </div>
            )}

            {tax && (
              // Catalogue prices already include GST, so this is a disclosure of
              // the tax *within* the total, not a charge added to it. Shown as a
              // bare line item it read as an extra cost that the total ignored.
              <div className="flex items-baseline justify-between gap-4 text-muted-ink">
                <dt>{t("includesTax", { label: taxLabel(tax) })}</dt>
                <dd>{formatPrice(tax.total_tax, currency)}</dd>
              </div>
            )}

            <div className="flex items-baseline justify-between gap-4 border-t border-sand-border/60 pt-4">
              <dt className="font-medium uppercase tracking-[0.12em] text-muted-ink">
                {t("total")}
              </dt>
              <dd className="whitespace-nowrap font-serif text-2xl font-semibold text-deep-ink">
                {formatPrice(grandTotal, currency)}
              </dd>
            </div>

            {currency.toUpperCase() !== "INR" && (
              <p className="font-sans text-[11px] leading-relaxed text-muted-ink">
                Import duties or local taxes may be charged by your customs
                authority on delivery, and are not included in this total.
              </p>
            )}
          </dl>

          {/* The column is sticky and the form beside it is tall, so below the
              totals there was a long empty band. Rather than leave it bare, this
              carries the reassurance a buyer wants at the moment of paying —
              which is also why it belongs here and not at the foot of the page. */}
          <div className="mt-6 hidden border-t border-sand-border/60 pt-5 lg:block">
            <ul className="space-y-2.5 font-sans text-xs leading-relaxed text-muted-ink">
              {[
                t("assureCertificate"),
                t("assurePacked"),
                // Deliberately not a blanket "seven days": the published policy
                // gives 7 days on ready-to-ship work and none on commissions, and
                // the cart does not carry per-line stock type here. Pointing at
                // the actual policy is true for every basket.
                t("assureReturns"),
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-1 text-terracotta">
                    —
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}
