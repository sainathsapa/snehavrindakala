/**
 * Partner member authentication.
 *
 * This is a dedicated auth context: a partner membership is neither a Medusa
 * customer nor a platform admin. Credentials are checked against the membership
 * row and the parent partner account, and success issues a signed partner
 * session token (see `lib/partner/session.ts`).
 *
 * Every failure path returns the same `null`. The caller must not be able to
 * tell whether the address was unknown, the password wrong, the member
 * suspended or the partner account suspended — they all get one generic error.
 */

import { query as defaultQuery } from "@/lib/db";
import { verifyPassword } from "@/lib/partner/password";
import {
  findMembershipByEmail,
  findPartnerById,
  type QueryExecutor,
} from "@/lib/partner/repository";
import { signPartnerSession } from "@/lib/partner/session";
import { isPartnerRole } from "@/lib/partner/types";

/**
 * Authenticate a partner member and return a signed session token.
 * Returns `null` on any failure, without distinguishing the reason.
 *
 * @param executor optional query executor (tests inject a fake; production
 *   falls back to the shared `query` from `@/lib/db`).
 */
export async function authenticatePartnerMember(
  email: unknown,
  password: unknown,
  executor?: QueryExecutor
): Promise<string | null> {
  try {
    if (typeof email !== "string" || typeof password !== "string") return null;
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) return null;

    const run: QueryExecutor = executor ?? defaultQuery;

    const membership = await findMembershipByEmail(normalizedEmail, run);
    // One uniform failure surface for unknown addresses, bad passwords,
    // invited/suspended members and impossible role values.
    if (
      !membership ||
      membership.status !== "active" ||
      !isPartnerRole(membership.role)
    ) {
      return null;
    }

    if (
      typeof membership.password_hash !== "string" ||
      !verifyPassword(password, membership.password_hash)
    ) {
      return null;
    }

    // A suspended/rejected partner cannot sign in even with correct credentials.
    const partner = await findPartnerById(String(membership.partner_id), run);
    if (!partner || partner.account_status !== "active") return null;

    // Bookkeeping only. A failed last_login_at write must never turn an
    // otherwise valid login into a 401.
    try {
      await run(
        "UPDATE partner_membership SET last_login_at = now(), updated_at = now() WHERE id = $1",
        [membership.id]
      );
    } catch (error) {
      console.error("[partner-auth] could not record last_login_at", error);
    }

    return signPartnerSession({
      partnerId: membership.partner_id,
      membershipId: membership.id,
      role: membership.role,
      tokenVersion: membership.token_version,
      email: membership.email,
    });
  } catch {
    // DB errors, malformed rows, secret misconfiguration — all fail closed and
    // all look identical to the caller.
    return null;
  }
}
