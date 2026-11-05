/**
 * Integration event ledger for idempotent webhook processing (plain class).
 */
export type IntegrationEventProcessingState =
  | "received"
  | "processing"
  | "processed"
  | "failed"
  | "dead_letter";

export class IntegrationEvent {
  id!: string;
  provider!: string;
  event_id!: string;
  event_type!: string;
  received_at!: Date;
  payload?: Record<string, any> | null;
  signature_result?: string | null;
  processing_state!: IntegrationEventProcessingState;
  attempt_count!: number;
  last_error?: string | null;
  processed_at?: Date | null;
  updated_at!: Date;

  constructor(data?: Partial<IntegrationEvent>) {
    if (data) {
      Object.assign(this, data);
    }
    if (!this.id) {
      this.id = crypto.randomUUID();
    }
    this.received_at = new Date();
    this.processing_state = this.processing_state ?? "received";
    this.attempt_count = this.attempt_count ?? 0;
    this.updated_at = new Date();
  }
}
