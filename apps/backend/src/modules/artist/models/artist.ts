/**
 * Artist domain entity.
 * Public profile data is exposed through controlled API; private business
 * fields remain internal. Medusa manages persistence; this is the entity
 * shape custom modules expose.
 */
export class Artist {
  id!: string;
  display_name!: string;
  slug!: string;
  bio?: string | null;
  disciplines?: string[] | null;
  techniques?: string[] | null;
  region?: string | null; // only if consented
  portrait_media_id?: string | null;
  status!: "pending" | "approved" | "suspended";
  commission_available!: boolean;
  created_at!: Date;
  updated_at!: Date;
}

export type ArtistInput = Partial<
  Omit<Artist, "id" | "created_at" | "updated_at">
> & { id?: string };

export type ArtistUpdate = Partial<
  Omit<Artist, "id" | "created_at">
>;
