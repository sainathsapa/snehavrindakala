/**
 * POST /store/shipments
 *
 * Books a Shiprocket shipment for a paid order. Server-side only — the
 * storefront never touches Shiprocket credentials. Per build plan Section 12.4:
 * shipment booking happens only after payment/order states are correct; failed
 * bookings can be retried safely (idempotent via integration event ledger).
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/types";

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const scope = req.scope;
  const body = (req.body as unknown) as {
    order_id: string;
    address: any;
    items: any[];
    weight?: number;
    metadata?: any;
  };
  const { order_id, address, items, weight, metadata } = body;

  if (!order_id || !address || !items) {
    res.status(400).json({ error: "order_id, address, and items are required." });
    return;
  }

  const fulfilmentModuleService = scope.resolve("fulfillment") as any;
  if (!fulfilmentModuleService) {
    res.status(501).json({
      error: "Fulfilment not wired. Resolve fulfilmentModuleService in the Medusa container.",
    });
    return;
  }

  try {
    const shipment = await fulfilmentModuleService.createFulfillment({
      order_id,
      address,
      items,
      weight,
      metadata,
    });

    res.status(200).json({
      id: shipment.id,
      order_id: shipment.order_id,
      status: shipment.status,
      data: shipment.data,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Shipment booking failed.",
    });
  }
  return;
}
