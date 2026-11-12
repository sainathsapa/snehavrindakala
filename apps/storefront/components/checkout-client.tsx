"use client";

/**
 * Checkout island.
 *
 * Owns the two pieces of state a server component cannot: which courier the
 * customer picked, and the Razorpay handshake. Shipping selection is a single
 * value here and is sent to the payment session, so the total shown and the
 * total charged can no longer disagree.
 */

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatPrice } from "@/lib/medusa";
import { taxLabel, type TaxBreakdown } from "@/lib/tax";
import { RazorpayPayButton } from "./razorpay-checkout";

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
}

interface CheckoutClientProps {
  cartId: string;
  currency: string;
  lines: CheckoutLine[];
  subtotal: number;
  shippingRates: ShippingRate[];
  tax: TaxBreakdown | null;
  saved: boolean;
  deliverySaved: boolean;
  /** Server-rendered delivery form; keeps the Server Action on the server. */
  deliveryForm: ReactNode;
}

const rateKey = (rate: ShippingRate) =>
  `${rate.courier_name}::${rate.service_name}`;

export function CheckoutClient({
  cartId,
  currency,
  lines,
  subtotal,
  shippingRates,
  tax,
  saved,
  deliverySaved,
  deliveryForm,
}: CheckoutClientProps) {
  const router = useRouter();
  const [selectedRateKey, setSelectedRateKey] = useState(() =>
    shippingRates[0] ? rateKey(shippingRates[0]) : ""
  );
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRate = useMemo(
    () => shippingRates.find((rate) => rateKey(rate) === selectedRateKey),
    [shippingRates, selectedRateKey]
  );

  const shippingAmount = selectedRate?.rate ?? 0;
  const grandTotal = subtotal + shippingAmount;

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

  return (
    <div className="grid lg:grid-cols-2 gap-8 items-start">
      {/* ── Delivery details ────────────────────────────────────── */}
      <section
        id="delivery"
        className="rounded-xl border border-sand-border bg-surface p-6 sm:p-8"
        aria-labelledby="delivery-heading"
      >
        <h2
          id="delivery-heading"
          className="text-xl font-serif font-semibold text-deep-ink mb-1"
        >
          Delivery details
        </h2>
        <p className="mb-6 text-sm text-muted-ink font-sans">
          {saved
            ? "Details saved. You can update them any time before paying."
            : "Where should we send this?"}
        </p>
        {deliveryForm}
      </section>

      {/* ── Summary ─────────────────────────────────────────────── */}
      <section
        className="rounded-xl border border-sand-border bg-surface p-6 sm:p-8 lg:sticky lg:top-24"
        aria-labelledby="summary-heading"
      >
        <h2
          id="summary-heading"
          className="text-xl font-serif font-semibold text-deep-ink mb-6"
        >
          Order summary
        </h2>

        <ul className="space-y-3 text-sm font-sans">
          {lines.map((line) => (
            <li
              key={line.id}
              className="flex justify-between gap-4 border-b border-sand-border pb-3"
            >
              <span className="text-deep-ink">
                {line.title}
                {line.variant_title ? (
                  <span className="block text-xs text-muted-ink">
                    {line.variant_title}
                  </span>
                ) : null}
                <span className="text-xs text-muted-ink"> × {line.quantity}</span>
              </span>
              <span className="whitespace-nowrap text-deep-ink">
                {formatPrice(line.total, currency)}
              </span>
            </li>
          ))}

          <li className="flex justify-between gap-4 pt-1">
            <span className="text-muted-ink">Subtotal</span>
            <span className="text-deep-ink whitespace-nowrap">
              {formatPrice(subtotal, currency)}
            </span>
          </li>

          {shippingRates.length > 0 && (
            <li className="flex justify-between gap-4">
              <span className="text-muted-ink">Shipping</span>
              <span className="text-deep-ink whitespace-nowrap">
                {shippingAmount === 0 ? (
                  <span className="text-leaf font-medium">Free</span>
                ) : (
                  formatPrice(shippingAmount, currency)
                )}
              </span>
            </li>
          )}
        </ul>

        {/* Shipping options — only rendered once we have a PIN to quote. */}
        {shippingRates.length > 0 ? (
          <fieldset className="mt-6">
            <legend className="text-sm font-medium text-deep-ink mb-3">
              Delivery speed
            </legend>
            <div className="space-y-2">
              {shippingRates.map((rate) => {
                const key = rateKey(rate);
                const checked = key === selectedRateKey;
                return (
                  <label
                    key={key}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
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
                      className="mt-1 text-sindoor focus:ring-sindoor"
                    />
                    <span className="flex-1 text-sm font-sans">
                      <span className="block font-medium text-deep-ink">
                        {rate.courier_name}
                      </span>
                      <span className="block text-xs text-muted-ink">
                        {rate.service_name}
                        {rate.expected_delivery
                          ? ` · ${rate.expected_delivery}`
                          : ""}
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-sm font-medium text-deep-ink">
                      {rate.rate === 0
                        ? "Free"
                        : formatPrice(rate.rate, currency)}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : deliverySaved ? (
          <p className="mt-6 rounded-md bg-rang-paper p-3 text-xs text-muted-ink font-sans">
            We could not quote couriers for this PIN. Our team will confirm
            shipping before dispatch.
          </p>
        ) : null}

        {tax && (
          <p className="mt-4 text-xs text-muted-ink font-sans">
            Includes {taxLabel(tax)} ({formatPrice(tax.total_tax, currency)}).
            Prices are GST-inclusive.
          </p>
        )}

        <div className="mt-6 flex items-baseline justify-between border-t border-sand-border pt-4">
          <span className="text-lg font-serif font-semibold text-deep-ink">
            Total
          </span>
          <span className="text-2xl font-serif font-bold text-deep-ink">
            {formatPrice(grandTotal, currency)}
          </span>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 font-sans"
          >
            {error}
          </div>
        )}

        {saved ? (
          <div className="mt-6">
            <RazorpayPayButton
              amount={grandTotal}
              currency={currency}
              name="SnehaVrinda Kala"
              description={`Order · ${formatPrice(grandTotal, currency)}`}
              onSuccess={handlePaid}
              onError={(message) => setError(message)}
              createSession={async () => {
                const res = await fetch(
                  "/api/store/checkout/payment-session",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      cart_id: cartId,
                      shipping_rate: selectedRate,
                    }),
                  }
                );
                const body = await res.json().catch(() => ({}));
                if (!res.ok) {
                  throw new Error(
                    body.error || "We could not start the payment."
                  );
                }
                return {
                  orderId: body.razorpay_order_id,
                  amount: body.amount,
                  currency: body.currency,
                };
              }}
            />
            {completing && (
              <p className="mt-3 text-center text-sm text-muted-ink font-sans">
                Completing your order…
              </p>
            )}
            <p className="mt-3 text-center text-xs text-muted-ink font-sans">
              Secure payment by Razorpay · UPI, cards &amp; net banking
            </p>
          </div>
        ) : (
          <Link
            href="#delivery"
            className="mt-6 block w-full rounded-md bg-sindoor px-6 py-3 text-center font-medium text-rang-paper hover:bg-sindoor/90 transition-colors"
          >
            Continue to delivery details
          </Link>
        )}
      </section>
    </div>
  );
}
