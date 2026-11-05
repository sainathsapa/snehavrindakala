import { Entity, Property } from "@mikro-orm/core";

/**
 * Artist domain model.
 * Public profile data is exposed through controlled API; private business
 * fields remain internal.
 */
@Entity({ tableName: "artist" })
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
