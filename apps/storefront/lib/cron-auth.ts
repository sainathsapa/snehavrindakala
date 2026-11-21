/**
 * Shared secret for machine-triggered routes (cron, deploy hooks).
 *
 * The alternative — leaving an endpoint open and hoping nobody finds it — is how
 * an abandoned-cart mailer becomes a spam relay. When the secret is unset the
 * answer is "refuse", not "allow": an endpoint that quietly opens itself because
 * a variable is missing is worse than one that fails loudly.
 */

export interface CronAuthResult {
  ok: boolean;
  /** Why not, in words an operator can act on. */
  reason?: string;
}

/**
 * Pure so it can be tested without a request: accepts `Authorization: Bearer
 * <secret>` and `?secret=<secret>` (cron jobs on shared hosts often cannot set
 * headers), and compares in constant time.
 */
export function authoriseCron(params: {
  secret: string | undefined;
  authorization?: string | null;
  querySecret?: string | null;
}): CronAuthResult {
  const secret = (params.secret ?? "").trim();
  if (!secret) {
    return {
      ok: false,
      reason:
        "CRON_SECRET is not set, so scheduled routes are disabled. Set it and call again with the same value.",
    };
  }

  const header = params.authorization ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  const candidate = bearer || (params.querySecret ?? "").trim();

  if (!candidate) {
    return { ok: false, reason: "Missing credentials." };
  }
  if (!timingSafeEqual(candidate, secret)) {
    return { ok: false, reason: "Wrong credentials." };
  }
  return { ok: true };
}

/**
 * Constant-time compare. Length differences leak, which is acceptable here (the
 * secret's length is not the secret), but the byte comparison should not stop at
 * the first mismatch.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index++) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}
