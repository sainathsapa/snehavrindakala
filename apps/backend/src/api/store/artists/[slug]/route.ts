import type { MedusaRequest, MedusaResponse } from "@medusajs/types";
import type { ArtistService } from "../../../../modules/artist/service";

/**
 * GET /store/artists/:slug
 * Get a public artist profile by slug.
 */
async function GET(req: MedusaRequest, res: MedusaResponse) {
  const artistService = req.scope.resolve(
    "artistModuleService"
  ) as ArtistService;
  const { slug } = req.params as { slug: string };

  const artist = await artistService.getArtistBySlug(slug);
  if (!artist) {
    return res.status(404).json({ error: "Artist not found" });
  }

  // Public-safe projection
  return res.status(200).json({
    artist: {
      id: artist.id,
      display_name: artist.display_name,
      slug: artist.slug,
      bio: artist.bio,
      disciplines: artist.disciplines,
      techniques: artist.techniques,
      portrait_media_id: artist.portrait_media_id,
      commission_available: artist.commission_available,
      is_verified: artist.is_verified,
    },
  });
}

export { GET };
