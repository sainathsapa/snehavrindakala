import type { MedusaRequest, MedusaResponse } from "@medusajs/types";
import type { ArtistService } from "../../../modules/artist/service";

/**
 * GET /store/artists
 * List public (approved) artists for customer discovery.
 */
async function GET(req: MedusaRequest, res: MedusaResponse) {
  const artistService = req.scope.resolve("artist") as ArtistService;

  const { offset, limit, q } = req.query as unknown as {
    offset?: string;
    limit?: string;
    q?: string;
  };

  const offsetNum = offset ? Number(offset) : 0;
  const limitNum = limit ? Number(limit) : 20;
  const where: Record<string, any> = { status: "approved" };
  if (q) {
    where.$or = [
      { display_name: { $ilike: `%${q}%` } },
      { slug: { $ilike: `%${q}%` } },
    ];
  }
  const [artists, count] = await artistService.listAndCountArtists(where, {
    skip: offsetNum,
    take: limitNum,
    order: { created_at: "DESC" },
  });

  // Public-safe projection - no contact email/phone
  const publicArtists = artists.map((a) => ({
    id: a.id,
    display_name: a.display_name,
    slug: a.slug,
    bio: a.bio,
    disciplines: a.disciplines,
    techniques: a.techniques,
    portrait_media_id: a.portrait_media_id,
    commission_available: a.commission_available,
    is_verified: a.is_verified,
  }));

  return res.status(200).json({
    artists: publicArtists,
    count,
    offset: Number(offset) || 0,
    limit: Number(limit) || 20,
  });
}

export { GET };
