"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { medusa, formatPrice } from "@/lib/medusa";
import { RazorpayPayButton } from "./razorpay-checkout";
import { Button } from "@snehavrinda-kala/ui";
import { useRouter } from "next/navigation";

export function CheckoutPayment({
  cartTotal,
  currency = "inr",
  cartId,
  shippingRate,
  shippingAmount,
}: {
  cartTotal: number;
  currency: string;
  cartId: string;
  shippingRate?: { courier_name: string; service_name: string; rate: number; expected_delivery: string };
  shippingAmount?: number;
}) {
  const router = useRouter();
  const [session, setSession] = useState<{
    razorpay_order_id: string;
    amount: number;
    currency: string;
    status: string;
    shipping_amount?: number;
    shipping?: {
      courier_name: string;
      service_name: string;
      expected_delivery: string;
    } | null;
  } | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  const createSession = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/store/checkout/payment-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart_id: cartId }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed to create payment order.");
        return;
      }
      setSession(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create payment order.");
    } finally {
      setCreating(false);
    }
  };

  const handlePaymentSuccess = async (paymentId: string) => {
    setCompleting(true);
    try {
      const res = await fetch("/api/store/checkout/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cart_id: cartId, payment_id: paymentId }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Order could not be completed.");
        setCompleting(false);
        return;
      }
      const body = await res.json();
      router.push(`/order/${body.order_id}?paid=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order could not be completed.");
      setCompleting(false);
    }
  };

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h3 className="text-lg font-serif font-semibold text-deep-ink">Unable to start payment</h3>
        <p className="text-sm text-red-700 font-sans mb-4">{error}</p>
        <Button onClick={createSession}>Retry</Button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="py-8 text-center">
        <Button onClick={createSession} className="bg-sindoor text-rang-paper">
          Create payment order
        </Button>
      </div>
    );
  }

  // The server includes shipping in `amount`, so the grand total is simply
  // the Razorpay order amount. Fall back to the quote for display if needed.
  const effectiveShipping = session.shipping
    ? {
        courier_name: session.shipping.courier_name,
        service_name: session.shipping.service_name,
        rate: session.shipping_amount ?? 0,
        expected_delivery: session.shipping.expected_delivery,
      }
    : shippingRate;
  const grandTotal = session.amount / 100;

  return (
    <div className="space-y-6">
      {effectiveShipping && (
        <div className="border-y border-sand-border py-4">
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-sans text-muted-ink">Shipping</span>
            <span className="text-2xl font-serif font-bold text-deep-ink">
              {effectiveShipping.rate === 0
                ? "FREE"
                : `₹${effectiveShipping.rate / 100}`}
            </span>
          </div>
          <div className="text-sm text-muted-ink font-sans mt-1">
            {effectiveShipping.courier_name} • {effectiveShipping.service_name}
            {effectiveShipping.expected_delivery &&
              ` • Est. delivery: ${effectiveShipping.expected_delivery}`}
          </div>
        </div>
      )}

      <div className="border-y border-sand-border py-4">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-serif font-bold text-deep-ink">Grand total</span>
          <span className="text-2xl font-serif font-bold text-deep-ink">
            ₹{grandTotal.toFixed(2)}
          </span>
        </div>
        <p className="text-xs text-muted-ink font-sans mt-1">
          Includes shipping and taxes.
        </p>
      </div>

      <RazorpayPayButton
        orderId={session.razorpay_order_id}
        amount={session.amount}
        currency={session.currency}
        name="SnehaVrinda Kala"
        description={`Order · ₹${formatPrice(session.amount, session.currency)}`}
        onSuccess={handlePaymentSuccess}
        onError={(message) => {
          setError(message);
          setSession(null);
        }}
      />
      {completing && (
        <div className="text-center py-4">
          <p className="text-sm text-muted-ink font-sans">Completing order…</p>
        </div>
      )}
    </div>
  );
}
