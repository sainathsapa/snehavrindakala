import type { MedusaRequest, MedusaResponse } from "@medusajs/types";
import type { ArtistService } from "../../../../../modules/artist/service";

/**
 * POST /admin/partner-applications/:id/review
 * Approve or reject a partner application (admin only).
 */
async function POST(req: MedusaRequest, res: MedusaResponse) {
  const artistService = req.scope.resolve(
    "artist"
  ) as ArtistService;
  const { id } = req.params as { id: string };

  const { status, reviewer_id, review_notes } = req.body as {
    status: "approved" | "rejected";
    reviewer_id: string;
    review_notes?: string;
  };

  if (!status || !reviewer_id) {
    return res.status(400).json({
      error: "status and reviewer_id are required",
    });
  }

  try {
    const app = await artistService.reviewPartnerApplication(
      id,
      status,
      reviewer_id,
      review_notes
    );
    return res.status(200).json({ partner_application: app });
  } catch (err) {
    return res.status(400).json({
      error: err instanceof Error ? err.message : "Failed to review application",
    });
  }
}

export { POST };
