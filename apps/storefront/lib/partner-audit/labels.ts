/**
 * Pure presentation labels for canonical partner audit actions (A77).
 *
 * Lives outside `app/partner/audit/page.tsx` because Next.js validates Page
 * module exports at build time: only default, metadata and a fixed set of
 * framework exports are allowed. A named helper export makes `next build`
 * fail with `"formatAuditActionLabel" is not a valid Page export field`.
 *
 * Keys are the stable upper-snake action codes stored in `partner_audit_log`.
 */
const ACTION_LABELS: Record<string, string> = {
  MEMBER_INVITED: "Member invited",
  MEMBER_ROLE_CHANGED: "Member role changed",
  MEMBER_SUSPENDED: "Member suspended",
  SESSIONS_REVOKED: "Sessions revoked",
  PROFILE_UPDATED: "Business profile updated",
  PRODUCT_SUBMITTED: "Product submitted",
  ORDER_ACCEPTED: "Order accepted",
  ORDER_REJECTED: "Order rejected",
  ORDER_FULFILLED: "Order fulfilled",
  SETTLEMENT_VIEWED: "Settlement viewed",
};

/**
 * Turn a raw audit action code into a display label. Known actions get a
 * friendly label; unknown/custom actions are humanised (never blanked) so a
 * newly introduced action is still visible in the trail.
 */
export function formatAuditActionLabel(action: string): string {
  const code = (action ?? "").trim();
  if (ACTION_LABELS[code]) return ACTION_LABELS[code];
  if (!code) return "Unknown action";
  return code
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
