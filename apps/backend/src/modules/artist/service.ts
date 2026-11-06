import { MedusaService } from "@medusajs/utils";
import { Artist } from "./entities/artist";
import { PartnerApplication } from "./entities/partner_application";
import { PartnerAgreement } from "./entities/partner_agreement";
import type {
  CreateArtistInput,
  UpdateArtistInput,
  ArtistFilter,
  CreatePartnerApplicationInput,
  CreatePartnerAgreementInput,
} from "./types";

/**
 * Artist service. Business logic for artist/partner management.
 * Medusa injects the EntityManager for data access.
 */

export class ArtistService extends MedusaService({
  Artist,
  PartnerApplication,
  PartnerAgreement,
}) {
  protected readonly manager_: any;

  async createArtist(data: CreateArtistInput): Promise<Artist> {
    const existing = await this.manager_.findOne(Artist, {
      slug: data.slug,
    });
    if (existing) {
      throw new Error(`Artist with slug "${data.slug}" already exists`);
    }

    const artist = new Artist({
      ...data,
      status: data.status ?? "pending",
      commission_available: data.commission_available ?? false,
      is_verified: false,
    });
    return this.manager_.persistAndFlush(artist);
  }

  async updateArtist(id: string, data: UpdateArtistInput): Promise<Artist> {
    const artist = await this.manager_.findOne(Artist, { id });
    if (!artist) {
      throw new Error(`Artist ${id} not found`);
    }

    Object.assign(artist, data);
    artist.updated_at = new Date();
    return this.manager_.persistAndFlush(artist);
  }

  async deleteArtist(id: string): Promise<void> {
    const artist = await this.manager_.findOne(Artist, { id });
    if (!artist) {
      throw new Error(`Artist ${id} not found`);
    }
    await this.manager_.removeAndFlush(artist);
  }

  async getArtist(id: string): Promise<Artist | null> {
    try {
      return await (this as any).retrieveArtist(id);
    } catch {
      return null;
    }
  }

  async getArtistBySlug(slug: string): Promise<Artist | null> {
    const artists = await (this as any).listArtists({ slug }, { take: 1 });
    return artists?.[0] ?? null;
  }

  async approveArtist(id: string, reviewerId: string): Promise<Artist> {
    const artist = await this.manager_.findOne(Artist, { id });
    if (!artist) {
      throw new Error(`Artist ${id} not found`);
    }
    artist.status = "approved";
    artist.is_verified = true;
    return this.manager_.persistAndFlush(artist);
  }

  async suspendArtist(id: string): Promise<Artist> {
    const artist = await this.manager_.findOne(Artist, { id });
    if (!artist) {
      throw new Error(`Artist ${id} not found`);
    }
    artist.status = "suspended";
    return this.manager_.persistAndFlush(artist);
  }

  async createPartnerApplication(
    data: CreatePartnerApplicationInput
  ): Promise<PartnerApplication> {
    const app = new PartnerApplication(data);
    return this.manager_.persistAndFlush(app);
  }

  async reviewPartnerApplication(
    id: string,
    status: "approved" | "rejected",
    reviewerId: string,
    notes?: string
  ): Promise<PartnerApplication> {
    const app = await this.manager_.findOne(PartnerApplication, { id });
    if (!app) {
      throw new Error(`Partner application ${id} not found`);
    }
    app.review_status = status;
    app.reviewer_id = reviewerId;
    app.review_notes = notes ?? null;

    const updated = await this.manager_.persistAndFlush(app);

    if (status === "approved" && app.artist_id) {
      await this.approveArtist(app.artist_id, reviewerId);
    }

    return updated;
  }

  async createPartnerAgreement(
    data: CreatePartnerAgreementInput
  ): Promise<PartnerAgreement> {
    const agreement = new PartnerAgreement(data);
    return this.manager_.persistAndFlush(agreement);
  }

  async getPartnerAgreementsByArtist(artistId: string): Promise<PartnerAgreement[]> {
    return this.manager_.find(PartnerAgreement, { artist_id: artistId });
  }
}
