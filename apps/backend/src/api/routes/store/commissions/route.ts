import type { MedusaRequest, MedusaResponse } from "@medusajs/medusa";

/**
 * POST /store/commissions
 * Create a new commission request (customer-facing).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const commissionModuleService = req.scope.resolve("commissionModuleService");

  const {
    customer_id,
    art_form,
    brief,
    intended_use,
    dimensions,
    budget_range,
    target_date,
    delivery_region,
    delivery_pin,
  } = req.body as Record<string, unknown>;

  const referenceId = `COM-${Date.now()}`;

  const commission = await commissionModuleService.createCommissionRequest({
    customer_id,
    reference_id: referenceId,
    art_form,
    brief,
    intended_use,
    dimensions,
    budget_range,
    target_date,
    delivery_region,
    delivery_pin,
    status: "New",
  });

  return res.status(201).json({
    commission_request: commission,
    reference_id: referenceId,
  });
}

/**
 * GET /store/commissions/:referenceId
 * Get a commission request by its public reference ID.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { referenceId } = req.params as { referenceId: string };
  const commissionModuleService = req.scope.resolve("commissionModuleService");

  const commission = await commissionModuleService.getCommissionRequest(
    referenceId
  );

  if (!commission) {
    return res.status(404).json({ message: "Commission request not found" });
  }

  return res.status(200).json({ commission_request: commission });
}
