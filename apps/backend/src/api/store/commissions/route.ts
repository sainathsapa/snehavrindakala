import type { MedusaRequest, MedusaResponse } from "@medusajs/types";
import type { CommissionService } from "../../../modules/commission/service";

/**
 * POST /store/commissions
 * Create a new commission request (customer-facing).
 * Reference ID returned for customer tracking.
 */
async function POST(req: MedusaRequest, res: MedusaResponse) {
  const commissionService = req.scope.resolve(
    "commissionModuleService"
  ) as CommissionService;

  const body = req.body as any;

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

  if (!art_form || !brief) {
    return res.status(400).json({ error: "art_form and brief are required" });
  }

  try {
    const commission = await commissionService.createCommissionRequest({
      customer_id,
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
      commission_request: {
        id: commission.id,
        reference_id: commission.reference_id,
        status: commission.status,
        created_at: commission.created_at,
      },
      reference_id: commission.reference_id,
    });
  } catch (err) {
    return res.status(400).json({
      error: err instanceof Error ? err.message : "Failed to create commission",
    });
  }
}

/**
 * GET /store/commissions/:referenceId
 * Get a commission request by public reference ID (customer-safe).
 * Only returns customer-safe fields - no internal notes, artist payout, etc.
 */
async function GET(req: MedusaRequest, res: MedusaResponse) {
  const commissionService = req.scope.resolve(
    "commissionModuleService"
  ) as CommissionService;
  const { referenceId } = req.params as { referenceId: string };

  const commission = await commissionService.getCommissionRequestByReference(
    referenceId
  );

  if (!commission) {
    return res.status(404).json({ error: "Commission request not found" });
  }

  // Customer-safe projection - no internal fields
  return res.status(200).json({
    commission_request: {
      reference_id: commission.reference_id,
      status: commission.status,
      art_form: commission.art_form,
      brief: commission.brief,
      target_date: commission.target_date,
      delivery_region: commission.delivery_region,
      delivery_pin: commission.delivery_pin,
      assigned_artist_id: commission.assigned_artist_id,
      created_at: commission.created_at,
      updated_at: commission.updated_at,
    },
  });
}

export { POST, GET };
