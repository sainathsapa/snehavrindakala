/**
 * Medusa's module loader discovers MikroORM entities from the `models/`
 * directory. Re-export the DML entity so the module's own manager registers
 * its metadata.
 */
export { AuditRecord } from "../entities/audit_record";
