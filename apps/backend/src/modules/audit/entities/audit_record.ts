/**
 * Audit record for security-sensitive operations (plain class).
 */
export class AuditRecord {
  id!: string;
  actor!: string;
  actor_role?: string | null;
  action!: string;
  entity!: string;
  entity_id!: string;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  request_correlation_id?: string | null;
  timestamp!: Date;

  constructor(data?: Partial<AuditRecord>) {
    if (data) {
      Object.assign(this, data);
    }
    if (!this.id) {
      this.id = crypto.randomUUID();
    }
    this.timestamp = new Date();
  }
}
