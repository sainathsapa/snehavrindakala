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
export class ArtistService {
  protected readonly manager_: any;

  constructor({ manager }: { manager: any }) {
    this.manager_ = manager;
  }

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
    return this.manager_.findOne(Artist, { id });
  }

  async getArtistBySlug(slug: string): Promise<Artist | null> {
    return this.manager_.findOne(Artist, { slug });
  }

  async listArtists(filter: ArtistFilter = {}): Promise<{
    artists: Artist[];
    count: number;
  }> {
    const { offset = 0, limit = 20, status, q } = filter;
    const where: Record<string, any> = {};
    if (status) {
      where.status = status;
    }
    if (q) {
      where.$or = [
        { display_name: { $ilike: `%${q}%` } },
        { slug: { $ilike: `%${q}%` } },
      ];
    }

    const [artists, count] = await this.manager_.findAndCount(Artist, {
      where,
      skip: offset,
      take: limit,
      orderBy: { created_at: "DESC" },
    });

    return { artists, count };
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

  async listPartnerApplications(filter: {
    review_status?: string;
    offset?: number;
    limit?: number;
  } = {}): Promise<{
    applications: PartnerApplication[];
    count: number;
  }> {
    const { review_status, offset = 0, limit = 20 } = filter;
    const where: Record<string, any> = {};
    if (review_status) {
      where.review_status = review_status;
    }

    const [applications, count] = await this.manager_.findAndCount(
      PartnerApplication,
      {
        where,
        skip: offset,
        take: limit,
        orderBy: { created_at: "DESC" },
      }
    );

    return { applications, count };
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
