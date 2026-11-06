/**
 * GET /store/shipments/track?awb_code=...
 *
 * Tracks a Shiprocket shipment. Returns normalized tracking status and
 * details for the customer order-tracking page.
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/types";

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const scope = req.scope;
  const url = new URL(req.url);
  const awbCode = url.searchParams.get("awb_code");

  if (!awbCode) {
    res.status(400).json({ error: "awb_code is required." });
    return;
  }

  const fulfilmentModuleService = scope.resolve("fulfilmentModuleService") as any;
  if (!fulfilmentModuleService) {
    res.status(501).json({
      error: "Fulfilment not wired. Resolve fulfilmentModuleService in the Medusa container.",
    });
    return;
  }

  try {
    const tracking = await fulfilmentModuleService.trackFulfillment(awbCode);
    res.status(200).json({
      tracking_number: tracking.tracking_number,
      status: tracking.status,
      tracking_details: tracking.tracking_details,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Tracking lookup failed.",
    });
  }
  return;
}
