#!/usr/bin/env node
/**
 * Scan tracked files for committed secrets.
 *
 * WHY
 *
 * A credential committed to git is exposed from the moment the push lands, even
 * if the next commit removes it — the value stays in history and in every clone.
 * This gate fails the build on the common shapes (AWS keys, Razorpay keys,
 * private keys, hardcoded password/secret literals) so the rotation conversation
 * happens while the change is still in review, not after a deploy.
 *
 * It prints file:line and a rule name. It NEVER prints the matching text: a
 * scanner that echoes secrets into CI logs is just another place they leak.
 *
 *   node scripts/secret-scan.mjs
 *
 * Exclusions: untracked/ignored files, .env.example/.env.sample placeholders,
 * binary files, comment-only lines, and lines explicitly marked
 * `secret-scan: allow`. Note that an exclusion is never a reason to keep a real
 * credential in git — it only silences a known false positive.
 */

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".next", "dist", "build", "out", "coverage", "vendor",
  ".turbo", ".vercel", ".idea", ".vscode",
]);

const SKIP_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg", ".bmp", ".tiff",
  ".pdf", ".zip", ".gz", ".tgz", ".tar", ".woff", ".woff2", ".ttf", ".eot",
  ".otf", ".mp3", ".mp4", ".webm", ".mov", ".wav", ".map", ".snap", ".lock",
  ".db", ".sqlite", ".pyc", ".class", ".jar",
]);

/** Placeholder values that are documentation, not credentials. */
const PLACEHOLDER_WORDS = [
  "example", "sample", "placeholder", "changeme", "change-me", "change_me",
  "dummy", "fake", "redacted", "notasecret", "your_password", "your-password",
  "yourkey", "do-not-use", "dontuse", "insecure", "xxxxx", "todo", "fixme",
  "test", "mock", "s3cret",
];

const isPlaceholder = (value) => {
  const v = value.trim().toLowerCase();
  if (!v || v.length < 6) return true;
  if (/^(.)\1{5,}$/.test(v)) return true; // xxxxxx, ******
  if (/^(<.*>|\$\{.*\}|\{\{.*\}\})$/.test(v)) return true;
  if (v.includes("${")) return true; // template interpolation, not a literal
  if (v.length < 10 && /^[a-z0-9]+$/.test(v)) return true; // short fixture token
  if (PLACEHOLDER_WORDS.some((word) => v.includes(word))) return true;
  return false;
};

/** Only the rule name is reported; the matched text is discarded. */
const RULES = [
  {
    name: "aws-access-key-id",
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  },
  {
    name: "razorpay-key",
    pattern: /\brzp_(?:test|live)_[A-Za-z0-9]{8,}\b/g,
  },
  {
    name: "private-key",
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/g,
  },
  {
    // Quoted or fallback literals: password: "x", password = 'x',
    // SECRET || "x". A negative lookbehind stops ADMIN_PASSWORD etc. from
    // matching the bare word PASSWORD inside a longer identifier.
    name: "hardcoded-credential",
    pattern:
      /(?<![A-Za-z0-9_])(?:password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key)\b\s*(?:=|:|\|\|)\s*["'`]([^"'`\n]{6,})["'`]/gi,
    placeholderGroup: 1,
    skipInTests: true,
  },
  {
    // Only a bare literal, not an expression. `password = String(x)`,
    // `password = var.db_password` and `PASSWORD = process.env.X` are code,
    // not committed credentials.
    name: "password-equals-literal",
    pattern:
      /(?<![A-Za-z0-9_])(?:password|passwd|pwd)\b\s*=\s*([A-Za-z0-9!@%^&*_\-+=]{6,})\s*(?:;|$)/gim,
    placeholderGroup: 1,
    skipInTests: true,
  },
];

const isExampleEnv = (relative) => {
  const base = basename(relative).toLowerCase();
  return (
    base === ".env.example" ||
    base === ".env.sample" ||
    /\.env\.(example|sample|template)$/.test(base) ||
    /^env\.(example|sample|template)$/.test(base)
  );
};

/**
 * Test fixtures deliberately contain fake credentials ("correct-horse-battery",
 * "s3cr3t-pass"). The generic literal rules would fail every build on them, so
 * they are exempt there; provider-specific key formats and private keys are
 * still scanned in every file, including tests.
 */
const isTestFile = (relative) =>
  /(?:^|\/)(?:tests?|__tests__|e2e|spec|fixtures?|__fixtures__)(?:\/|$)/i.test(
    relative
  ) || /\.(?:test|spec)\.[cm]?[jt]sx?$/i.test(relative);

function trackedFiles() {
  try {
    const out = execFileSync("git", ["ls-files", "-z"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    return out.split("\0").filter(Boolean);
  } catch (error) {
    console.error(`[secret-scan] git ls-files failed: ${error.message}`);
    process.exit(2);
  }
}

function shouldScan(relative) {
  if (isExampleEnv(relative)) return false;
  const parts = relative.split("/");
  if (parts.some((p) => SKIP_DIRS.has(p))) return false;
  if (SKIP_EXT.has(extname(relative).toLowerCase())) return false;
  return true;
}

const findings = [];
let scanned = 0;

for (const relative of trackedFiles()) {
  if (!shouldScan(relative)) continue;
  let text;
  try {
    text = readFileSync(join(root, relative), "utf8");
  } catch {
    continue; // deleted or unreadable
  }
  if (text.includes("\0")) continue; // binary
  scanned++;

  const testFile = isTestFile(relative);
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^(?:\/\/|#|\/\*|\*|<!--)/.test(trimmed)) continue;
    if (/secret-scan:\s*allow/i.test(line)) continue;

    for (const rule of RULES) {
      if (testFile && rule.skipInTests) continue;
      rule.pattern.lastIndex = 0;
      let match;
      while ((match = rule.pattern.exec(line)) !== null) {
        if (rule.placeholderGroup !== undefined) {
          const candidate = match[rule.placeholderGroup] ?? "";
          if (isPlaceholder(candidate)) continue;
        }
        findings.push({ file: relative, line: i + 1, rule: rule.name });
      }
    }
  }
}

if (findings.length) {
  console.error(`[secret-scan] FAIL — ${findings.length} potential secret(s) in ${scanned} tracked files:`);
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  ${f.rule}`);
  }
  console.error(
    "[secret-scan] Values are intentionally not printed. Rotate any real credential " +
      "with the owner (see docs/release/CI_SECURITY.md) and remove it from git history; " +
      "use secret-scan: allow only for a verified false positive."
  );
  process.exit(1);
}

console.log(`[secret-scan] OK — no potential secrets found in ${scanned} tracked files.`);
