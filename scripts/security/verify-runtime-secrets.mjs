#!/usr/bin/env node
/**
 * Fail-closed runtime secret check for the container entrypoints.
 *
 * WHY
 *
 * The backend image used to declare `ENV JWT_SECRET=""` and
 * `ENV COOKIE_SECRET=""` as neutral "overridden at runtime" defaults. The
 * problem: nothing enforced the override. An orchestrator that forgot to inject
 * the secret produced a container that started successfully and signed session
 * tokens with an empty key — a silent, total authentication bypass is a much
 * worse failure mode than a container that refuses to boot.
 *
 * The Dockerfiles no longer declare secret defaults, and both entrypoints call
 * this check before starting the app, so a missing or placeholder credential is
 * a loud startup failure with an actionable message.
 *
 * It never prints a secret value — only its name, presence and length class.
 *
 *   node scripts/security/verify-runtime-secrets.mjs --app=backend
 *   node scripts/security/verify-runtime-secrets.mjs --app=storefront
 *
 * Exit codes: 0 pass (possibly with warnings), 1 required secret missing/weak.
 */

const APPS = {
  backend: {
    label: "Medusa backend",
    required: [
      { name: "DATABASE_URL", minLength: 12, kind: "url" },
      { name: "JWT_SECRET", minLength: 32, kind: "secret" },
      { name: "COOKIE_SECRET", minLength: 32, kind: "secret" },
    ],
    recommended: [{ name: "RAZORPAY_KEY_SECRET", kind: "secret" }],
  },
  storefront: {
    label: "Next.js storefront",
    required: [{ name: "DATABASE_URL", minLength: 12, kind: "url" }],
    recommended: [
      { name: "COOKIE_SECRET", minLength: 32, kind: "secret" },
      { name: "JWT_SECRET", minLength: 32, kind: "secret" },
      { name: "RAZORPAY_KEY_SECRET", kind: "secret" },
    ],
  },
};

/**
 * Values that look configured but are not secrets. A deployment that ships
 * `JWT_SECRET=changeme` is in the same state as one that ships nothing, except
 * the check would pass — so these are rejected explicitly.
 */
const WEAK_VALUES = [
  "changeme", "change-me", "change_me", "placeholder", "example", "sample",
  "your-secret", "your_secret", "secret", "password", "test", "dummy", "fake",
  "insecure", "development", "medusa", "admin", "123456", "000000",
  "dev-only", "do-not-use", "todo", "fixme",
];

const die = (message) => {
  console.error(`[runtime-secrets] ${message}`);
  process.exit(2);
};

function parseArgs(argv) {
  let app = null;
  for (const arg of argv) {
    if (arg.startsWith("--app=")) app = arg.slice(6);
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node scripts/security/verify-runtime-secrets.mjs --app=backend|storefront");
      process.exit(0);
    } else die(`unknown argument: ${arg}`);
  }
  if (!app) die("--app=backend|storefront is required");
  if (!APPS[app]) die(`unknown app "${app}" (expected: ${Object.keys(APPS).join(", ")})`);
  return { app };
}

/** Classify a value without ever returning it. */
function classify(value, spec) {
  if (!value || !value.trim()) return { ok: false, reason: "is not set" };
  const v = value.trim();

  if (v.includes("${") || v.includes("{{")) {
    return { ok: false, reason: "contains an unresolved template placeholder" };
  }
  const lower = v.toLowerCase();
  if (WEAK_VALUES.includes(lower)) {
    return { ok: false, reason: "is a known weak/placeholder value" };
  }
  if (lower.includes("changeme") || lower.includes("change-me")) {
    return { ok: false, reason: "is a known weak/placeholder value" };
  }
  if (/^(.)\1+$/.test(v)) {
    return { ok: false, reason: "is a single repeated character" };
  }
  if (spec.minLength && v.length < spec.minLength) {
    return {
      ok: false,
      reason: `is shorter than the required ${spec.minLength} characters (got ${v.length})`,
    };
  }
  if (spec.kind === "url" && !/^postgres(ql)?:\/\//.test(v)) {
    return { ok: false, reason: "is not a postgres connection URL" };
  }
  return { ok: true, length: v.length };
}

function check(specs, { fatal }) {
  const problems = [];
  for (const spec of specs) {
    const result = classify(process.env[spec.name], spec);
    if (result.ok) {
      console.log(`[runtime-secrets]   ok       ${spec.name} (${result.length} chars)`);
      continue;
    }
    // A missing optional secret is a warning; a *wrong* one is always reported.
    const severity = fatal ? "MISSING" : "WARN";
    console.log(`[runtime-secrets]   ${severity.padEnd(8)} ${spec.name} ${result.reason}`);
    if (fatal) problems.push(`${spec.name} ${result.reason}`);
  }
  return problems;
}

function main() {
  const { app } = parseArgs(process.argv.slice(2));
  const config = APPS[app];

  console.log(`[runtime-secrets] checking ${config.label} configuration`);

  const failures = check(config.required, { fatal: true });
  const warnings = check(config.recommended, { fatal: false });

  if (failures.length) {
    console.error(
      `\n[runtime-secrets] FAIL — ${failures.length} required credential(s) unusable:\n` +
        failures.map((f) => `  - ${f}`).join("\n") +
        "\n\n  The container is refusing to start rather than run with a missing or\n" +
        "  placeholder signing key, which would silently weaken authentication.\n" +
        "  Inject these at runtime through the deployment environment or secret\n" +
        "  store — never through the Docker build, build args, or a baked .env file.\n" +
        "  For local compose: copy .env.example to .env and generate secrets with\n" +
        "  `openssl rand -hex 32`. See docs/release/PRODUCTION_CONFIGURATION.md."
    );
    process.exit(1);
  }

  if (warnings.length) {
    console.log(
      `[runtime-secrets] ${warnings.length} feature(s) will be unavailable until their ` +
        "credential is configured (payment/email/session features degrade, the app still serves)."
    );
  }
  console.log("[runtime-secrets] PASS — required credentials present.");
}

main();
