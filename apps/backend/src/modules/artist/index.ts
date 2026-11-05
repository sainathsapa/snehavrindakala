import type { ModuleExports } from "@medusajs/types";
import { ArtistService } from "./service";
import { Artist } from "./models/artist";

export const ARTIST_MODULE = "artist";

export const artistModule: ModuleExports<typeof ArtistService> = {
  service: ArtistService,
};

export { ArtistService, Artist };
