import type { MedusaRequest, MedusaResponse } from "@medusajs/types";
import type { ArtistService } from "../../../modules/artist/service";
import type {
  CreateArtistInput,
  UpdateArtistInput,
  ArtistFilter,
} from "../../../modules/artist/types";

/**
 * GET /admin/artists
 * List artists with filtering and pagination (internal admin).
 */
async function GET(req: MedusaRequest, res: MedusaResponse) {
  const artistService = req.scope.resolve(
    "artistModuleService"
  ) as ArtistService;

  const { offset, limit, status, q } = req.query as unknown as ArtistFilter;

  const { artists, count } = await artistService.listArtists({
    offset: offset ? Number(offset) : 0,
    limit: limit ? Number(limit) : 20,
    status,
    q,
  });

  return res.status(200).json({
    artists,
    count,
    offset: Number(offset) || 0,
    limit: Number(limit) || 20,
  });
}

/**
 * POST /admin/artists
 * Create an artist record (internal admin).
 */
async function POST(req: MedusaRequest, res: MedusaResponse) {
  const artistService = req.scope.resolve(
    "artistModuleService"
  ) as ArtistService;

  const body = req.body as CreateArtistInput;

  try {
    const artist = await artistService.createArtist(body);
    return res.status(201).json({ artist });
  } catch (err) {
    return res.status(400).json({
      error: err instanceof Error ? err.message : "Failed to create artist",
    });
  }
}

export { GET, POST };
