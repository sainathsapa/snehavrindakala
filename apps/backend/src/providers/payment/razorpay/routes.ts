import type { MedusaRequest, MedusaResponse } from "@medusajs/types";
import { RazorpayWebhookHandler } from "./webhook.handler";

/**
 * POST /admin/payment/razorpay/webhook
 * Razorpay webhook endpoint.
 *
 * Mounted as a custom admin route. The raw body must be available for
 * signature verification (see webhook.handler.ts).
 */
export async function razorpayWebhook(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const handler: any = req.scope.resolve("razorpayWebhookHandler");
  await handler.handle(req, res);
}

export default razorpayWebhook;
