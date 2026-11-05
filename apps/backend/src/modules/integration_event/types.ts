export interface CreateIntegrationEventInput {
  provider: string;
  event_id: string;
  event_type: string;
  received_at?: Date;
  payload?: Record<string, any>;
  signature_result?: string;
  processing_state?: "received" | "processing" | "processed" | "failed" | "dead_letter";
  attempt_count?: number;
  last_error?: string;
}
