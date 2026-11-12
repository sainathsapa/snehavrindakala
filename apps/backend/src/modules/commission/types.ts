/**
 * Commission module input/output types.
 */

export interface CreateCommissionRequestInput {
  reference_id?: string;
  customer_id?: string;
  /**
   * Contact address for acknowledgements. Not persisted on the request — it is
   * carried through to the notification subscriber only.
   */
  customer_email?: string;
  art_form: string;
  brief: string;
  intended_use?: string;
  dimensions?: string;
  budget_range?: string;
  target_date?: Date;
  delivery_region?: string;
  delivery_pin?: string;
  status?: "New";
  assigned_artist_id?: string;
  metadata?: Record<string, any>;
}

export interface UpdateCommissionRequestInput {
  art_form?: string;
  brief?: string;
  intended_use?: string;
  dimensions?: string;
  budget_range?: string;
  target_date?: Date;
  delivery_region?: string;
  delivery_pin?: string;
  assigned_artist_id?: string;
  metadata?: Record<string, any>;
}

export interface CreateCommissionAttachmentInput {
  commission_request_id: string;
  object_key: string;
  mime_type: string;
  size_bytes: number;
  original_filename?: string;
  retention_delete_at?: Date;
}

export interface CreateCommissionQuoteInput {
  commission_request_id: string;
  version?: number;
  scope: string;
  deliverables?: string;
  total_minor: number;
  tax_minor?: number;
  fee_share_minor?: number;
  deposit_rules?: Record<string, any>;
  milestone_schedule?: Record<string, any>;
  expiry_at?: Date;
  medusa_order_id?: string;
}

export interface UpdateCommissionQuoteInput {
  scope?: string;
  deliverables?: string;
  total_minor?: number;
  tax_minor?: number;
  fee_share_minor?: number;
  deposit_rules?: Record<string, any>;
  milestone_schedule?: Record<string, any>;
  status?: "draft" | "sent" | "accepted" | "expired" | "declined";
  expiry_at?: Date;
  medusa_order_id?: string;
}

export interface CreateCommissionMilestoneInput {
  commission_request_id: string;
  commission_quote_id?: string;
  name: string;
  sequence: number;
  description?: string;
  due_date?: Date;
  status?: "pending" | "in_progress" | "proof_submitted" | "approved" | "rejected" | "completed";
  proof_object_key?: string;
  approval_record?: Record<string, any>;
}

export interface UpdateCommissionMilestoneInput {
  name?: string;
  sequence?: number;
  description?: string;
  due_date?: Date;
  status?: "pending" | "in_progress" | "proof_submitted" | "approved" | "rejected" | "completed";
  proof_object_key?: string;
  approval_record?: Record<string, any>;
}

export interface CreateCommissionRevisionInput {
  commission_request_id: string;
  milestone_id: string;
  revision_number?: number;
  customer_brief?: string;
  artist_response?: string;
  approval_record?: Record<string, any>;
}
