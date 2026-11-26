/**
 * Production start-up configuration gate.
 *
 * A deployment can boot with a half-configured environment and still serve
 * pages: checkout silently falls back, e-mail is logged as skipped, and the
 * admin session secret quietly uses a value an attacker can guess. Those
 * failures look like application bugs at 2am. This module turns them into one
 * explicit answer at bootstrap: "ok" or a list of the NAMES that are missing.
 *
 * Rules that matter more than the copy:
 *   - never return, log or throw a value — only variable names;
 *   - in production, absence is fatal (assertProductionConfig throws);
 *   - in development/test, the same checks are advisory warnings, so local
 *     commands and CI still run without real credentials;
 *   - a feature that is partially configured counts as enabled, so a half-wired
 *     integration fails the gate instead of degrading silently.
 */

export type StartupEnv = Record<string, string | undefined>;

export interface StartupValidationResult {
  ok: boolean;
  /** Names of missing environment variables only — never values. */
  missing: string[];
  /** Non-blocking notes. Always populated outside production. */
  warnings: string[];
}

/** A session secret is needed, but either name satisfies the requirement. */
export const SESSION_SECRET_KEY = "COOKIE_SECRET/JWT_SECRET";

/** Baseline settings every production deployment must provide. */
export const BASELINE_KEYS: readonly string[] = [
  SESSION_SECRET_KEY,
  "DATABASE_URL",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
  "STOREFRONT_BASE_URL",
];

const OFF = new Set(["", "0", "false", "no", "off", "none"]);

const isOn = (value: string | undefined): boolean =>
  !OFF.has((value ?? "").trim().toLowerCase());

/** True only when the variable holds a real, non-placeholder-looking value. */
const has = (env: StartupEnv, key: string): boolean => isOn(env[key]);

/**
 * A feature is enabled when opted into explicitly (FEATURE_* = 1, or the
 * project's existing CHECKOUT_RAZORPAY_PROVIDER = 1) OR when any of its
 * settings are already present. The second half is deliberate: one Razorpay
 * key with no secret is a broken payment path, not a disabled feature.
 */
const enabled = (env: StartupEnv, flag: string, indicators: string[]): boolean =>
  isOn(env[flag]) || indicators.some((key) => has(env, key));

/**
 * Choose the alternative credential pair that is closest to complete and
 * return only the names still needed. If either pair is complete, nothing is
 * missing. Ties prefer the first (documented, canonical) pair.
 */
const missingFromPairs = (
  env: StartupEnv,
  pairs: readonly (readonly string[])[]
): string[] => {
  const missing = pairs.map((pair) => pair.filter((key) => !has(env, key)));
  const best = missing.reduce(
    (winner, candidate, index) =>
      candidate.length < missing[winner].length ? index : winner,
    0
  );
  return missing[best];
};

const RAZORPAY_INDICATORS = [
  "CHECKOUT_RAZORPAY_PROVIDER",
  "RAZORPAY_KEY_ID",
  "NEXT_PUBLIC_RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
];
const EMAIL_INDICATORS = ["FROM_EMAIL", "RESEND_API_KEY"];
const SHIPROCKET_INDICATORS = [
  "SHIPROCKET_EMAIL",
  "SHIPROCKET_PASSWORD",
  "SHIPROCKET_PICKUP_POSTCODE",
  "SHIPROCKET_API_TOKEN",
];

/** Names required for production, in a stable order. Never contains values. */
function requiredNames(env: StartupEnv): {
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];

  // ── baseline ────────────────────────────────────────────────────────────
  if (!has(env, "COOKIE_SECRET") && !has(env, "JWT_SECRET")) {
    missing.push(SESSION_SECRET_KEY);
  }
  if (!has(env, "DATABASE_URL")) missing.push("DATABASE_URL");
  missing.push(
    ...missingFromPairs(env, [
      ["ADMIN_EMAIL", "ADMIN_PASSWORD"],
      ["MEDUSA_ADMIN_EMAIL", "MEDUSA_ADMIN_PASSWORD"],
    ])
  );
  if (!has(env, "STOREFRONT_BASE_URL")) missing.push("STOREFRONT_BASE_URL");

  // ── payments (Razorpay) ─────────────────────────────────────────────────
  if (enabled(env, "FEATURE_RAZORPAY", RAZORPAY_INDICATORS)) {
    if (!has(env, "RAZORPAY_KEY_ID") && !has(env, "NEXT_PUBLIC_RAZORPAY_KEY_ID")) {
      missing.push("RAZORPAY_KEY_ID");
    }
    if (!has(env, "RAZORPAY_KEY_SECRET")) missing.push("RAZORPAY_KEY_SECRET");
    if (!has(env, "RAZORPAY_WEBHOOK_SECRET")) {
      missing.push("RAZORPAY_WEBHOOK_SECRET");
    }
  }

  // ── e-mail (Resend only) ────────────────────────────────────────────────
  // SES was removed from the transport entirely, so requiring its variables
  // here would refuse to boot for a mail path that no longer exists.
  if (enabled(env, "FEATURE_EMAIL", EMAIL_INDICATORS)) {
    if (!has(env, "FROM_EMAIL")) missing.push("FROM_EMAIL");
    if (!has(env, "RESEND_API_KEY")) missing.push("RESEND_API_KEY");
  }

  // ── fulfilment (Shiprocket) ─────────────────────────────────────────────
  if (enabled(env, "FEATURE_SHIPROCKET", SHIPROCKET_INDICATORS)) {
    if (!has(env, "SHIPROCKET_EMAIL")) missing.push("SHIPROCKET_EMAIL");
    if (!has(env, "SHIPROCKET_PASSWORD")) missing.push("SHIPROCKET_PASSWORD");
    if (!has(env, "SHIPROCKET_PICKUP_POSTCODE")) {
      warnings.push(
        "SHIPROCKET_PICKUP_POSTCODE is unset; quotes will use the default postcode."
      );
    }
  }

  return { missing, warnings };
}

/**
 * Validate the environment a process is starting with.
 *
 * In production `ok` is false when anything required is absent. Elsewhere the
 * answer is always ok, with the production requirements reported as warnings
 * so a developer or test run is never blocked by absent real credentials.
 */
export function validateProductionConfig(
  env: StartupEnv = process.env as StartupEnv
): StartupValidationResult {
  const { missing, warnings } = requiredNames(env);

  if ((env.NODE_ENV ?? "").trim().toLowerCase() !== "production") {
    return {
      ok: true,
      missing: [],
      warnings: [
        "NODE_ENV is not production; production configuration checks are advisory.",
        ...(missing.length
          ? [`Production would require: ${missing.join(", ")}.`]
          : []),
        ...warnings,
      ],
    };
  }

  return { ok: missing.length === 0, missing, warnings };
}

/**
 * Fail fast at bootstrap. The thrown message names variables only; it never
 * contains a value, so it is safe to write to stdout, Sentry or a log aggregator.
 */
export function assertProductionConfig(
  env: StartupEnv = process.env as StartupEnv
): void {
  const result = validateProductionConfig(env);
  if (!result.ok) {
    throw new Error(
      `Production configuration is incomplete: ${result.missing.length} required setting(s) missing ` +
        `(${result.missing.join(", ")}). No values are shown.`
    );
  }
}
