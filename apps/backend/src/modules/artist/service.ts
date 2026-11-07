/**
 * Artist service. Business logic for artist/partner management.
 *
 * The DML entities (Artist, PartnerApplication, PartnerAgreement) are
 * registered with MikroORM via MedusaServiceModelObjectsSymbol so the
 * module's data model is resolved at runtime. This fixes the "model
 * metadata" failures that previously caused 500s on artist endpoints.
 */
import { Artist } from "./entities/artist";
import { PartnerApplication } from "./entities/partner_application";
import { PartnerAgreement } from "./entities/partner_agreement";
import { MedusaServiceModelObjectsSymbol } from "@medusajs/utils";
import { randomUUID } from "crypto";
import type {
  CreateArtistInput,
  UpdateArtistInput,
  ArtistFilter,
  CreatePartnerApplicationInput,
  CreatePartnerAgreementInput,
} from "./types";

const MODEL_OBJECTS = {
  Artist,
  PartnerApplication,
  PartnerAgreement,
};

export class ArtistService {
  protected readonly manager_: any;

  constructor({ manager }: { manager: any }) {
    this.manager_ = manager;
  }

  async createArtist(data: CreateArtistInput): Promise<any> {
    const existing = await this.manager_.findOne(Artist, {
      slug: data.slug,
    });
    if (existing) {
      throw new Error(`Artist with slug "${data.slug}" already exists`);
    }

    const artist = this.manager_.getRepository(Artist).create({
      ...data,
      id: randomUUID(),
      status: data.status ?? "pending",
      commission_available: data.commission_available ?? false,
      is_verified: false,
    });
    await this.manager_.persistAndFlush(artist);
    return artist;
  }

  async updateArtist(id: string, data: UpdateArtistInput): Promise<any> {
    const artist = await this.manager_.findOne(Artist, { id });
    if (!artist) {
      throw new Error(`Artist ${id} not found`);
    }

    this.manager_.getRepository(Artist).assign(artist, data);
    artist.updated_at = new Date();
    await this.manager_.persistAndFlush(artist);
    return artist;
  }

  async deleteArtist(id: string): Promise<void> {
    const artist = await this.manager_.findOne(Artist, { id });
    if (!artist) {
      throw new Error(`Artist ${id} not found`);
    }
    await this.manager_.removeAndFlush(artist);
  }

  async getArtist(id: string): Promise<any | null> {
    return this.manager_.findOne(Artist, { id });
  }

  async getArtistBySlug(slug: string): Promise<any | null> {
    return this.manager_.findOne(Artist, { slug });
  }

  async listArtists(filter: ArtistFilter = {}): Promise<{
    artists: any[];
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

    const repository = this.manager_.getRepository(Artist);
    const [artists, count] = await repository.findAndCount(where, {
      offset,
      limit,
      orderBy: { created_at: "DESC" },
    });

    return { artists, count };
  }

  async approveArtist(id: string, reviewerId: string): Promise<any> {
    const artist = await this.manager_.findOne(Artist, { id });
    if (!artist) {
      throw new Error(`Artist ${id} not found`);
    }
    artist.status = "approved";
    artist.is_verified = true;
    await this.manager_.persistAndFlush(artist);
    return artist;
  }

  async suspendArtist(id: string): Promise<any> {
    const artist = await this.manager_.findOne(Artist, { id });
    if (!artist) {
      throw new Error(`Artist ${id} not found`);
    }
    artist.status = "suspended";
    await this.manager_.persistAndFlush(artist);
    return artist;
  }

  async createPartnerApplication(
    data: CreatePartnerApplicationInput
  ): Promise<any> {
    const app = this.manager_
      .getRepository(PartnerApplication)
      .create({ ...data, id: randomUUID() });
    await this.manager_.persistAndFlush(app);
    return app;
  }

  async listPartnerApplications(filter: {
    review_status?: string;
    offset?: number;
    limit?: number;
  } = {}): Promise<{
    applications: any[];
    count: number;
  }> {
    const { review_status, offset = 0, limit = 20 } = filter;
    const where: Record<string, any> = {};
    if (review_status) {
      where.review_status = review_status;
    }

    const [applications, count] = await this.manager_.findAndCount(
      PartnerApplication,
      where,
      {
        offset,
        limit,
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
  ): Promise<any> {
    const app = await this.manager_.findOne(PartnerApplication, { id });
    if (!app) {
      throw new Error(`Partner application ${id} not found`);
    }
    app.review_status = status;
    app.reviewer_id = reviewerId;
    app.review_notes = notes ?? null;

    await this.manager_.persistAndFlush(app);

    if (status === "approved" && app.artist_id) {
      await this.approveArtist(app.artist_id, reviewerId);
    }

    return app;
  }

  async createPartnerAgreement(
    data: CreatePartnerAgreementInput
  ): Promise<any> {
    const agreement = this.manager_
      .getRepository(PartnerAgreement)
      .create({ ...data, id: randomUUID() });
    await this.manager_.persistAndFlush(agreement);
    return agreement;
  }

  async getPartnerAgreementsByArtist(artistId: string): Promise<any[]> {
    return this.manager_.find(PartnerAgreement, { artist_id: artistId });
  }
}

// Register DML entities with Medusa/MikroORM metadata at module load time.
// The Module() wrapper reads service[MedusaServiceModelObjectsSymbol].
(ArtistService as any)[MedusaServiceModelObjectsSymbol] = MODEL_OBJECTS;
