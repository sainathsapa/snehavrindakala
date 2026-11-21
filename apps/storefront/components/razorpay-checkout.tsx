"use client";

import { useTranslations } from "next-intl";
import { useState, useCallback } from "react";
import { Button } from "@snehavrinda-kala/ui";

interface SessionConfig {
  orderId: string;
  amount: number;
  currency: string;
}

interface RazorpayPayButtonProps {
  /** Pre-created Razorpay order id. Optional when `createSession` is given. */
  orderId?: string;
  /** Amount in INR minor units (paise) — used for the button label. */
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
  /** Lazily create the Razorpay order on click so the total is never stale. */
  createSession?: () => Promise<SessionConfig>;
  onSuccess: (payment: {
    paymentId: string;
    orderId: string;
    signature: string;
  }) => void;
  onError: (message: string) => void;
}

function loadRazorpay(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).Razorpay) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Razorpay SDK failed to load"))
      );
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Razorpay SDK failed to load"));
    document.head.appendChild(script);
  });
}

export function RazorpayPayButton({
  orderId,
  amount,
  currency,
  name,
  description,
  prefill,
  createSession,
  onSuccess,
  onError,
}: RazorpayPayButtonProps) {
  const t = useTranslations("checkout");
  const [status, setStatus] = useState<"idle" | "paying" | "success" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePay = useCallback(async () => {
    setStatus("paying");
    setErrorMessage(null);
    try {
      await loadRazorpay();

      const session: SessionConfig = createSession
        ? await createSession()
        : { orderId: orderId || "", amount, currency };

      if (!session.orderId) {
        throw new Error("Payment could not be started. Please try again.");
      }

      const options: any = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: session.amount,
        currency: session.currency,
        name,
        description,
        order_id: session.orderId,
        prefill: { name: "", email: "", contact: "", ...prefill },
        theme: { color: "#C84636" },
        handler: async (response: any) => {
          const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
            response;
          // Server-side verification — never trust the handler alone.
          try {
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
            // `signature_valid`, not `paid`: the check above proves Razorpay
            // signed this handshake, and the completion request is what records
            // the payment and creates the order.
            if (verifyBody.signature_valid) {
              setStatus("success");
              onSuccess({
                paymentId: razorpay_payment_id,
                orderId: razorpay_order_id,
                signature: razorpay_signature,
              });
              return;
            }
            setStatus("error");
            setErrorMessage(
              verifyBody.error || "Payment could not be verified."
            );
          } catch {
            setStatus("error");
            setErrorMessage("Payment could not be verified.");
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
      rzp.on("payment.failed", (response: any) => {
        setStatus("error");
        setErrorMessage(
          response?.error?.description || "Payment failed. Please try again."
        );
      });
      rzp.open();
    } catch (err) {
      setStatus("error");
      const message =
        err instanceof Error ? err.message : "Failed to start payment.";
      setErrorMessage(message);
      onError(message);
    }
  }, [
    orderId,
    amount,
    currency,
    name,
    description,
    prefill,
    createSession,
    onSuccess,
    onError,
  ]);

  if (status === "success") {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
          <svg
            className="h-6 w-6 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h3 className="text-lg font-serif font-semibold text-deep-ink">
          {t("paySuccess")}
        </h3>
        <p className="text-muted-ink font-sans">{t("payConfirming")}</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <h3 className="text-lg font-serif font-semibold text-deep-ink">
          {t("payFailed")}
        </h3>
        <p className="text-sm text-red-700 font-sans mb-4">{errorMessage}</p>
        <Button onClick={() => setStatus("idle")}>{t("payRetry")}</Button>
      </div>
    );
  }

  return (
    <Button
      onClick={handlePay}
      disabled={status === "paying"}
      className="w-full rounded-sm bg-kumkum px-6 py-4 font-sans text-sm font-semibold tracking-wide text-rang-paper transition-colors hover:bg-sindoor focus:outline-none focus-visible:ring-2 focus-visible:ring-kumkum focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {status === "paying" ? t("payProcessing") : t("payNow")}
    </Button>
  );
}
