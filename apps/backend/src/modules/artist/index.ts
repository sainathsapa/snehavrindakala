import type { ModuleExports } from "@medusajs/types";
import { Module } from "@medusajs/utils";
import { ArtistService } from "./service";
import { Artist } from "./entities/artist";
import { PartnerApplication } from "./entities/partner_application";
import { PartnerAgreement } from "./entities/partner_agreement";

export const ARTIST_MODULE = "artist";

export { Artist, PartnerApplication, PartnerAgreement };
export { ArtistService };

/**
 * The artist module. Models (Artist, PartnerApplication, PartnerAgreement)
 * are auto-registered with MikroORM via ArtistService extending
 * MedusaService({ Artist, PartnerApplication, PartnerAgreement }).
 */
export const artistModule: ModuleExports<typeof ArtistService> = {
  service: ArtistService,
};

export default Module(ARTIST_MODULE, { service: ArtistService });
