import type { MedusaRequest, MedusaResponse } from "@medusajs/types";
import type { CommissionService } from "../../../../modules/commission/service";

type CommissionCreateBody = {
  customer_id: string;
  art_form: string;
  brief: string;
  intended_use?: string;
  dimensions?: string;
  budget_range?: string;
  target_date?: string;
  delivery_region?: string;
  delivery_pin?: string;
};

/**
 * POST /store/commissions
 * Create a new commission request (customer-facing).
 * Wired to the commission module via Medusa's dependency injection scope.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const commissionModuleService = req.scope.resolve(
    "commissionModule"
  ) as CommissionService;

  const body = req.body as CommissionCreateBody;
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
  } = body;

  const referenceId = `COM-${Date.now()}`;

  const commission = await commissionModuleService.create({
    customer_id,
    reference_id: referenceId,
    art_form,
    brief,
    intended_use,
    dimensions,
    budget_range,
    target_date: target_date ? new Date(target_date) : undefined,
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
  const commissionModuleService = req.scope.resolve(
    "commissionModule"
  ) as CommissionService;

  const commission = await commissionModuleService.findOne({
    reference_id: referenceId,
  });

  if (!commission) {
    return res.status(404).json({ message: "Commission request not found" });
  }

  return res.status(200).json({ commission_request: commission });
}
