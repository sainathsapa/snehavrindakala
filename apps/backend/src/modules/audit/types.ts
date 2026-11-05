export interface CreateAuditRecordInput {
  actor: string;
  actor_role?: string;
  action: string;
  entity: string;
  entity_id: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
  request_correlation_id?: string;
}
