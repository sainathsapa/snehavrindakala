"use client";

import { useState, useEffect } from "react";
import { medusa, formatPrice } from "@/lib/medusa";
import { RazorpayPayButton } from "./razorpay-checkout";
import { Button } from "@snehavrinda-kala/ui";

export function CheckoutPayment({
  cartTotal,
  currency = "inr",
  cartId,
}: {
  cartTotal: number;
  currency: string;
  cartId: string;
}) {
  const [session, setSession] = useState<{
    razorpay_order_id: string;
    amount: number;
    currency: string;
    status: string;
  } | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <div className="border-y border-sand-border py-4">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-sans text-muted-ink">Order total</span>
          <span className="text-2xl font-serif font-bold text-deep-ink">
            {formatPrice(session.amount, session.currency)}
          </span>
        </div>
      </div>
      <RazorpayPayButton
        orderId={session.razorpay_order_id}
        amount={session.amount}
        currency={session.currency}
        name="SnehaVrinda Kala"
        description={`Order · ₹${formatPrice(session.amount, session.currency)}`}
        onSuccess={(paymentId) => {
          // Handled inside RazorpayPayButton (renders success)
        }}
        onError={(message) => {
          setError(message);
          setSession(null);
        }}
      />
    </div>
  );
}
