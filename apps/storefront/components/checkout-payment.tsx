"use client";

import { useState } from "react";
import { medusa, formatPrice } from "@/lib/medusa";
import { RazorpayPayButton } from "./razorpay-checkout";
import { Button } from "@snehavrinda-kala/ui";
import { useRouter } from "next/navigation";

export function CheckoutPayment({
  cartTotal,
  currency = "inr",
  cartId,
}: {
  cartTotal: number;
  currency: string;
  cartId: string;
}) {
  const router = useRouter();
  const [session, setSession] = useState<{
    razorpay_order_id: string;
    amount: number;
    currency: string;
    status: string;
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
