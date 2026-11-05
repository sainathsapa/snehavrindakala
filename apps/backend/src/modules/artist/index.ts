import type { Module } from "@medusajs/framework/types";
import { ArtistService } from "./service";
import { Artist } from "./models/artist";

export const ARTIST_MODULE = "artist";

export const artistModule: Module = {
  name: ARTIST_MODULE,
  service: ArtistService,
  models: [Artist],
};

export { ArtistService, Artist };
