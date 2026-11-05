/**
 * Commission milestone with proof upload and approval tracking (plain class).
 */
export type MilestoneStatus =
  | "pending"
  | "in_progress"
  | "proof_submitted"
  | "approved"
  | "rejected"
  | "completed";

export class CommissionMilestone {
  id!: string;
  commission_request_id!: string;
  commission_quote_id?: string | null;
  name!: string;
  sequence!: number;
  description?: string | null;
  due_date?: Date | null;
  status!: MilestoneStatus;
  proof_object_key?: string | null;
  approval_record?: Record<string, any> | null;
  created_at!: Date;
  updated_at!: Date;

  constructor(data?: Partial<CommissionMilestone>) {
    if (data) {
      Object.assign(this, data);
    }
    if (!this.id) {
      this.id = crypto.randomUUID();
    }
    this.status = this.status ?? "pending";
    this.created_at = this.created_at || new Date();
    this.updated_at = new Date();
  }
}
