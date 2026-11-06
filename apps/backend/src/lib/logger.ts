/**
 * Structured logger for SnehaVrinda Kala backend.
 *
 * Emits single-line JSON log records so they can be ingested by CloudWatch /
 * Loggly / similar. Never logs payment card data, private upload names, or
 * free-form commission briefs (build plan Section 11.8).
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

function isDev() {
  return process.env.NODE_ENV !== "production";
}

function format(level: LogLevel, message: string, ctx?: LogContext): string {
  const record: LogContext = {
    level,
    message,
    timestamp: new Date().toISOString(),
    service: "snehavrinda-kala-backend",
    ...ctx,
  };
  return JSON.stringify(record);
}

export const logger = {
  debug(message: string, ctx?: LogContext) {
    if (isDev()) console.log(format("debug", message, ctx));
  },
  info(message: string, ctx?: LogContext) {
    console.log(format("info", message, ctx));
  },
  warn(message: string, ctx?: LogContext) {
    console.warn(format("warn", message, ctx));
  },
  error(message: string, err?: Error, ctx?: LogContext) {
    const enriched: LogContext = {
      ...ctx,
      ...(err
        ? {
            error: err.message,
            stack: isDev() ? err.stack : undefined,
          }
        : {}),
    };
    console.error(format("error", message, enriched));
  },
};
