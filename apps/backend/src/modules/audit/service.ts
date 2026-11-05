import { AuditRecord } from "./entities/audit_record";
import type { CreateAuditRecordInput } from "./types";

export class AuditService {
  protected readonly manager_: any;

  constructor({ manager }: { manager: any }) {
    this.manager_ = manager;
  }

  async record(data: CreateAuditRecordInput): Promise<AuditRecord> {
    const record = new AuditRecord(data);
    return this.manager_.persistAndFlush(record);
  }

  async list(filter: {
    entity?: string;
    entity_id?: string;
    actor?: string;
    action?: string;
    offset?: number;
    limit?: number;
  } = {}): Promise<{ records: AuditRecord[]; count: number }> {
    const { entity, entity_id, actor, action, offset = 0, limit = 50 } = filter;
    const where: Record<string, any> = {};
    if (entity) where.entity = entity;
    if (entity_id) where.entity_id = entity_id;
    if (actor) where.actor = actor;
    if (action) where.action = action;

    const [records, count] = await this.manager_.findAndCount(AuditRecord, {
      where,
      skip: offset,
      take: limit,
      orderBy: { timestamp: "DESC" },
    });

    return { records, count };
  }
}
