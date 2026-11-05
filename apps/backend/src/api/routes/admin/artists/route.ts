import type { MedusaRequest, MedusaResponse } from "@medusajs/medusa";

/**
 * GET /admin/artists
 * List artists (internal admin).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const artistModuleService = req.scope.resolve("artistModuleService");
  const artists = await artistModuleService.listArtists();

  return res.status(200).json({ artists });
}

/**
 * POST /admin/artists
 * Create or update an artist record (internal admin).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const artistModuleService = req.scope.resolve("artistModuleService");
  const artist = await artistModuleService.createArtist(req.body);

  return res.status(201).json({ artist });
}
