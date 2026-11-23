/**
 * Next.js bootstrap hook (Next 15). Runs once when the server starts, before it
 * accepts requests. In production we fail closed if required configuration is
 * missing — see docs/release/CI_SECURITY.md §6 and lib/startup-validation.ts.
 *
 * The validator reads env vars only and reports *names*, never values. The
 * `NEXT_RUNTIME` guard avoids running the check twice (nodejs + edge workers).
 * Outside production it is advisory (warnings only, never throws), so local dev
 * and CI do not need real credentials.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertProductionConfig } = await import("@/lib/startup-validation");
    assertProductionConfig(process.env);
  }
}
