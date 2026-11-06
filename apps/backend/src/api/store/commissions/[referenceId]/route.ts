import type { MedusaRequest, MedusaResponse } from "@medusajs/types";
import type { CommissionService } from "../../../../modules/commission/service";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const commissionService = req.scope.resolve("commission") as CommissionService;
  const { referenceId } = req.params as { referenceId: string };

  const commission = await commissionService.getCommissionRequestByReference(referenceId);
  if (!commission) {
    return res.status(404).json({ error: "Commission request not found" });
  }

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
