#!/usr/bin/env node
/**
 * Fail the build if a Docker image could absorb a credential at build time.
 *
 * WHY
 *
 * A `.dockerignore` rule is easy to lose in a refactor and impossible to notice
 * at runtime: the image still builds, still starts, and silently contains
 * whatever the context carried. Both images shipped a real app-level .env for
 * several commits for exactly that reason — the ignore pattern covered `.env`
 * at the repository root but not the glob that matches every app-level file.
 *
 * This guards the three ways a credential gets into an image:
 *
 *   1. BUILD CONTEXT — an env/credential file that is not excluded, or an
 *      exclusion that is later re-included with a `!` negation;
 *   2. BUILD ARGUMENTS — `ARG`/`--build-arg` whose name says SECRET/TOKEN/
 *      PASSWORD/KEY (public NEXT_PUBLIC_* identifiers are allowlisted, with the
 *      reason recorded);
 *   3. IMAGE ENV — `ENV SECRET_NAME=` declarations that give the container a
 *      default value instead of forcing the orchestrator to inject one.
 *
 *   node scripts/security/verify-build-context.mjs
 *   node scripts/security/verify-build-context.mjs --json
 *
 * Exit codes: 0 clean, 1 violations, 2 the check could not run.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const dropsArgs = process.argv.includes("--json");
const violations = [];
const notes = [];
const checks = [];

const bad = (check, message) => violations.push({ check, message });
const ok = (check, message) => checks.push({ check, message });

// ── 1. build context ────────────────────────────────────────────────────────
function checkDockerignore() {
  const path = join(root, ".dockerignore");
  if (!existsSync(path)) {
    bad("dockerignore", ".dockerignore is missing — the whole repository would be the build context");
    return;
  }
  const lines = readFileSync(path, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  const has = (pattern) => lines.includes(pattern);

  // Every app dir in this repo keeps its own .env, so a root-only pattern is
  // not enough. Both spellings are required: `**/.env` for the tree and
  // `**/.env.*` for the .env.local / .env.production variants.
  const required = [
    ["**/.env", "app-level .env files must be excluded"],
    ["**/.env.*", "app-level .env.* variants must be excluded"],
  ];
  for (const [pattern, why] of required) {
    if (has(pattern)) ok("dockerignore", `excludes ${pattern}`);
    else bad("dockerignore", `.dockerignore does not exclude "${pattern}" — ${why}`);
  }

  // A `!` negation can re-include something an earlier rule excluded. Only the
  // documentation templates are acceptable.
  const negations = lines.filter((l) => l.startsWith("!"));
  for (const negation of negations) {
    const allowed = negation === "!.env.example" || negation === "!**/.env.example";
    if (!allowed) {
      bad(
        "dockerignore",
        `negation "${negation}" re-includes a path in the build context; only ` +
          `!.env.example / !**/.env.example are permitted`
      );
    }
  }
  if (negations.length) ok("dockerignore", `negations reviewed (${negations.length})`);

  // Belt and braces: simulate whether a real env file would be matched by an
  // exclusion. Cheap substring check against the pattern list rather than a
  // full ignore-engine implementation.
  for (const candidate of ["apps/storefront/.env", "apps/backend/.env", ".env"]) {
    const base = candidate.split("/").pop();
    const matched =
      lines.some((l) => l === base || l === `**/${base}`) ||
      lines.some((l) => l.endsWith("*") && candidate.startsWith(l.slice(0, -1)));
    if (matched) ok("dockerignore", `${candidate} is excluded from the context`);
    else bad("dockerignore", `${candidate} would be copied into the build context`);
  }
}

// ── files that should never exist in the repository tree, ignored or not ────
function findLocalSecretFiles() {
  const forbidden = [];
  const walk = (dir, depth = 0) => {
    if (depth > 4) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".git", ".next", "dist", ".turbo", "backups"].includes(entry.name)) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
        continue;
      }
      if (/^\.env$|^\.env\.(local|production|development|staging|test.*)$/.test(entry.name)) {
        forbidden.push(relative(root, full));
      }
    }
  };
  walk(root);
  // These files are expected on a developer machine and are gitignored; the
  // check that matters is that they are excluded from the Docker context, which
  // checkDockerignore covers. Report them so the evidence is explicit.
  return forbidden;
}

// ── 2. Dockerfiles ──────────────────────────────────────────────────────────
const PUBLIC_BUILD_ARGS = new Map([
  [
    "NEXT_PUBLIC_RAZORPAY_KEY_ID",
    "Razorpay key id, not the key secret: it is published to the browser by the checkout widget",
  ],
  ["NEXT_PUBLIC_STOREFRONT_URL", "public site URL"],
  ["NEXT_PUBLIC_MEDUSA_BACKEND_URL", "public API URL"],
  ["NEXT_PUBLIC_SANITY_PROJECT_ID", "public Sanity project id"],
  ["NEXT_PUBLIC_SANITY_DATASET", "public Sanity dataset name"],
]);

const SECRETISH = /(SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE_KEY|CREDENTIAL|API_KEY|ACCESS_KEY|_DSN)/i;

function checkDockerfile(relPath) {
  const path = join(root, relPath);
  if (!existsSync(path)) {
    bad("dockerfile", `${relPath} not found`);
    return;
  }
  const lines = readFileSync(path, "utf8").split("\n");
  const label = relPath;

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const where = `${label}:${index + 1}`;

    // COPY . . or ADD . . drags the entire context in, defeating .dockerignore
    // review at the file level.
    if (/^(COPY|ADD)\s+(\.\s+\.|\.\/\s+\.\/)/.test(trimmed)) {
      bad("dockerfile", `${where} copies the whole build context ("${trimmed}"); copy explicit paths`);
    }

    // Explicitly copying an env file.
    if (/^(COPY|ADD)\b/.test(trimmed) && /(^|\s|\/)\.env(\.|\s|$)/.test(trimmed) && !/\.env\.example/.test(trimmed)) {
      bad("dockerfile", `${where} copies an environment file into the image ("${trimmed}")`);
    }

    // ENV defaults for credentials: inherited by the container whether or not
    // the orchestrator injects a real value.
    const envMatch = trimmed.match(/^ENV\s+([A-Za-z_][A-Za-z0-9_]*)\s*(=|\s)/);
    if (envMatch && SECRETISH.test(envMatch[1])) {
      const value = trimmed.slice(trimmed.indexOf(envMatch[1]) + envMatch[1].length).replace(/^[=\s]+/, "");
      if (value.trim() === "" || value.trim() === '""' || value.trim() === "''") {
        bad(
          "dockerfile",
          `${where} declares ENV ${envMatch[1]} with an empty default — a container can start ` +
            `with an empty credential; inject it at runtime and validate at startup`
        );
      } else {
        bad("dockerfile", `${where} declares ENV ${envMatch[1]} with a value — credentials must not be baked`);
      }
    }
  });

  // ARG declarations that look like credentials.
  for (const line of lines) {
    const trimmed = line.trim();
    const argMatch = trimmed.match(/^ARG\s+([A-Za-z_][A-Za-z0-9_]*)/);
    if (!argMatch) continue;
    const name = argMatch[1];
    if (!SECRETISH.test(name)) continue;
    if (PUBLIC_BUILD_ARGS.has(name)) {
      ok("dockerfile", `${label} ARG ${name} allowlisted (${PUBLIC_BUILD_ARGS.get(name)})`);
      continue;
    }
    bad(
      "dockerfile",
      `${label} takes ARG ${name} — build arguments are recorded in image history and cannot ` +
        `carry a credential; use a BuildKit secret mount or runtime injection`
    );
  }
  ok("dockerfile", `${label} scanned (${lines.length} lines)`);
}

// ── 3. compose build args ───────────────────────────────────────────────────
function checkCompose() {
  const path = join(root, "docker-compose.yml");
  if (!existsSync(path)) {
    bad("compose", "docker-compose.yml not found");
    return;
  }
  const lines = readFileSync(path, "utf8").split("\n");
  let inBuildArgs = false;
  let buildArgsIndent = 0;

  lines.forEach((line, index) => {
    const where = `docker-compose.yml:${index + 1}`;
    if (/^\s*args:\s*$/.test(line)) {
      inBuildArgs = true;
      buildArgsIndent = line.search(/\S/);
      return;
    }
    if (inBuildArgs) {
      const indent = line.search(/\S/);
      if (line.trim() && indent <= buildArgsIndent) {
        inBuildArgs = false;
      } else {
        const m = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:/);
        if (m && SECRETISH.test(m[1]) && !PUBLIC_BUILD_ARGS.has(m[1])) {
          bad("compose", `${where} passes build arg ${m[1]} — a credential must not travel through a build`);
        }
      }
    }
  });

  // `env_file:` hands a whole file to the container at runtime. That is a
  // legitimate deployment pattern for compose, but it must not be combined with
  // a committed file, so confirm every env_file is gitignored.
  const gitignore = existsSync(join(root, ".gitignore")) ? readFileSync(join(root, ".gitignore"), "utf8") : "";
  const envFiles = [...readFileSync(path, "utf8").matchAll(/^\s*-\s*([^\s:#]+\.env[^\s:#]*)/gm)].map((m) => m[1]);
  for (const envFile of [...new Set(envFiles)]) {
    const ignored = gitignore.split("\n").some((l) => l.trim() === ".env" || l.trim() === envFile.replace("./", ""));
    if (ignored) ok("compose", `env_file ${envFile} is gitignored`);
    else bad("compose", `env_file ${envFile} is not covered by .gitignore`);
  }
  ok("compose", "build args reviewed");
}

// ── 4. .env.example must stay a template ───────────────────────────────────
function checkEnvExample() {
  const path = join(root, ".env.example");
  if (!existsSync(path)) {
    bad("env-example", ".env.example is missing");
    return;
  }
  const text = readFileSync(path, "utf8");
  let suspicious = 0;
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m || !SECRETISH.test(m[1])) continue;
    const value = m[2].trim().replace(/^["']|["']$/g, "");
    if (!value) continue;
    // A template ships either an empty value, a placeholder, or a reference.
    const templateish =
      value.includes("$") || value.includes("<") || value.includes("{{") ||
      /example|changeme|change-me|placeholder|your-|your_|dummy|xxxx|replace|generate|openssl|\.\.\./i.test(value);
    if (!templateish && value.length >= 24) {
      suspicious += 1;
    }
  }
  if (suspicious) {
    bad("env-example", `.env.example has ${suspicious} credential-shaped value(s) that do not look like placeholders`);
  } else {
    ok("env-example", ".env.example contains placeholders only");
  }
}

function main() {
  checkDockerignore();
  const localEnvFiles = findLocalSecretFiles();
  checkDockerfile("apps/storefront/Dockerfile");
  checkDockerfile("apps/backend/Dockerfile");
  checkCompose();
  checkEnvExample();

  if (dropsArgs) {
    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          verdict: violations.length ? "FAIL" : "PASS",
          checks,
          violations,
          localEnvFilesPresentButIgnored: localEnvFiles,
        },
        null,
        2
      )
    );
  } else {
    console.log(`[build-context] local env files present (must stay out of the context):`);
    if (localEnvFiles.length) for (const f of localEnvFiles) console.log(`  - ${f}`);
    else console.log("  (none)");
    console.log(`[build-context] checks passed: ${checks.length}`);
    if (violations.length) {
      console.error(`[build-context] FAIL — ${violations.length} violation(s):`);
      for (const v of violations) console.error(`  [${v.check}] ${v.message}`);
      console.error(
        "\n[build-context] An image built from this state can absorb a credential.\n" +
          "  See docs/release/DOCKER_SECRET_EXPOSURE_REPORT.md for how this happened before."
      );
    } else {
      console.log("[build-context] PASS — build context, build args and image ENV are clean.");
    }
  }
  process.exit(violations.length ? 1 : 0);
}

main();
