import type { ModuleExports } from "@medusajs/types";
import { ArtistService } from "./service";
import { Artist } from "./entities/artist";
import { PartnerApplication } from "./entities/partner_application";
import { PartnerAgreement } from "./entities/partner_agreement";

export const ARTIST_MODULE = "artist";

export const artistModule: ModuleExports<typeof ArtistService> = {
  service: ArtistService,
};

export { ArtistService, Artist, PartnerApplication, PartnerAgreement };
