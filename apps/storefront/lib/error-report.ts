/**
 * Failure reporting that works with nothing installed.
 *
 * There was no error tracking at all: a production exception went to a log file
 * on a box nobody watches, which is the same as not being told. A service like
 * Sentry is the right long-term answer, but it needs an account and a dependency
 * on the critical path, and this shop has to be able to ship before either
 * exists.
 *
 * So: structured lines in the log, and — if `ERROR_WEBHOOK_URL` is set — one POST
 * to that URL. A Slack or Discord incoming webhook, a self-hosted endpoint, or
 * nothing at all. Absent the variable this is a no-op that costs one string
 * comparison, so it can be wired everywhere without a feature flag.
 *
 * Three rules, because an error reporter that misbehaves is worse than none:
 *
 *  1. **It never throws.** A failure to report a failure must not become a
 *     second failure inside the handler that was already failing.
 *  2. **It never blocks a response.** The POST is fire-and-forget with a short
 *     timeout; a slow webhook cannot hold a customer's checkout open.
 *  3. **It never includes a secret or a person.** Message, route, and a short
 *     stack. No cookies, no headers, no email addresses, no request bodies.
 */

interface ErrorContext {
  /** Where it happened, in the shop's own words: "checkout/complete". */
  scope: string;
  /** Anything useful and non-personal: an order id, a variant id, a status. */
  detail?: Record<string, string | number | boolean | null | undefined>;
}

const WEBHOOK = String(process.env.ERROR_WEBHOOK_URL || "").trim();
const IS_PROD = process.env.NODE_ENV === "production";

function summarise(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: `${error.name}: ${error.message}`.slice(0, 500),
      // Eight frames is enough to locate a fault and short enough to read in a
      // chat message. The full stack is already in the log line.
      stack: error.stack?.split("\n").slice(0, 8).join("\n"),
    };
  }
  return { message: String(error ?? "unknown error").slice(0, 500) };
}

/**
 * Report a failure. Callers do not await it, and it returns void on purpose:
 * `await reportError(...)` would be a lie about what it guarantees.
 */
export function reportError(error: unknown, context: ErrorContext): void {
  const { message, stack } = summarise(error);
  const payload = {
    scope: context.scope,
    message,
    detail: context.detail ?? {},
    at: new Date().toISOString(),
    env: process.env.NODE_ENV || "unknown",
  };

  // Always the log line: whoever tails the container gets it either way.
  try {
    console.error(
      `[error] ${payload.scope} ${payload.message}` +
        (Object.keys(payload.detail).length ? ` ${JSON.stringify(payload.detail)}` : "")
    );
    if (stack && !IS_PROD) console.error(stack);
  } catch {
    // A logger that throws is not a logger.
  }

  if (!WEBHOOK) return;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    // Text, not JSON: Slack and Discord incoming webhooks both accept this shape
    // and neither needs an app installed. `unref` keeps the process free to exit.
    const text =
      `:rotating_light: ${payload.scope}\n` +
      `> ${payload.message}\n` +
      `env: ${payload.env} at ${payload.at}` +
      (stack ? `\n\`\`\`${stack}\`\`\`` : "");

    void fetch(WEBHOOK, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, content: text }),
      signal: controller.signal,
    })
      .catch(() => undefined)
      .finally(() => clearTimeout(timer));
    if (typeof timer === "object" && "unref" in timer) timer.unref();
  } catch {
    // Never a second failure.
  }
}

/** For the few places that want to know whether anyone is listening. */
export function errorReportingConfigured(): boolean {
  return WEBHOOK.length > 0;
}
