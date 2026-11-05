import { MedusaService } from "@medusajs/medusa";
import { Artist } from "./models/artist";

export class ArtistService extends MedusaService({
  Artist,
}) {
  async getPublicArtists() {
    return this.find({ where: { status: "approved" } });
  }

  async getArtistBySlug(slug: string) {
    return this.findOne({ where: { slug } });
  }
}
