import type { MedusaRequest, MedusaResponse } from "@medusajs/types";
import type { CommissionService } from "../../../modules/commission/service";

/**
 * POST /store/commissions
 * Create a new commission request (customer-facing).
 * Reference ID returned for customer tracking.
 */
async function POST(req: MedusaRequest, res: MedusaResponse) {
  const commissionService = req.scope.resolve(
    "commission"
  ) as CommissionService;

  const body = req.body as any;

  const {
    customer_id,
    customer_email,
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
      // Carried into the acknowledgement email; stripped before persistence by
      // the entity (it is not a column).
      customer_email,
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

export { POST };
