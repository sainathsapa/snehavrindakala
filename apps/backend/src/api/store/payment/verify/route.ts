/**
 * POST /store/payment/verify
 *
 * Server-side payment verification. Validates the Razorpay payment signature
 * and confirms the order is captured via retrievePayment. Returns the order
 * status so the storefront can render the confirmation page. Never trusts a
 * browser redirect as proof of payment.
 *
 * Integration boundary: verifies via the Razorpay provider's
 * verifyPaymentSignature + retrievePayment. If the provider is not configured
 * (missing keys), returns 501 documenting what is required.
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/types";
import { verifyPaymentStep } from "../../../../workflows/order-payment-workflow";

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const scope = req.scope;
  const body = (req.body as unknown) as {
    razorpay_order_id: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  };

  const paymentModuleService = scope.resolve("payment");
  if (!paymentModuleService) {
    return res.status(501).json({
      error:
        "Payment verification not configured. Resolve paymentModuleService (Razorpay provider) in the Medusa container.",
    });
  }

  try {
    await verifyPaymentStep({
      paymentModuleService,
      input: {
        razorpay_order_id: body.razorpay_order_id,
        razorpay_payment_id: body.razorpay_payment_id,
        razorpay_signature: body.razorpay_signature,
      },
    });

    return res.status(200).json({ status: "verified", paid: true });
  } catch (err) {
    return res.status(400).json({
      status: "failed",
      paid: false,
      error: err instanceof Error ? err.message : "Payment verification failed.",
    });
  }
}
