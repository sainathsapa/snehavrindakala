import type { MedusaRequest, MedusaResponse } from "@medusajs/types";
import type { CommissionService } from "../../../modules/commission/service";

/**
 * GET /admin/commissions
 * List commission requests (admin queue).
 */
async function GET(req: MedusaRequest, res: MedusaResponse) {
  const commissionService = req.scope.resolve(
    "commissionModuleService"
  ) as CommissionService;

  const { status, assigned_artist_id, offset, limit } = req.query as unknown as {
    status?: string;
    assigned_artist_id?: string;
    offset?: string;
    limit?: string;
  };

  const { requests, count } = await commissionService.listCommissionRequests({
    status: status as any,
    assigned_artist_id,
    offset: offset ? Number(offset) : 0,
    limit: limit ? Number(limit) : 20,
  });

  return res.status(200).json({
    commission_requests: requests,
    count,
    offset: Number(offset) || 0,
    limit: Number(limit) || 20,
  });
}

export { GET };
