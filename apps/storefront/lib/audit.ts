/**
 * Unified admin audit trail.
 *
 * Every privileged mutation should record who did what, to which entity, and
 * when. The `audit_log` table is created by db/schema.sql at boot (not lazily
 * from a request handler). Audit writes are best-effort: a failed audit insert
 * is logged but never rolls back the business operation, and never leaks the
 * failure to the caller as a confusing 500.
 */

import { query } from "./db";

export interface AdminAuditInput {
  actorEmail: string;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: unknown;
  newValues?: unknown;
}

export async function recordAdminAction(input: AdminAuditInput): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_log
         (entity_type, entity_id, action, old_values, new_values, user_email, user_role, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
      [
        input.entityType,
        input.entityId,
        input.action,
        input.oldValues == null ? null : JSON.stringify(input.oldValues),
        input.newValues == null ? null : JSON.stringify(input.newValues),
        input.actorEmail,
        input.actorRole ?? null,
      ]
    );
  } catch (err) {
    console.error("[audit] failed to record admin action", {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
