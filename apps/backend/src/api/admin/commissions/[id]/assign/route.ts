import type { MedusaRequest, MedusaResponse } from "@medusajs/types";
import type { CommissionService } from "../../../../../modules/commission/service";

/**
 * POST /admin/commissions/:id/assign
 * Assign an artist to a commission request.
 */
async function POST(req: MedusaRequest, res: MedusaResponse) {
  const commissionService = req.scope.resolve(
    "commission"
  ) as CommissionService;
  const { id } = req.params as { id: string };

  const { artist_id, actor } = req.body as {
    artist_id: string;
    actor: string;
  };

  if (!artist_id || !actor) {
    return res.status(400).json({ error: "artist_id and actor are required" });
  }

  try {
    await commissionService.assignArtist(id, artist_id);

    return res.status(200).json({
      commission_request_id: id,
      assigned_artist_id: artist_id,
      assigned_at: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(400).json({
      error: err instanceof Error ? err.message : "Failed to assign artist",
    });
  }
}

export { POST };
