/**
 * Commission request entity. Follows the status state machine defined in the
 * build plan (Section 11.3).
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

export class CommissionRequest {
  id!: string;
  customer_id!: string;
  reference_id!: string;
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
  created_at!: Date;
  updated_at!: Date;
}

export type CommissionRequestInput = Partial<
  Omit<CommissionRequest, "id" | "created_at" | "updated_at">
> & { id?: string };
