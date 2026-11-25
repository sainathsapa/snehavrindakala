#!/usr/bin/env node
/**
 * Gate `pnpm audit` on real severity, with a time-boxed exceptions mechanism.
 *
 * WHY
 *
 * `pnpm audit || true` reports vulnerabilities and then lets the build pass.
 * This script never ignores an advisory silently:
 *   - high and critical advisories fail the build by default (AUDIT_LEVEL);
 *   - the only way to silence one is an exception that names its CVE/GHSA,
 *     carries a justification, an approver and an expiry date;
 *   - expired or malformed exceptions do NOT suppress anything and are printed.
 *
 *   node scripts/audit-deps.mjs
 *   node scripts/audit-deps.mjs --input=/tmp/audit.json   # re-check a saved report
 *   node scripts/audit-deps.mjs --exceptions=./audit-exceptions.json
 *
 * The exceptions file is optional and lives at
 * apps/storefront/scripts/audit-exceptions.json by default. If absent, every
 * advisory is enforced. Inline JSON via AUDIT_EXCEPTIONS_JSON also works, for
 * CI setups that keep the allowlist in a secret. See docs/release/CI_SECURITY.md
 * for the format and the approval process.
 */

import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const DEFAULT_EXCEPTIONS = join(root, "security", "dependency-exceptions.json");
// Earlier revisions kept the allowlist next to this script. Still read it so an
// existing file is honoured, but the documented location is security/.
const LEGACY_EXCEPTIONS = join(root, "apps/storefront/scripts/audit-exceptions.json");

/** Policy constants enforced by the loader. */
const MAX_EXCEPTION_DAYS = 14;

const RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const ID_PATTERN = /^(?:CVE-\d{4}-\d+|GHSA-[a-z0-9-]+)$/i;
const ID_IN_TEXT = /CVE-\d{4}-\d+|GHSA-[a-z0-9-]+/gi;

const die = (message) => {
  console.error(`[audit-deps] ${message}`);
  process.exit(2);
};

function parseArgs(argv) {
  const options = { input: null, exceptions: null, scope: "all", help: false };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg.startsWith("--input=")) options.input = arg.slice(8);
    else if (arg.startsWith("--exceptions=")) options.exceptions = arg.slice(13);
    else if (arg.startsWith("--scope=")) {
      const scope = arg.slice(8);
      if (!["all", "prod", "dev"].includes(scope)) {
        die(`--scope must be one of all, prod, dev (got "${scope}")`);
      }
      options.scope = scope;
    } else die(`unknown argument: ${arg} (try --help)`);
  }
  return options;
}

function parseReport(raw) {
  if (!raw || !raw.trim()) die("pnpm audit produced no output.");
  let text = raw.trim();
  try {
    return JSON.parse(text);
  } catch {
    // Some pnpm versions print a preamble before the JSON payload.
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    die("pnpm audit output was not JSON. Run `pnpm audit --json` to inspect it.");
  }
}

function getReport(input, scope = "all") {
  if (input) {
    const path = resolve(root, input);
    try {
      return parseReport(readFileSync(path, "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT") die(`report not found: ${path}`);
      throw error;
    }
  }
  // A runtime advisory and a test-runner advisory are not the same risk, so CI
  // asks for them separately. `--prod` audits only production dependencies;
  // `--dev` only development ones. Neither can be silently skipped: a scope that
  // returns no parsable report is a hard error.
  const auditArgs = ["audit", "--json"];
  if (scope === "prod") auditArgs.push("--prod");
  else if (scope === "dev") auditArgs.push("--dev");

  let stdout = "";
  try {
    stdout = execFileSync("pnpm", auditArgs, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (error) {
    stdout = error.stdout || "";
    if (!stdout.trim()) {
      die(
        `pnpm audit failed before producing a report: ${(error.stderr || error.message).trim()}`
      );
    }
  }
  return parseReport(stdout);
}

const unique = (items) => [...new Set(items.filter(Boolean))];
const idsIn = (text) =>
  unique([...String(text ?? "").matchAll(ID_IN_TEXT)].map((m) => m[0].toUpperCase()));
const level = (value) => String(value ?? "").toLowerCase();

/** Accept both npm-style `advisories` and pnpm-style `vulnerabilities`. */
function collectFindings(report) {
  const findings = [];
  const seen = new Set();
  const add = (finding) => {
    const key = `${finding.id}|${finding.package}|${finding.severity}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push(finding);
  };

  if (report.advisories && typeof report.advisories === "object") {
    for (const [advisoryId, advisory] of Object.entries(report.advisories)) {
      if (!advisory || typeof advisory !== "object") continue;
      const cves = unique([
        ...idsIn(advisory.cve),
        ...idsIn((advisory.cves || []).join(" ")),
        ...idsIn(advisory.url),
        ...idsIn(JSON.stringify(advisory.findings || [])),
      ]);
      const rawFindings = Array.isArray(advisory.findings) ? advisory.findings : [];
      add({
        id: idsIn(advisoryId)[0] || `ADVISORY-${advisoryId}`,
        cves,
        severity: level(advisory.severity),
        package: advisory.module_name || "",
        title: advisory.title || "",
        // Installed versions and dependency paths let an exception be pinned to
        // the exact reviewed tree state: if either drifts, the exception stops
        // applying instead of silently covering a different package.
        versions: unique(rawFindings.map((f) => f.version)),
        paths: unique(rawFindings.flatMap((f) => f.paths || [])),
      });
    }
  }

  if (report.vulnerabilities && typeof report.vulnerabilities === "object") {
    for (const [pkg, vulnerability] of Object.entries(report.vulnerabilities)) {
      if (!vulnerability || typeof vulnerability !== "object") continue;
      const via = Array.isArray(vulnerability.via) ? vulnerability.via : [];
      if (!via.length) {
        add({
          id: idsIn(vulnerability.title)[0] || `VULN-${pkg}`,
          cves: idsIn(vulnerability.title),
          severity: level(vulnerability.severity),
          package: pkg,
          title: vulnerability.title || "",
        });
        continue;
      }
      for (const item of via) {
        if (typeof item === "string") {
          add({
            id: item,
            cves: idsIn(item),
            severity: level(vulnerability.severity),
            package: pkg,
            title: item,
          });
        } else if (item && typeof item === "object") {
          add({
            id: idsIn(item.source)[0] || idsIn(item.url)[0] || item.title || `VULN-${pkg}`,
            cves: unique([
              ...idsIn(item.source),
              ...idsIn(item.url),
              ...idsIn(item.title),
            ]),
            severity: level(item.severity || vulnerability.severity),
            package: item.name || pkg,
            title: item.title || "",
          });
        }
      }
    }
  }
  return findings;
}

/**
 * Load and validate the exception register.
 *
 * An exception is a time-boxed, narrowly scoped acceptance of ONE advisory for
 * ONE installed version on ONE dependency path. It is deliberately hard to
 * widen:
 *
 *   - the advisory id must be a real CVE/GHSA, so a package-level ignore cannot
 *     masquerade as one;
 *   - `installedVersion` must match the version the audit actually reported, so
 *     a version bump invalidates the exception instead of silently carrying it
 *     forward to a new (possibly worse) release;
 *   - `dependencyPath` must match a reported reachability path, so the exception
 *     cannot cover a newly introduced consumer;
 *   - `expires` may be at most MAX_EXCEPTION_DAYS after `approvedAt`, so nobody
 *     can approve a two-year exception;
 *   - critical advisories additionally require `criticalAuthorized: true`.
 *
 * A malformed or expired entry grants nothing. It is reported, and the advisory
 * it was meant to cover fails the build — the register can never hide a finding
 * by being wrong.
 */
function loadExceptions(pathArg) {
  const notes = [];
  const violations = [];
  const inline = process.env.AUDIT_EXCEPTIONS_JSON;
  let path = pathArg
    ? resolve(root, pathArg)
    : process.env.AUDIT_EXCEPTIONS_FILE
      ? resolve(root, process.env.AUDIT_EXCEPTIONS_FILE)
      : DEFAULT_EXCEPTIONS;

  if (!pathArg && !process.env.AUDIT_EXCEPTIONS_FILE && !inline && !existsSync(path)) {
    if (existsSync(LEGACY_EXCEPTIONS)) path = LEGACY_EXCEPTIONS;
  }

  let raw = inline;
  if (!raw) {
    if (!existsSync(path)) {
      notes.push(`no exceptions file at ${path} — every advisory is enforced`);
      return { active: [], notes, violations };
    }
    raw = readFileSync(path, "utf8");
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    notes.push(`exceptions source at ${path} is not valid JSON — no exceptions granted`);
    return { active: [], notes, violations };
  }
  const list = Array.isArray(parsed) ? parsed : parsed?.exceptions;
  if (!Array.isArray(list)) {
    notes.push(`exceptions source at ${path} has no "exceptions" array — no exceptions granted`);
    return { active: [], notes, violations };
  }

  const today = new Date().toISOString().slice(0, 10);
  const active = [];
  list.forEach((entry, index) => {
    const label = `exception[${index}]`;
    if (!entry || typeof entry !== "object") {
      notes.push(`${label}: not an object — ignored`);
      return;
    }

    // Field spellings: the documented register schema first, then the older
    // short form so an existing file keeps working.
    const id = String(entry.advisory ?? entry.cve ?? entry.id ?? "").trim().toUpperCase();
    const expires = String(entry.expiresAt ?? entry.expires ?? "").trim();
    const approvedAt = String(entry.approvedAt ?? entry.approved ?? "").trim();
    const reason = String(entry.reason ?? entry.justification ?? "").trim();
    const owner = String(entry.owner ?? entry.approvedBy ?? "").trim();
    const pkg = entry.package ? String(entry.package).trim() : null;
    const installedVersion = entry.installedVersion ? String(entry.installedVersion).trim() : null;
    const dependencyPath = entry.dependencyPath ? String(entry.dependencyPath).trim() : null;
    const severity = entry.severity ? level(entry.severity) : null;

    const reasons = [];
    if (!ID_PATTERN.test(id)) reasons.push("missing/invalid advisory id (CVE-* or GHSA-*)");
    if (!pkg) reasons.push("missing package");
    if (!installedVersion) reasons.push("missing installedVersion");
    if (!dependencyPath) reasons.push("missing dependencyPath");
    if (!severity || !(severity in RANK)) reasons.push("missing/invalid severity");
    if (reason.length < 10) reasons.push("reason too short (explain why no safe upgrade exists)");
    if (!owner) reasons.push("missing owner");

    const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
    if (!validDate(expires)) {
      reasons.push("missing/invalid expiresAt (use YYYY-MM-DD)");
    } else if (expires < today) {
      reasons.push(`EXPIRED ${expires} — renew with a fresh review or fix the issue`);
    }
    if (approvedAt && validDate(approvedAt) && validDate(expires)) {
      const days = Math.round((Date.parse(expires) - Date.parse(approvedAt)) / 86_400_000);
      if (days > MAX_EXCEPTION_DAYS) {
        reasons.push(`window of ${days} days exceeds the ${MAX_EXCEPTION_DAYS}-day maximum`);
      }
      if (days < 0) reasons.push("expiresAt is before approvedAt");
    } else {
      reasons.push("missing/invalid approvedAt (use YYYY-MM-DD)");
    }

    if (severity === "critical" && entry.criticalAuthorized !== true) {
      reasons.push("critical advisory requires criticalAuthorized: true (explicit authorization)");
    }
    if (!entry.exploitability || !entry.reachability) {
      reasons.push("missing exploitability/reachability assessment");
    }
    if (!entry.remediationPlan) reasons.push("missing remediationPlan");

    if (reasons.length) {
      // An invalid entry is a policy violation, not a harmless note: it means
      // the register claims a suppression that will not actually be honoured.
      violations.push(`${label} (${id || pkg || "no id"}): ${reasons.join("; ")}`);
      return;
    }

    active.push({
      id,
      expires,
      approvedAt,
      reason,
      owner,
      package: pkg,
      installedVersion,
      dependencyPath,
      severity,
      criticalAuthorized: entry.criticalAuthorized === true,
    });
  });

  return { active, notes, violations, source: inline ? "AUDIT_EXCEPTIONS_JSON" : path };
}

/**
 * Does an exception cover this finding?
 *
 * Returns "match", "no", or a drift reason. Drift is reported loudly rather
 * than treated as "no match": an exception written for version X that the
 * audit now reports as Y means the reviewed tree changed and the exception must
 * be re-reviewed, not silently inherited.
 */
function matchException(exception, finding) {
  if (exception.package && exception.package !== finding.package) return { ok: false };
  const identifiers = unique([finding.id, ...finding.cves]).map((v) => v.toUpperCase());
  if (!identifiers.includes(exception.id.toUpperCase())) return { ok: false };

  if (exception.severity && exception.severity !== finding.severity) {
    return {
      ok: false,
      drift: `severity changed: exception says ${exception.severity}, audit says ${finding.severity}`,
    };
  }

  if (exception.installedVersion && Array.isArray(finding.versions) && finding.versions.length) {
    if (!finding.versions.includes(exception.installedVersion)) {
      return {
        ok: false,
        drift:
          `installed version changed: exception pins ${exception.installedVersion}, ` +
          `audit reports ${finding.versions.join("/")}`,
      };
    }
  }

  if (exception.dependencyPath && Array.isArray(finding.paths) && finding.paths.length) {
    const needle = exception.dependencyPath.toLowerCase();
    const matched = finding.paths.some((p) => p.toLowerCase().includes(needle));
    if (!matched) {
      return {
        ok: false,
        drift:
          `dependency path no longer matches: exception names "${exception.dependencyPath}", ` +
          `audit reports ${finding.paths.length} path(s) that do not contain it`,
      };
    }
  }

  return { ok: true };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(
      "Usage: node scripts/audit-deps.mjs [--input=<audit.json>] [--exceptions=<file.json>] [--scope=all|prod|dev]\n" +
        "Env: AUDIT_LEVEL=high|critical, AUDIT_SCOPE=all|prod|dev, AUDIT_EXCEPTIONS_FILE=<path>, AUDIT_EXCEPTIONS_JSON=<json>"
    );
    return;
  }

  const scope = options.scope || level(process.env.AUDIT_SCOPE || "all");
  if (!["all", "prod", "dev"].includes(scope)) die(`invalid scope: ${scope}`);

  const minLevel = level(process.env.AUDIT_LEVEL || "high");
  if (!(minLevel in RANK)) die(`AUDIT_LEVEL must be one of ${Object.keys(RANK).join(", ")}`);

  const report = getReport(options.input, scope);
  const findings = collectFindings(report);
  const { active, notes, violations, source } = loadExceptions(options.exceptions);

  const counts = {};
  for (const finding of findings) counts[finding.severity] = (counts[finding.severity] || 0) + 1;

  console.log(`[audit-deps] scope: ${scope}`);
  console.log(
    `[audit-deps] advisories: ${Object.entries(counts)
      .map(([severity, count]) => `${severity}=${count}`)
      .join(" ") || "none"}`
  );
  console.log(`[audit-deps] enforcing severity >= ${minLevel}`);
  console.log(`[audit-deps] exceptions: ${source || "none"}`);
  for (const note of notes) console.log(`[audit-deps]   note: ${note}`);

  // An invalid register fails before anything is evaluated. Otherwise a typo in
  // an expiry date would read as "no exception for this advisory", and a typo in
  // a package name could read as "covered" — both are the wrong answer.
  if (violations?.length) {
    console.error(
      `[audit-deps] FAIL — ${violations.length} exception(s) in the register are invalid:\n` +
        violations.map((v) => `  - ${v}`).join("\n") +
        "\n\n  An invalid exception suppresses nothing. Fix the register entry, or fix\n" +
        "  the advisory. See security/dependency-exceptions.json and\n" +
        "  docs/release/CI_SECURITY_GATE_REPORT.md."
    );
    process.exit(1);
  }

  const blocking = findings.filter((f) => (RANK[f.severity] ?? -1) >= RANK[minLevel]);
  const applied = [];
  const drift = [];
  const unexcepted = blocking.filter((finding) => {
    for (const entry of active) {
      const result = matchException(entry, finding);
      if (result.ok) {
        applied.push({ finding, exception: entry });
        return false;
      }
      if (result.drift) {
        drift.push({ finding, exception: entry, drift: result.drift });
      }
    }
    return true;
  });

  for (const item of drift) {
    console.log(
      `[audit-deps]   DRIFT: exception for ${item.exception.package} (${item.exception.id}) ` +
        `no longer covers the reported finding — ${item.drift}`
    );
  }

  for (const { finding, exception } of applied) {
    console.log(
      `[audit-deps]   excepted: ${finding.package || finding.id} (${finding.id}) ` +
        `under ${exception.id} until ${exception.expires} — ${exception.reason} ` +
        `[owner ${exception.owner}]`
    );
  }

  if (!unexcepted.length) {
    console.log(
      `[audit-deps] OK — no unexcepted advisories at or above ${minLevel}. ` +
        `${blocking.length} advisory/advisories covered by active exceptions.`
    );
    return;
  }

  console.error(`[audit-deps] FAIL — ${unexcepted.length} unexcepted advisory/advisories:`);
  for (const finding of unexcepted) {
    const ids = unique([finding.id, ...finding.cves]).join(", ");
    console.error(
      `  [${finding.severity}] ${finding.package || "(package unknown)"} — ` +
        `${finding.title || "see advisory"} (${ids})`
    );
  }
  console.error(
    "[audit-deps] Fix by upgrading the dependency, or add a time-boxed exception " +
      "(package + installedVersion + advisory + dependencyPath + severity + reason + " +
      "owner + approvedAt + expiresAt + ≤14-day window) in security/dependency-exceptions.json — " +
      "see docs/release/CI_SECURITY_GATE_REPORT.md."
  );
  process.exit(1);
}

main();
