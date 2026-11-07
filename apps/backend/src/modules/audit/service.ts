/**
 * Audit service. Security-sensitive operation records (DML).
 *
 * DML entities are registered with MikroORM via
 * MedusaServiceModelObjectsSymbol.
 */
import { AuditRecord } from "./entities/audit_record";
import { MedusaServiceModelObjectsSymbol } from "@medusajs/utils";
import { randomUUID } from "crypto";
import type { CreateAuditRecordInput } from "./types";

const MODEL_OBJECTS = {
  AuditRecord,
};

export class AuditService {
  protected readonly manager_: any;

  constructor({ manager }: { manager: any }) {
    this.manager_ = manager;
  }

  async record(data: CreateAuditRecordInput): Promise<any> {
    const record = this.manager_
      .getRepository(AuditRecord)
      .create({ ...data, id: randomUUID(), timestamp: new Date() });
    await this.manager_.persistAndFlush(record);
    return record;
  }

  async list(filter: {
    entity?: string;
    entity_id?: string;
    actor?: string;
    action?: string;
    offset?: number;
    limit?: number;
  } = {}): Promise<{ records: any[]; count: number }> {
    const { entity, entity_id, actor, action, offset = 0, limit = 50 } =
      filter;
    const where: Record<string, any> = {};
    if (entity) where.entity = entity;
    if (entity_id) where.entity_id = entity_id;
    if (actor) where.actor = actor;
    if (action) where.action = action;

    const [records, count] = await this.manager_.findAndCount(
      AuditRecord,
      where,
      {
        offset,
        limit,
        orderBy: { timestamp: "DESC" },
      }
    );

    return { records, count };
  }
}

// Register DML entities with Medusa/MikroORM metadata at module load time.
(AuditService as any)[MedusaServiceModelObjectsSymbol] = MODEL_OBJECTS;
