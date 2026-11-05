import type { ModuleExports } from "@medusajs/types";
import { AuditService } from "./service";

export const AUDIT_MODULE = "audit";

export const auditModule: ModuleExports<typeof AuditService> = {
  service: AuditService,
};

export { AuditService };
