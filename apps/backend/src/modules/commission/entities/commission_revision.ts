/**
 * Commission revision tracking customer briefs and artist responses (plain class).
 */
export class CommissionRevision {
  id!: string;
  commission_request_id!: string;
  milestone_id!: string;
  revision_number!: number;
  customer_brief?: string | null;
  artist_response?: string | null;
  approval_record?: Record<string, any> | null;
  created_at!: Date;
  updated_at!: Date;

  constructor(data?: Partial<CommissionRevision>) {
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
