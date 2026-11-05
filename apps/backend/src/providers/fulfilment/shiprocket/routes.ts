import type { MedusaRequest, MedusaResponse } from "@medusajs/types";
import { ShiprocketWebhookHandler } from "./webhook.handler";

/**
 * POST /admin/fulfilment/shiprocket/webhook
 * Shiprocket webhook endpoint.
 */
export async function shiprocketWebhook(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const handler: any = req.scope.resolve("shiprocketWebhookHandler");
  await handler.handle(req, res);
}

export default shiprocketWebhook;
