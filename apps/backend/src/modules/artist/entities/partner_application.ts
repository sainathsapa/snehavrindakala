/**
 * Partner application entity (plain class).
 */
export class PartnerApplication {
  id!: string;
  artist_id?: string | null;
  applicant_name!: string;
  email!: string;
  phone?: string | null;
  disciplines?: string[] | null;
  portfolio_references?: string[] | null;
  pricing_range?: string | null;
  capacity?: string | null;
  production_times?: string | null;
  packaging_ability?: string | null;
  review_status!: "pending" | "approved" | "rejected";
  reviewer_id?: string | null;
  review_notes?: string | null;
  created_at!: Date;
  updated_at!: Date;

  constructor(data?: Partial<PartnerApplication>) {
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
