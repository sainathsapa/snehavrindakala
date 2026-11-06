/**
 * POST /store/checkout/payment-session
 *
 * Creates a Razorpay payment session (order) for the current cart via the
 * order-payment workflow. Server-side only — the storefront never touches
 * Razorpay keys. Per build plan Section 12.2: never mark an order paid from
 * a browser redirect alone; payment is confirmed only after server-side
 * verification in the verify route and the Razorpay webhook.
 *
 * Integration boundary: resolves Medusa core module services from the request
 * scope. If the order/payment module methods used by the workflow are not yet
 * wired to a concrete Medusa order service, this returns a 501 with the exact
 * configuration still required (never fakes a successful payment).
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/types";
import { orderPaymentWorkflow } from "../../../workflows/order-payment-workflow";

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const scope = req.scope;
  const body = (req.body as unknown) as { cart_id: string };
  const { cart_id } = body;

  if (!cart_id) {
    return res.status(400).json({ error: "cart_id is required." });
  }

  const paymentModuleService = scope.resolve("payment");
  const orderModuleService = scope.resolve("order");
  const auditService = scope.resolve("audit");

  if (!paymentModuleService || !orderModuleService || !auditService) {
    return res.status(501).json({
      error:
        "Checkout not fully wired. Resolve paymentModuleService, orderModuleService, and auditModuleService in the Medusa container.",
    });
  }

  try {
    const result = await orderPaymentWorkflow({
      paymentModuleService,
      orderModuleService,
      auditService,
      input: {
        cart_id,
        payment_provider: "razorpay",
        metadata: { source: "storefront_checkout" },
      },
    });

    return res.status(200).json({
      payment_session_id: result.payment_session_id,
      razorpay_order_id: result.razorpay_order_id,
      amount: result.amount,
      currency: result.currency,
      status: result.status,
    });
  } catch (err) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to create payment session.",
    });
  }
}
