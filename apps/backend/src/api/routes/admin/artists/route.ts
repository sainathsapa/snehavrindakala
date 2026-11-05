import type { MedusaRequest, MedusaResponse } from "@medusajs/types";
import type { ArtistService, ArtistInput } from "../../../../modules/artist/service";

/**
 * GET /admin/artists
 * List artists (internal admin).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const artistModuleService = req.scope.resolve(
    "artistModule"
  ) as ArtistService;
  const artists = await artistModuleService.list({ status: "approved" });

  return res.status(200).json({ artists });
}

/**
 * POST /admin/artists
 * Create or update an artist record (internal admin).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const artistModuleService = req.scope.resolve(
    "artistModule"
  ) as ArtistService;
  const body = req.body as ArtistInput;
  const artist = await artistModuleService.create(body);

  return res.status(201).json({ artist });
}
