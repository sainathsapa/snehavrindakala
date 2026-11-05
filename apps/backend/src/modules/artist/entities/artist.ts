/**
 * Artist domain entity (plain class, no ORM decorator dependency).
 * Medusa v2 modules manage persistence through their data layer.
 */
export class Artist {
  id!: string;
  display_name!: string;
  slug!: string;
  bio?: string | null;
  disciplines?: string[] | null;
  techniques?: string[] | null;
  region?: string | null;
  portrait_media_id?: string | null;
  contact_email?: string | null;
  phone?: string | null;
  status!: "pending" | "approved" | "suspended";
  commission_available!: boolean;
  is_verified!: boolean;
  created_at!: Date;
  updated_at!: Date;

  constructor(data?: Partial<Artist>) {
    if (data) {
      Object.assign(this, data);
    }
    if (!this.id) {
      this.id = crypto.randomUUID();
    }
    this.created_at = this.created_at || new Date();
    this.updated_at = new Date();
  }
}
