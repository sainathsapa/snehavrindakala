#!/usr/bin/env node
/**
 * Historical credential exposure scan (git history).
 *
 * WHY
 *
 * Removing a credential from the working tree does not remove it from git. Every
 * clone still carries it, and `git log -p` hands it over in one command. The
 * image exposure incident proved this project had credentials in deployable
 * artifacts; this scan answers the adjacent question — which credential-shaped
 * values were ever *committed*, and in which commits.
 *
 * WHAT IT DOES
 *
 * Streams `git log --all -p` and applies the same high-confidence rules the CI
 * secret scanner uses, but only to ADDED lines (`+`), because a removed line is
 * not a new exposure. Results are grouped by rule and by commit so the rotation
 * register can be reconciled commit by commit.
 *
 * It NEVER prints a matched value. Only rule name, commit, and file.
 *
 *   node scripts/security/audit-history-exposure.mjs
 *   node scripts/security/audit-history-exposure.mjs --json
 *
 * Exit codes: 0 scan completed (findings or not), 2 scan could not run.
 * Findings are information for the rotation register, not a build failure — the
 * values are already in history and cannot be un-leaked by failing a build.
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const json = process.argv.includes("--json");

/**
 * High-confidence patterns only. A generic "secret = ..." search over all of
 * history produces thousands of fixture hits and buries the real ones, so these
 * are the shapes that are unambiguously credentials.
 */
const RULES = [
  { rule: "aws-access-key-id", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { rule: "pem-private-key", pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { rule: "razorpay-key-id", pattern: /\brzp_(?:test|live)_[A-Za-z0-9]{14,}\b/ },
  { rule: "github-token", pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { rule: "slack-token", pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  { rule: "google-api-key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  // env-fallback literal: the pattern that hid two committed admin passwords
  // from the CI scanner until it was fixed.
  {
    rule: "env-fallback-credential",
    pattern:
      /\bprocess\.env\.[A-Z0-9_]*(?:PASSWORD|PASSWD|SECRET|TOKEN|API_KEY|ACCESS_KEY)[A-Z0-9_]*\s*(?:\|\||\?\?)\s*["'`]([^"'`\n]{6,})["'`]/,
    capture: 1,
  },
  {
    rule: "credential-constant-literal",
    pattern:
      /(?<![A-Za-z0-9_])(?:[A-Z0-9_]*(?:PASSWORD|PASSWD|SECRET|TOKEN|API_KEY|ACCESS_KEY))\s*=\s*([A-Za-z0-9!@%^&*_\-+=]{8,})\s*(?:;|,|$)/,
    capture: 1,
  },
  {
    rule: "db-url-with-password",
    pattern:
      /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s:/@]+:(?![$<{\[#%*])[^\s:/@>\]\s]{6,}@/,
  },
];

const PLACEHOLDER = [
  "example", "sample", "placeholder", "changeme", "change-me", "your_", "your-",
  "<", ">", "${", "{{", "redacted", "notasecret", "dummy", "fake", "todo",
  "xxxx", "****", "test", "insecure", "development", "password", "postgres",
  "secret", "token",
];

const looksLikePlaceholder = (value) => {
  const v = String(value ?? "").trim();
  if (v.length < 6) return true;
  const lower = v.toLowerCase();
  return PLACEHOLDER.some((w) => lower.includes(w));
};

function main() {
  const result = spawnSync(
    "git",
    ["log", "--all", "--no-color", "-p", "--format=@@COMMIT@@%H %s"],
    { cwd: root, encoding: "utf8", maxBuffer: 512 * 1024 * 1024 }
  );
  if (result.error) {
    console.error(`[history-audit] git log failed: ${result.error.message}`);
    process.exit(2);
  }
  if (result.status !== 0 && !result.stdout) {
    console.error(`[history-audit] git log exited ${result.status}`);
    process.exit(2);
  }

  const findings = new Map(); // rule|commit -> { rule, commit, subject, files:Set }
  let commit = "(unknown)";
  let subject = "";
  let currentFile = "(unknown)";
  let added = 0;
  let scanned = 0;

  for (const line of (result.stdout ?? "").split("\n")) {
    if (line.startsWith("@@COMMIT@@")) {
      const rest = line.slice("@@COMMIT@@".length);
      commit = rest.split(" ")[0];
      subject = rest.slice(commit.length + 1);
      continue;
    }
    if (line.startsWith("+++ b/")) {
      currentFile = line.slice("+++ b/".length).trim();
      continue;
    }
    if (!line.startsWith("+") || line.startsWith("+++")) continue;
    added += 1;

    const text = line.slice(1);
    for (const { rule, pattern, capture } of RULES) {
      pattern.lastIndex = 0;
      const match = pattern.exec(text);
      if (!match) continue;
      if (capture !== undefined) {
        const value = match[capture] ?? "";
        if (looksLikePlaceholder(value)) continue;
      }
      scanned += 1;
      const key = `${rule}|${commit}`;
      if (!findings.has(key)) {
        findings.set(key, { rule, commit, subject, files: new Set() });
      }
      findings.get(key).files.add(currentFile);
    }
  }

  const list = [...findings.values()]
    .map((f) => ({ ...f, files: [...f.files].sort() }))
    .sort((a, b) => a.rule.localeCompare(b.rule) || a.commit.localeCompare(b.commit));

  if (json) {
    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          scannedAddedLines: added,
          scopes: "git log --all -p (every commit on every branch)",
          findingCount: list.length,
          findings: list,
        },
        null,
        2
      )
    );
    process.exit(0);
  }

  console.log(`[history-audit] scanned ${added} added line(s) across git log --all`);
  if (!list.length) {
    console.log("[history-audit] no high-confidence credential shapes found in history.");
    process.exit(0);
  }

  console.log(`[history-audit] ${list.length} exposed value(s) by rule and commit:`);
  let lastRule = "";
  for (const f of list) {
    if (f.rule !== lastRule) {
      console.log(`\n  ${f.rule}`);
      lastRule = f.rule;
    }
    console.log(`    ${f.commit.slice(0, 8)}  ${f.files.join(", ")}   — ${f.subject.slice(0, 70)}`);
  }
  console.log(
    "\n[history-audit] Values are never printed. A finding here means the value is\n" +
      "  recoverable from any clone with `git log -p`, so it must be treated as\n" +
      "  compromised and rotated. See docs/release/CREDENTIAL_EXPOSURE_RECONCILIATION.md."
  );
  process.exit(0);
}

main();
