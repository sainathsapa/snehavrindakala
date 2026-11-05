/**
 * Commission request entity (plain class).
 * Follows the strict status state machine (build plan Section 11.3).
 */
export type CommissionStatus =
  | "New"
  | "Needs clarification"
  | "Feasibility review"
  | "Awaiting artist/capacity"
  | "Quote drafted"
  | "Quote sent"
  | "Awaiting payment"
  | "Accepted"
  | "In production"
  | "Proof review"
  | "Approved"
  | "Ready to dispatch"
  | "Shipped"
  | "Completed"
  | "Declined"
  | "Cancelled"
  | "On hold"
  | "Expired"
  | "Refund pending"
  | "Refunded"
  | "Disputed";

export const COMMISSION_TRANSITIONS: Record<CommissionStatus, CommissionStatus[]> = {
  New: ["Needs clarification", "Feasibility review", "Declined", "Expired"],
  "Needs clarification": ["Feasibility review", "New", "Declined"],
  "Feasibility review": ["Awaiting artist/capacity", "Needs clarification", "Declined"],
  "Awaiting artist/capacity": ["Quote drafted", "Declined", "On hold"],
  "Quote drafted": ["Quote sent", "Declined"],
  "Quote sent": ["Awaiting payment", "Expired", "Declined"],
  "Awaiting payment": ["Accepted", "Expired", "Declined", "Refund pending"],
  Accepted: ["In production", "Cancelled", "Refund pending"],
  "In production": ["Proof review", "On hold", "Cancelled"],
  "Proof review": ["Approved", "In production", "Cancelled"],
  Approved: ["Ready to dispatch", "On hold"],
  "Ready to dispatch": ["Shipped", "On hold"],
  Shipped: ["Completed", "Refund pending"],
  Completed: ["Refund pending"],
  Declined: ["New"],
  Cancelled: ["New"],
  "On hold": ["Awaiting artist/capacity", "In production", "Cancelled"],
  Expired: ["New"],
  "Refund pending": ["Refunded", "Declined"],
  Refunded: [],
  Disputed: ["Refund pending", "Completed"],
};

export class CommissionRequest {
  id!: string;
  reference_id!: string;
  customer_id?: string | null;
  art_form!: string;
  brief!: string;
  intended_use?: string | null;
  dimensions?: string | null;
  budget_range?: string | null;
  target_date?: Date | null;
  delivery_region?: string | null;
  delivery_pin?: string | null;
  status!: CommissionStatus;
  assigned_artist_id?: string | null;
  metadata?: Record<string, any> | null;
  created_at!: Date;
  updated_at!: Date;

  constructor(data?: Partial<CommissionRequest>) {
    if (data) {
      Object.assign(this, data);
    }
    if (!this.id) {
      this.id = crypto.randomUUID();
    }
    if (!this.reference_id) {
      this.reference_id = `COM-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    }
    this.status = this.status ?? "New";
    this.created_at = this.created_at || new Date();
    this.updated_at = new Date();
  }

  static canTransition(from: CommissionStatus, to: CommissionStatus): boolean {
    const allowed = COMMISSION_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }
}
