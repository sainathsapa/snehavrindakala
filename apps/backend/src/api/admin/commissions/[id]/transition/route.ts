import type { MedusaRequest, MedusaResponse } from "@medusajs/types";
import type { CommissionService } from "../../../../../modules/commission/service";

/**
 * POST /admin/commissions/:id/transition
 * Transition a commission request to a new status (validated by state machine).
 */
async function POST(req: MedusaRequest, res: MedusaResponse) {
  const commissionService = req.scope.resolve(
    "commissionModuleService"
  ) as CommissionService;
  const { id } = req.params as { id: string };

  const { to_status, actor, reason, metadata } = req.body as {
    to_status: string;
    actor: string;
    reason?: string;
    metadata?: Record<string, any>;
  };

  if (!to_status || !actor) {
    return res.status(400).json({ error: "to_status and actor are required" });
  }

  try {
    await commissionService.updateCommissionRequestStatus(id, to_status as any);

    return res.status(200).json({
      commission_request_id: id,
      to_status,
      transitioned_at: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(400).json({
      error: err instanceof Error ? err.message : "Failed to transition commission",
    });
  }
}

export { POST };
