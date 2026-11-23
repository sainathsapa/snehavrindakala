/**
 * Single source of truth for the admin-session HMAC secret.
 *
 * This module is Edge-safe (env reads only, no Node crypto) so the same secret
 * chain is used by:
 *   - lib/admin-session.ts   (Node: sign + verify, used by /api/admin/login and actions)
 *   - middleware.ts          (Edge: verify the cookie before an admin page loads)
 *
 * Before this existed the Node helper signed with COOKIE_SECRET/JWT_SECRET while
 * the Edge middleware verified with a never-set ADMIN_SESSION_SECRET, so every
 * valid session was rejected at the gate and the middleware silently degraded
 * to "any non-empty medusa_auth_token cookie" — a bypass. One chain fixes both.
 *
 * Production fails closed: if no secret is configured we throw rather than fall
 * back to a value an attacker can know. Development/tests use a clearly-insecure
 * constant so the local app and the unit suite still run without configuration.
 */

const DEV_ONLY_SECRET = "svk-dev-only-insecure-do-not-use-in-production";

export function getAdminSessionSecret(): string {
  // Only the two secrets that actually exist in the deployment. The old
  // middleware read ADMIN_SESSION_SECRET, which was set nowhere — that mismatch
  // is the bug this module exists to prevent.
  const secret = process.env.COOKIE_SECRET || process.env.JWT_SECRET || "";

  if (secret.length > 0) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Admin session secret is not configured. Set COOKIE_SECRET (preferred) " +
        "or JWT_SECRET before starting the app in production."
    );
  }

  return DEV_ONLY_SECRET;
}
