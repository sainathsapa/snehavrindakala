#!/usr/bin/env node
/**
 * perf-smoke.mjs — SAFE, dependency-free latency smoke test for public reads.
 *
 * What it does
 * ------------
 * Issues a small number of UNauthenticated GETs against three public read
 * endpoints (home, catalogue, search) with a bounded concurrency loop, then
 * reports p50 / p95 latency and an error rate per endpoint and overall.
 *
 * What it deliberately does NOT do
 * --------------------------------
 * - No secrets, no auth tokens, no cookies. It never reads credential env vars
 *   and never sets an Authorization / Cookie header. Only a benign User-Agent
 *   and Accept header are sent.
 * - No writes. All endpoints are public reads (GET). No checkout, no admin,
 *   no partner, no webhook, no cron routes are touched.
 * - No unbounded load. Every run is capped by wall-clock time, per-request
 *   timeout, concurrency and a hard request budget.
 * - No production by default. Any host that is not loopback / private / clearly
 *   staging-like is considered production-looking and is REFUSED unless the
 *   caller explicitly sets ALLOW_PROD_PERF=1 (and even then it warns loudly).
 *
 * Usage
 * -----
 *   node scripts/perf-smoke.mjs <BASE_URL>
 *   BASE_URL=https://staging.example.com node scripts/perf-smoke.mjs
 *
 * Staging examples:
 *   node scripts/perf-smoke.mjs http://localhost:3000
 *   node scripts/perf-smoke.mjs https://staging.example.com
 *   node scripts/perf-smoke.mjs https://preview-123.vercel.app
 *
 * Optional tuning (all clamped to safe caps; see CONFIG below):
 *   PERF_CONCURRENCY=4 PERF_DURATION_MS=30000 PERF_TIMEOUT_MS=5000 \
 *   PERF_MAX_REQUESTS=80 node scripts/perf-smoke.mjs <BASE_URL>
 *
 * Optional thresholds (report is always printed; exit 1 only if enforced):
 *   PERF_MAX_ERROR_RATE=0.01 PERF_MAX_P95_MS=1500 node scripts/perf-smoke.mjs <BASE_URL>
 *
 * Exit codes
 * ----------
 *   0  run completed and (if supplied) thresholds were met
 *   1  bad/insecure target, refused production target, no samples, or a
 *      supplied threshold was exceeded
 */

const UA = "svk-perf-smoke/1.0 (+staging-only; unauthenticated)";

// ---- Config (all values clamped so a typo cannot turn this into a load test) ----
function intEnv(name, fallback, min, max) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    console.error(`REFUSING: ${name} must be a number, got ${JSON.stringify(raw)}`);
    process.exit(1);
  }
  return Math.min(max, Math.max(min, Math.trunc(n)));
}
function floatEnv(name) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    console.error(`REFUSING: ${name} must be a non-negative number`);
    process.exit(1);
  }
  return n;
}

const CONFIG = {
  concurrency: intEnv("PERF_CONCURRENCY", 4, 1, 8),
  durationMs: intEnv("PERF_DURATION_MS", 30_000, 1_000, 120_000),
  timeoutMs: intEnv("PERF_TIMEOUT_MS", 5_000, 500, 10_000),
  maxRequests: intEnv("PERF_MAX_REQUESTS", 80, 1, 500),
  maxErrorRate: floatEnv("PERF_MAX_ERROR_RATE"), // e.g. 0.01 = 1%
  maxP95Ms: floatEnv("PERF_MAX_P95_MS"), // e.g. 1500
};

const ENDPOINTS = [
  { name: "home", path: "/" },
  { name: "catalogue", path: "/shop" },
  { name: "search", path: "/api/store/search?q=art" },
];

// ---- Target parsing + staging-only guard -------------------------------------
function resolveBaseUrl() {
  const raw = (process.argv[2] || process.env.BASE_URL || "").trim();
  if (!raw) {
    console.error(
      "REFUSING: no BASE_URL. Pass it as an argument or env var:\n" +
        "  node scripts/perf-smoke.mjs http://localhost:3000\n" +
        "  BASE_URL=https://staging.example.com node scripts/perf-smoke.mjs"
    );
    process.exit(1);
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    console.error(`REFUSING: BASE_URL is not a valid URL: ${JSON.stringify(raw)}`);
    process.exit(1);
  }

  // No credentials and no query/hash in the base — those are the usual ways a
  // token sneaks into a "harmless" smoke command and ends up in shell history
  // or logs. This script never needs either.
  if (parsed.username || parsed.password) {
    console.error(
      "REFUSING: BASE_URL must not contain embedded credentials " +
        "(user:pass@host). No secrets belong in this tool."
    );
    process.exit(1);
  }
  if (parsed.search || parsed.hash) {
    console.error(
      "REFUSING: BASE_URL must not contain a query string or fragment " +
        "(they can carry tokens and are not part of an origin)."
    );
    process.exit(1);
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    console.error(
      `REFUSING: BASE_URL must use http or https, got ${parsed.protocol}`
    );
    process.exit(1);
  }

  return parsed;
}

const KNOWN_PRODUCTION_HOSTS = new Set([
  "snehavrinda.in",
  "www.snehavrinda.in",
  "snehavrindakala.com",
  "www.snehavrindakala.com",
]);
const STAGING_MARKERS = [
  "staging", "stage", "stg", "preview", "preprod", "dev", "qa",
  "test", "sandbox", "local", "internal", "mock", "ci",
];

function isProductionLooking(hostname) {
  const h = hostname.toLowerCase().replace(/\.$/, "");
  if (KNOWN_PRODUCTION_HOSTS.has(h)) return true;

  // Loopback, private ranges and *.local / *.internal are never production.
  if (
    h === "localhost" || h === "127.0.0.1" || h === "::1" ||
    h === "[::1]" || h === "0.0.0.0" ||
    /^127\./.test(h) || /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    h.endsWith(".local") || h.endsWith(".internal")
  ) {
    return false;
  }

  // Anything with an explicit staging marker is treated as a non-prod target.
  if (STAGING_MARKERS.some((m) => h.includes(m))) return false;

  // Default deny: an unrecognised public hostname is assumed to be production.
  return true;
}

function prodFlagEnabled() {
  const v = (process.env.ALLOW_PROD_PERF || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

const base = resolveBaseUrl();
const host = base.hostname;
const productionLooking = isProductionLooking(host);

if (productionLooking && !prodFlagEnabled()) {
  console.error(
    `REFUSING to run against ${host}: it looks like a PRODUCTION host.\n` +
      "This smoke test is for staging only. Point BASE_URL at a staging / " +
      "preview / localhost origin, or — if you have explicit owner approval — " +
      "re-run with the explicit flag:\n" +
      `  ALLOW_PROD_PERF=1 node scripts/perf-smoke.mjs ${base.origin}`
  );
  process.exit(1);
}
if (productionLooking && prodFlagEnabled()) {
  console.error(
    `WARNING: ALLOW_PROD_PERF is set — running a load smoke against ${host}.\n` +
      "Keep concurrency and duration low. This is your explicit responsibility."
  );
}

// Preserve any sub-path mount (e.g. https://staging.example.com/app) but drop
// query/fragment (already rejected above). This is origin + path only.
const basePrefix = `${base.origin}${base.pathname.replace(/\/+$/, "")}/`;

// ---- Measurement -------------------------------------------------------------
const samples = Object.fromEntries(ENDPOINTS.map((e) => [e.name, []]));
const allSamples = [];
let issued = 0;
const startedAt = new Date().toISOString();
const startMs = Date.now();
const deadline = startMs + CONFIG.durationMs;

const overall = new AbortController();
const deadlineTimer = setTimeout(() => overall.abort(), CONFIG.durationMs);
process.once("SIGINT", () => overall.abort());

function claim() {
  if (overall.signal.aborted || Date.now() >= deadline) return null;
  if (issued >= CONFIG.maxRequests) return null;
  return issued++;
}

function requestSignal() {
  const c = new AbortController();
  const onAbort = () => c.abort();
  if (overall.signal.aborted) c.abort();
  else overall.signal.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => c.abort(), CONFIG.timeoutMs);
  return {
    signal: c.signal,
    cleanup() {
      clearTimeout(timer);
      overall.signal.removeEventListener("abort", onAbort);
    },
  };
}

async function measure(endpoint, workerIndex) {
  const url = new URL(endpoint.path.replace(/^\//, ""), basePrefix);
  const { signal, cleanup } = requestSignal();
  const t0 = performance.now();
  let status = 0;
  let error = null;

  try {
    const res = await fetch(url, {
      method: "GET",
      signal,
      redirect: "follow",
      cache: "no-store",
      headers: {
        "user-agent": UA,
        accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        // Intentionally NO Authorization and NO Cookie headers.
      },
    });
    status = res.status;
    // Drain the body so the timing reflects the full response, not just headers.
    if (res.body) {
      for await (const _chunk of res.body) {
        // discard
      }
    }
  } catch (err) {
    error = err && err.name ? `${err.name}: ${err.message || ""}` : String(err);
  } finally {
    cleanup();
  }

  const ms = performance.now() - t0;

  // A run-level deadline abort is an incomplete sample, not an application
  // error — exclude it so a hard timeout does not inflate the error rate.
  if (overall.signal.aborted && !status) return;

  const ok = !error && status >= 200 && status < 400;
  const sample = { endpoint: endpoint.name, ms, ok, status, error, worker: workerIndex };
  samples[endpoint.name].push(sample);
  allSamples.push(sample);
}

async function worker(workerIndex) {
  while (true) {
    const idx = claim();
    if (idx === null) break;
    const endpoint = ENDPOINTS[idx % ENDPOINTS.length];
    await measure(endpoint, workerIndex);
  }
}

// ---- Stats -------------------------------------------------------------------
function percentile(sortedAscending, p) {
  if (!sortedAscending.length) return null;
  if (sortedAscending.length === 1) return sortedAscending[0];
  const idx = (p / 100) * (sortedAscending.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAscending[lo];
  const frac = idx - lo;
  return sortedAscending[lo] + (sortedAscending[hi] - sortedAscending[lo]) * frac;
}

function summarise(list) {
  const lats = list.map((s) => s.ms).sort((a, b) => a - b);
  const errors = list.filter((s) => !s.ok).length;
  const p50 = percentile(lats, 50);
  const p95 = percentile(lats, 95);
  return {
    requests: list.length,
    errors,
    errorRate: list.length ? Number((errors / list.length).toFixed(4)) : 0,
    p50Ms: p50 === null ? null : Math.round(p50),
    p95Ms: p95 === null ? null : Math.round(p95),
    minMs: lats.length ? Math.round(lats[0]) : null,
    maxMs: lats.length ? Math.round(lats[lats.length - 1]) : null,
  };
}

// ---- Run ---------------------------------------------------------------------
await Promise.all(
  Array.from({ length: CONFIG.concurrency }, (_, i) => worker(i))
);
clearTimeout(deadlineTimer);

const report = {
  tool: "svk-perf-smoke/1.0",
  target: {
    base: basePrefix,
    host,
    classification: productionLooking
      ? "production (ALLOW_PROD_PERF=1)"
      : "staging/loopback",
  },
  config: {
    concurrency: CONFIG.concurrency,
    durationMs: CONFIG.durationMs,
    timeoutMs: CONFIG.timeoutMs,
    maxRequests: CONFIG.maxRequests,
    issued,
  },
  startedAt,
  endedAt: new Date().toISOString(),
  elapsedMs: Date.now() - startMs,
  overall: summarise(allSamples),
  endpoints: Object.fromEntries(
    ENDPOINTS.map((e) => [e.name, summarise(samples[e.name])])
  ),
  thresholds: {
    maxErrorRate: CONFIG.maxErrorRate,
    maxP95Ms: CONFIG.maxP95Ms,
    enforced: CONFIG.maxErrorRate !== null || CONFIG.maxP95Ms !== null,
  },
};

// Human-readable summary.
console.log("SnehaVrinda Kala — public-read performance smoke");
console.log(`target      : ${report.target.base}`);
console.log(`host class  : ${report.target.classification}`);
console.log(
  `config      : concurrency=${CONFIG.concurrency} duration=${CONFIG.durationMs}ms ` +
    `timeout=${CONFIG.timeoutMs}ms maxRequests=${CONFIG.maxRequests}`
);
console.log(
  `elapsed     : ${report.elapsedMs}ms, issued ${issued} requests\n`
);
console.log("endpoint     requests  errors  errorRate   p50      p95");
for (const [name, s] of Object.entries(report.endpoints)) {
  console.log(
    `${name.padEnd(12)} ${String(s.requests).padStart(8)}  ` +
      `${String(s.errors).padStart(6)}  ` +
      `${String(s.errorRate).padStart(9)}  ` +
      `${String(s.p50Ms ?? "-").padStart(5)}ms  ` +
      `${String(s.p95Ms ?? "-").padStart(5)}ms`
  );
}
const o = report.overall;
console.log(
  `${"OVERALL".padEnd(12)} ${String(o.requests).padStart(8)}  ` +
    `${String(o.errors).padStart(6)}  ` +
    `${String(o.errorRate).padStart(9)}  ` +
    `${String(o.p50Ms ?? "-").padStart(5)}ms  ` +
    `${String(o.p95Ms ?? "-").padStart(5)}ms`
);
console.log("\nJSON report:\n" + JSON.stringify(report, null, 2));

let failed = false;
if (allSamples.length === 0) {
  console.error(
    "No completed samples — is the target reachable? No numbers were produced."
  );
  failed = true;
}
if (CONFIG.maxErrorRate !== null && o.errorRate > CONFIG.maxErrorRate) {
  console.error(
    `THRESHOLD FAIL: errorRate ${o.errorRate} > PERF_MAX_ERROR_RATE ${CONFIG.maxErrorRate}`
  );
  failed = true;
}
if (CONFIG.maxP95Ms !== null && o.p95Ms !== null && o.p95Ms > CONFIG.maxP95Ms) {
  console.error(
    `THRESHOLD FAIL: p95 ${o.p95Ms}ms > PERF_MAX_P95_MS ${CONFIG.maxP95Ms}ms`
  );
  failed = true;
}
process.exit(failed ? 1 : 0);
