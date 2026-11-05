import type { MedusaRequest, MedusaResponse } from "@medusajs/types";
import type { AuditService } from "../../../modules/audit/service";

/**
 * GET /admin/audit
 * List audit records (security/compliance view).
 */
async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auditService = req.scope.resolve(
    "auditModuleService"
  ) as AuditService;

  const { entity, entity_id, actor, action, offset, limit } = req.query as unknown as {
    entity?: string;
    entity_id?: string;
    actor?: string;
    action?: string;
    offset?: string;
    limit?: string;
  };

  const { records, count } = await auditService.list({
    entity,
    entity_id,
    actor,
    action,
    offset: offset ? Number(offset) : 0,
    limit: limit ? Number(limit) : 50,
  });

  return res.status(200).json({
    audit_records: records,
    count,
    offset: Number(offset) || 0,
    limit: Number(limit) || 50,
  });
}

export { GET };
