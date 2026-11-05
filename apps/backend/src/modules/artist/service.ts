import { Artist, ArtistInput, ArtistUpdate } from "./models/artist";

export type { ArtistInput, ArtistUpdate };

/**
 * Artist service. In a Medusa v2 module this service is registered through
 * ModuleExports and Medusa provides the data-access layer (retrieve/list/
 * create/update/delete) backed by PostgreSQL.
 */
export class ArtistService {
  // In-memory placeholder for the scaffold. Medusa v2 wires the real
  // repository/data-access layer when the module is loaded.
  private artists: Map<string, Artist> = new Map();

  async create(data: ArtistInput): Promise<Artist> {
    const id = data.id ?? `artist_${Date.now()}`;
    const now = new Date();
    const artist: Artist = {
      id,
      created_at: now,
      updated_at: now,
      ...data,
    } as Artist;
    this.artists.set(id, artist);
    return artist;
  }

  async findOne(selector: Record<string, unknown>): Promise<Artist | null> {
    const all = await this.list(selector);
    return all.length ? all[0] : null;
  }

  async list(selector: Record<string, unknown> = {}): Promise<Artist[]> {
    return Array.from(this.artists.values()).filter((a) => {
      return Object.entries(selector).every(([k, v]) => {
        return (a as any)[k] === v;
      });
    });
  }

  async update(id: string, data: ArtistUpdate): Promise<Artist | null> {
    const existing = this.artists.get(id);
    if (!existing) return null;
    const updated: Artist = { ...existing, ...data, updated_at: new Date() };
    this.artists.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.artists.delete(id);
  }

  async getPublicArtists(): Promise<Artist[]> {
    return this.list({ status: "approved" });
  }

  async getArtistBySlug(slug: string): Promise<Artist | null> {
    return this.findOne({ slug });
  }
}
