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
const DEFAULT_EXCEPTIONS = join(
  root,
  "apps/storefront/scripts/audit-exceptions.json"
);

const RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const ID_PATTERN = /^(?:CVE-\d{4}-\d+|GHSA-[a-z0-9-]+)$/i;
const ID_IN_TEXT = /CVE-\d{4}-\d+|GHSA-[a-z0-9-]+/gi;

const die = (message) => {
  console.error(`[audit-deps] ${message}`);
  process.exit(2);
};

function parseArgs(argv) {
  const options = { input: null, exceptions: null, help: false };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg.startsWith("--input=")) options.input = arg.slice(8);
    else if (arg.startsWith("--exceptions=")) options.exceptions = arg.slice(13);
    else die(`unknown argument: ${arg} (try --help)`);
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

function getReport(input) {
  if (input) {
    const path = resolve(root, input);
    try {
      return parseReport(readFileSync(path, "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT") die(`report not found: ${path}`);
      throw error;
    }
  }
  let stdout = "";
  try {
    stdout = execFileSync("pnpm", ["audit", "--json"], {
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
      add({
        id: idsIn(advisoryId)[0] || `ADVISORY-${advisoryId}`,
        cves,
        severity: level(advisory.severity),
        package: advisory.module_name || "",
        title: advisory.title || "",
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

function loadExceptions(pathArg) {
  const notes = [];
  const inline = process.env.AUDIT_EXCEPTIONS_JSON;
  const path = pathArg
    ? resolve(root, pathArg)
    : process.env.AUDIT_EXCEPTIONS_FILE
      ? resolve(root, process.env.AUDIT_EXCEPTIONS_FILE)
      : DEFAULT_EXCEPTIONS;

  let raw = inline;
  if (!raw) {
    if (!existsSync(path)) {
      notes.push(`no exceptions file at ${path} — every advisory is enforced`);
      return { active: [], notes };
    }
    raw = readFileSync(path, "utf8");
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    notes.push(`exceptions source at ${path} is not valid JSON — no exceptions granted`);
    return { active: [], notes };
  }
  const list = Array.isArray(parsed) ? parsed : parsed?.exceptions;
  if (!Array.isArray(list)) {
    notes.push(`exceptions source at ${path} has no "exceptions" array — no exceptions granted`);
    return { active: [], notes };
  }

  const today = new Date().toISOString().slice(0, 10);
  const active = [];
  list.forEach((entry, index) => {
    const label = `exception[${index}]`;
    if (!entry || typeof entry !== "object") {
      notes.push(`${label}: not an object — ignored`);
      return;
    }
    const id = String(entry.cve || entry.id || "").trim().toUpperCase();
    const expires = String(entry.expires || "").trim();
    const justification = String(entry.justification || "").trim();
    const approvedBy = String(entry.approvedBy || "").trim();
    const reasons = [];
    if (!ID_PATTERN.test(id)) reasons.push("missing/invalid cve id");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expires) || Number.isNaN(Date.parse(expires))) {
      reasons.push("missing/invalid expires (use YYYY-MM-DD)");
    } else if (expires < today) {
      reasons.push(`expired ${expires}`);
    }
    if (justification.length < 10) reasons.push("justification too short");
    if (!approvedBy) reasons.push("missing approvedBy");
    if (reasons.length) {
      notes.push(`${label} (${id || "no id"}): ${reasons.join(", ")} — ignored`);
      return;
    }
    active.push({
      id,
      expires,
      justification,
      approvedBy,
      package: entry.package ? String(entry.package) : null,
    });
  });
  return { active, notes, source: inline ? "AUDIT_EXCEPTIONS_JSON" : path };
}

function matches(exception, finding) {
  if (exception.package && exception.package !== finding.package) return false;
  const identifiers = unique([finding.id, ...finding.cves]).map((v) => v.toUpperCase());
  return identifiers.includes(exception.id.toUpperCase());
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(
      "Usage: node scripts/audit-deps.mjs [--input=<audit.json>] [--exceptions=<file.json>]\n" +
        "Env: AUDIT_LEVEL=high|critical, AUDIT_EXCEPTIONS_FILE=<path>, AUDIT_EXCEPTIONS_JSON=<json>"
    );
    return;
  }

  const minLevel = level(process.env.AUDIT_LEVEL || "high");
  if (!(minLevel in RANK)) die(`AUDIT_LEVEL must be one of ${Object.keys(RANK).join(", ")}`);

  const report = getReport(options.input);
  const findings = collectFindings(report);
  const { active, notes, source } = loadExceptions(options.exceptions);

  const counts = {};
  for (const finding of findings) counts[finding.severity] = (counts[finding.severity] || 0) + 1;

  console.log(
    `[audit-deps] advisories: ${Object.entries(counts)
      .map(([severity, count]) => `${severity}=${count}`)
      .join(" ") || "none"}`
  );
  console.log(`[audit-deps] enforcing severity >= ${minLevel}`);
  console.log(`[audit-deps] exceptions: ${source || "none"}`);
  for (const note of notes) console.log(`[audit-deps]   note: ${note}`);

  const blocking = findings.filter((f) => (RANK[f.severity] ?? -1) >= RANK[minLevel]);
  const applied = [];
  const unexcepted = blocking.filter((finding) => {
    const exception = active.find((entry) => matches(entry, finding));
    if (exception) {
      applied.push({ finding, exception });
      return false;
    }
    return true;
  });

  for (const { finding, exception } of applied) {
    console.log(
      `[audit-deps]   excepted: ${finding.package || finding.id} (${finding.id}) ` +
        `under ${exception.id} until ${exception.expires} — ${exception.justification} ` +
        `[approved by ${exception.approvedBy}]`
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
      "(cve + expires + justification + approvedBy) — see docs/release/CI_SECURITY.md."
  );
  process.exit(1);
}

main();
