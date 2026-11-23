/**
 * Backend-side retry policy (pure, no I/O).
 *
 * The storefront owns the worker/adapters in lib/notifications.ts; this module
 * is the send-side half: it classifies a transport failure and plans the row
 * state that the worker later consumes. The formulas are intentionally the
 * same on both sides (base 60s, x2, 1h ceiling, default 5 attempts). Keeping a
 * copy here avoids a cross-app import from the Medusa backend into Next.js.
 *
 * `delivery_status` is a NEW column from migration 005; the historical
 * `status` CHECK is untouched, so this never rewrites existing business data.
 */

export type NotificationErrorKind = "retryable" | "terminal";

export const NOTIFICATION_MAX_ATTEMPTS_DEFAULT = 5;
export const NOTIFICATION_MAX_ATTEMPTS_CAP = 50;
export const NOTIFICATION_BASE_DELAY_MS = 60_000;
export const NOTIFICATION_MAX_DELAY_MS = 3_600_000;

export function notificationMaxAttempts(
  env: NodeJS.ProcessEnv = process.env
): number {
  const parsed = Number.parseInt(String(env.NOTIFICATION_MAX_ATTEMPTS ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return NOTIFICATION_MAX_ATTEMPTS_DEFAULT;
  return Math.min(parsed, NOTIFICATION_MAX_ATTEMPTS_CAP);
}

export function notificationBackoffDelayMs(attempt: number): number {
  const a = Math.max(0, Math.floor(Number(attempt) || 0));
  return Math.min(NOTIFICATION_MAX_DELAY_MS, NOTIFICATION_BASE_DELAY_MS * 2 ** a);
}

const TERMINAL_ERROR_PATTERNS: Array<[RegExp, string]> = [
  [/invalid\s*(recipient|address|email|sender|to)\b/i, "invalid_recipient"],
  [/permanent\s*(failure|rejection|error|bounce)/i, "permanent_rejection"],
  [/authentication|unauthorized|access\s*denied|forbidden|invalid\s*credential/i, "authentication_failure"],
  [/sender\s*not\s*verified|email\s*address\s*not\s*verified|domain\s*not\s*verified/i, "unverified_sender"],
  [/suppressed\s*(address|recipient)/i, "suppressed_recipient"],
];

const RETRYABLE_ERROR_PATTERNS: Array<[RegExp, string]> = [
  [/timed?\s*out|timeout|etimedout/i, "timeout"],
  [/econnreset|econnrefused|epipe|enotfound|eai_again|network|socket\s*hang\s*up/i, "network_error"],
  [/throttl|rate\s*limit|too\s*many\s*requests/i, "throttling"],
  [/service\s*unavailable|temporarily\s*unavailable|internal\s*server\s*error|bad\s*gateway/i, "provider_5xx"],
];

/** Retryable = timeout / SES throttling / provider 5xx; everything explicitly
 *  permanent (invalid recipient, auth, 4xx) is terminal. Unknown is retryable. */
export function classifySendError(error: unknown): {
  kind: NotificationErrorKind;
  retryable: boolean;
  reason: string;
} {
  const text = String(
    error instanceof Error ? error.message : error != null ? (error as any).message || error : ""
  );
  for (const [re, reason] of TERMINAL_ERROR_PATTERNS) {
    if (re.test(text)) return { kind: "terminal", retryable: false, reason };
  }
  const statusMatch = text.match(/\b([45]\d{2})\b/);
  if (statusMatch) {
    const status = Number(statusMatch[1]);
    if (status === 408 || status === 429 || status >= 500) {
      return {
        kind: "retryable",
        retryable: true,
        reason: status === 429 ? "throttling" : status === 408 ? "timeout" : "provider_5xx",
      };
    }
    return { kind: "terminal", retryable: false, reason: "http_4xx" };
  }
  for (const [re, reason] of RETRYABLE_ERROR_PATTERNS) {
    if (re.test(text)) return { kind: "retryable", retryable: true, reason };
  }
  return { kind: "retryable", retryable: true, reason: "unknown_retryable" };
}

export interface PlannedFailure {
  attempts: number;
  status: "failed";
  delivery_status: "retrying" | "dead_lettered" | "failed_terminal";
  next_attempt_at: string | null;
  last_error: string;
  error_kind: NotificationErrorKind;
  terminal_reason: string | null;
  dead_lettered_at: string | null;
}

/** Pure state written by the send path for one failed attempt. */
export function planNotificationFailure(params: {
  attempts: number;
  error: unknown;
  now?: Date;
  maxAttempts?: number;
  env?: NodeJS.ProcessEnv;
}): PlannedFailure {
  const now = params.now ?? new Date();
  const info = classifySendError(params.error);
  const attempts = Math.max(0, Math.floor(Number(params.attempts) || 0)) + 1;
  const max = params.maxAttempts ?? notificationMaxAttempts(params.env);
  const rawError = String(
    params.error instanceof Error ? params.error.message : params.error ?? ""
  );
  const last_error = rawError.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[redacted]").slice(0, 2000) || info.reason;
  const base = {
    attempts,
    status: "failed" as const,
    last_error,
    error_kind: info.kind,
  };

  if (info.kind === "terminal") {
    return { ...base, delivery_status: "failed_terminal", terminal_reason: info.reason, dead_lettered_at: null, next_attempt_at: null };
  }
  if (attempts >= max) {
    return { ...base, delivery_status: "dead_lettered", terminal_reason: "max_attempts_reached", dead_lettered_at: now.toISOString(), next_attempt_at: null };
  }
  return {
    ...base,
    delivery_status: "retrying",
    terminal_reason: null,
    dead_lettered_at: null,
    next_attempt_at: new Date(now.getTime() + notificationBackoffDelayMs(attempts - 1)).toISOString(),
  };
}
