import type { MedusaRequest, MedusaResponse } from "@medusajs/types";
import type { ArtistService } from "../../../../../modules/artist/service";

/**
 * PATCH /admin/artists/[id]/toggle-status
 *
 * Enables or disables a partner/artist by flipping their status between
 * "approved" and "suspended". When suspended, the partner is hidden from
 * public discovery and cannot accept new commissions or orders.
 *
 * Integration boundary: resolves artistModuleService from the Medusa
 * container. Returns 501 documenting what is required until the module is
 * wired.
 */

export async function PATCH(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const { id } = req.params as unknown as { id: string };
  const body = (req.body as unknown) as { enabled?: boolean };

  const artistService = req.scope.resolve(
    "artist"
  ) as ArtistService;

  if (!artistService) {
    res.status(501).json({
      error:
        "Partner management not wired. Resolve artistModuleService in the Medusa container.",
    });
    return;
  }

  try {
    const artist = await artistService.getArtist(id);
    if (!artist) {
      res.status(404).json({ error: `Artist ${id} not found` });
      return;
    }

    const targetStatus = body.enabled === false ? "suspended" : "approved";

    const updated = await artistService.updateArtist(id, {
      status: targetStatus as any,
    });

    res.status(200).json({
      artist: {
        id: updated.id,
        display_name: updated.display_name,
        slug: updated.slug,
        status: updated.status,
        enabled: updated.status === "approved",
      },
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to update artist status.",
    });
  }
  return;
}
