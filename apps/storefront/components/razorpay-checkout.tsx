"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@snehavrinda-kala/ui";

interface RazorpayPayButtonProps {
  orderId: string;
  amount: number; // INR minor units (paise)
  currency: string;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
  onSuccess: (paymentId: string) => void;
  onError: (message: string) => void;
}

export function RazorpayPayButton({
  orderId,
  amount,
  currency,
  name,
  description,
  prefill,
  onSuccess,
  onError,
}: RazorpayPayButtonProps) {
  const [status, setStatus] = useState<"idle" | "paying" | "success" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadRazorpay = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      if ((window as any).Razorpay) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Razorpay SDK failed to load"));
      document.head.appendChild(script);
    });
  }, []);

  const handlePay = useCallback(async () => {
    setStatus("paying");
    setErrorMessage(null);
    try {
      await loadRazorpay();
      const options: any = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount,
        currency,
        name,
        description,
        order_id: orderId,
        prefill: {
          name: "",
          email: "",
          contact: "",
          ...prefill,
        },
        theme: { color: "#C84636" },
        handler: async (response: any) => {
          const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
            response;
          // Server-side verification — never trust the redirect/handler alone.
          const verifyRes = await fetch("/api/store/payment/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id,
              razorpay_payment_id,
              razorpay_signature,
            }),
          });
          const verifyBody = await verifyRes.json();
          if (verifyBody.paid) {
            setStatus("success");
            onSuccess(razorpay_payment_id);
          } else {
            setStatus("error");
            setErrorMessage(
              verifyBody.error || "Payment could not be verified."
            );
          }
        },
        modal: {
          ondismiss: () => {
            setStatus("idle");
            onError("Payment was cancelled.");
          },
        },
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to start payment."
      );
    }
  }, [orderId, amount, currency, name, description, prefill, loadRazorpay, onSuccess, onError]);

  if (status === "success") {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-serif font-semibold text-deep-ink">Payment successful</h3>
        <p className="text-muted-ink font-sans">Your order has been confirmed.</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <h3 className="text-lg font-serif font-semibold text-deep-ink">Payment failed</h3>
        <p className="text-sm text-red-700 font-sans mb-4">{errorMessage}</p>
        <Button onClick={() => setStatus("idle")}>Try again</Button>
      </div>
    );
  }

  return (
    <Button
      onClick={handlePay}
      disabled={status === "paying"}
      className="w-full py-4 bg-sindoor text-rang-paper rounded-xl font-semibold hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 transition-colors disabled:opacity-50"
    >
      {status === "paying" ? "Processing payment…" : `Pay ₹${(amount / 100).toLocaleString("en-IN")} now`}
    </Button>
  );
}
