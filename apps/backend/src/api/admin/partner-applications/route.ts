import type { MedusaRequest, MedusaResponse } from "@medusajs/types";
import type { ArtistService } from "../../../modules/artist/service";

/**
 * GET /admin/partner-applications
 * List partner applications with review status filter.
 */
async function GET(req: MedusaRequest, res: MedusaResponse) {
  const artistService = req.scope.resolve(
    "artist"
  ) as ArtistService;

  const { review_status, offset, limit } = req.query as unknown as {
    review_status?: string;
    offset?: string;
    limit?: string;
  };

  const { applications, count } = await artistService.listPartnerApplications({
    review_status,
    offset: offset ? Number(offset) : 0,
    limit: limit ? Number(limit) : 20,
  });

  return res.status(200).json({
    partner_applications: applications,
    count,
    offset: Number(offset) || 0,
    limit: Number(limit) || 20,
  });
}

/**
 * POST /admin/partner-applications
 * Submit a partner application (public-facing, no auth required).
 */
async function POST(req: MedusaRequest, res: MedusaResponse) {
  const artistService = req.scope.resolve(
    "artist"
  ) as ArtistService;

  const body = req.body as any;

  try {
    const app = await artistService.createPartnerApplication(body);
    return res.status(201).json({ partner_application: app });
  } catch (err) {
    return res.status(400).json({
      error: err instanceof Error ? err.message : "Failed to submit application",
    });
  }
}

export { GET, POST };
