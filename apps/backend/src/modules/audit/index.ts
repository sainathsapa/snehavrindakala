import type { ModuleExports } from "@medusajs/types";
import { Module } from "@medusajs/utils";
import { AuditService } from "./service";

export const AUDIT_MODULE = "audit";

export { AuditRecord } from "./entities/audit_record";
export { AuditService };

/**
 * The audit module. DML entities are auto-registered with MikroORM via
 * AuditService extending MedusaService({ AuditRecord }).
 */
export const auditModule: ModuleExports<typeof AuditService> = {
  service: AuditService,
};

export default Module(AUDIT_MODULE, { service: AuditService });
