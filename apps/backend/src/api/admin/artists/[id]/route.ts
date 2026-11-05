import type { MedusaRequest, MedusaResponse } from "@medusajs/types";
import type { ArtistService } from "../../../../modules/artist/service";
import type { UpdateArtistInput } from "../../../../modules/artist/types";

/**
 * GET /admin/artists/:id
 * Get a single artist.
 */
async function GET(req: MedusaRequest, res: MedusaResponse) {
  const artistService = req.scope.resolve(
    "artistModuleService"
  ) as ArtistService;
  const { id } = req.params as { id: string };

  const artist = await artistService.getArtist(id);
  if (!artist) {
    return res.status(404).json({ error: "Artist not found" });
  }

  return res.status(200).json({ artist });
}

/**
 * POST /admin/artists/:id
 * Update an artist record.
 */
async function POST(req: MedusaRequest, res: MedusaResponse) {
  const artistService = req.scope.resolve(
    "artistModuleService"
  ) as ArtistService;
  const { id } = req.params as { id: string };

  const body = req.body as UpdateArtistInput;

  try {
    const artist = await artistService.updateArtist(id, body);
    return res.status(200).json({ artist });
  } catch (err) {
    return res.status(400).json({
      error: err instanceof Error ? err.message : "Failed to update artist",
    });
  }
}

/**
 * DELETE /admin/artists/:id
 */
async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const artistService = req.scope.resolve(
    "artistModuleService"
  ) as ArtistService;
  const { id } = req.params as { id: string };

  try {
    await artistService.deleteArtist(id);
    return res.status(200).json({ id, object: "artist", deleted: true });
  } catch (err) {
    return res.status(400).json({
      error: err instanceof Error ? err.message : "Failed to delete artist",
    });
  }
}

export { GET, POST, DELETE };
