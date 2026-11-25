#!/usr/bin/env node
/**
 * Prove the dependency-exception policy actually fails when it should.
 *
 * WHY
 *
 * "CI enforces expiring exceptions" is a claim about failure behaviour, and a
 * policy that has never failed is indistinguishable from a policy that cannot
 * fail. This runs apps/storefront/scripts/audit-deps.mjs against a synthetic
 * audit report and a series of register fixtures, and asserts the exact exit
 * code for each case — including every way an exception must be rejected.
 *
 * It is a self-contained test: no network, no pnpm audit, no dependency on the
 * real lockfile, so it runs in the same second on any machine and in CI.
 *
 *   node scripts/security/test-dependency-policy.mjs
 *
 * Exit codes: 0 all cases behaved, 1 a case regressed, 2 the test could not run.
 */

import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const auditScript = join(root, "apps", "storefront", "scripts", "audit-deps.mjs");

const today = new Date();
const iso = (offsetDays) => {
  const d = new Date(today.getTime() + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
};

/** Synthetic report shaped like `pnpm audit --json` (npm advisory shape). */
const REPORT = {
  advisories: {
    "1241260": {
      module_name: "tinypool",
      severity: "critical",
      title: "Tinypool: prototype pollution gadget to RCE",
      url: "https://github.com/advisories/GHSA-5gmw-xhrv-c9v3",
      findings: [
        {
          version: "1.1.1",
          paths: ["apps__storefront>vitest>tinypool", "apps__backend>vitest>tinypool"],
        },
      ],
    },
    "1117015": {
      module_name: "postcss",
      severity: "high",
      title: "PostCSS: unescaped </style> in stringify output",
      url: "https://github.com/advisories/GHSA-qx2v-qp2m-jg93",
      findings: [{ version: "8.4.31", paths: ["apps__storefront>next>postcss"] }],
    },
  },
};

const GOOD = {
  package: "tinypool",
  installedVersion: "1.1.1",
  advisory: "GHSA-5GMW-XHRV-C9V3",
  severity: "critical",
  dependencyPath: "apps__storefront>vitest>tinypool",
  reason: "No upgrade path inside the current vitest major; reviewed and accepted.",
  exploitability: "Only reachable by code that controls worker options; our tests do not.",
  reachability: "devDependency test runner, never shipped in a runtime image",
  compensatingControls: "CI runs with no untrusted test inputs; dependency pinned",
  owner: "release-engineering",
  approvedAt: iso(-1),
  expiresAt: iso(7),
  criticalAuthorized: true,
  remediationPlan: "Upgrade vitest major in the next sprint and delete this entry.",
};

const POSTCSS_OK = {
  package: "postcss",
  installedVersion: "8.4.31",
  advisory: "GHSA-QX2V-QP2M-JG93",
  severity: "high",
  dependencyPath: "apps__storefront>next>postcss",
  reason: "Pinned transitively by next; override reviewed and applied instead.",
  exploitability: "Requires attacker-controlled CSS parsed at build time.",
  reachability: "build-only postcss stringify path",
  compensatingControls: "no untrusted CSS sources; lockfile pinned",
  owner: "release-engineering",
  approvedAt: iso(-1),
  expiresAt: iso(7),
  remediationPlan: "Bump once next lifts its postcss pin.",
};

const cases = [
  {
    name: "no exceptions file → advisory fails the build",
    exceptions: null,
    expectExit: 1,
    expectText: "unexcepted",
  },
  {
    name: "empty register → advisory fails the build",
    exceptions: { exceptions: [] },
    expectExit: 1,
  },
  {
    name: "valid, narrowly scoped, in-window exception → passes",
    // Both advisories in the fixture must be covered, otherwise the build still
    // (correctly) fails on the one that is not — that case is asserted below.
    exceptions: { exceptions: [GOOD, POSTCSS_OK] },
    expectExit: 0,
    expectText: "excepted",
  },
  {
    name: "one valid exception does not cover a second unrelated advisory → fails",
    exceptions: { exceptions: [GOOD] },
    expectExit: 1,
    expectText: "postcss",
  },
  {
    name: "expired exception → ignored, advisory still fails",
    exceptions: { exceptions: [{ ...GOOD, approvedAt: iso(-20), expiresAt: iso(-1) }] },
    expectExit: 1,
    expectText: "EXPIRED",
  },
  {
    name: "expiry on the approved day itself (zero-day window) → fails as expired",
    exceptions: { exceptions: [{ ...GOOD, approvedAt: iso(-1), expiresAt: iso(-1) }] },
    expectExit: 1,
  },
  {
    name: "window longer than 14 days → rejected",
    exceptions: { exceptions: [{ ...GOOD, approvedAt: iso(-1), expiresAt: iso(15) }] },
    expectExit: 1,
    expectText: "14-day maximum",
  },
  {
    name: "package version drift → exception no longer applies",
    exceptions: { exceptions: [{ ...GOOD, installedVersion: "1.0.0" }] },
    expectExit: 1,
    expectText: "version changed",
  },
  {
    name: "dependency path drift → exception no longer applies",
    exceptions: { exceptions: [{ ...GOOD, dependencyPath: "apps__backend>some-other>tinypool" }] },
    expectExit: 1,
    expectText: "dependency path no longer matches",
  },
  {
    name: "exception suppresses a different advisory → rejected for that advisory",
    exceptions: { exceptions: [{ ...GOOD, advisory: "GHSA-QX2V-QP2M-JG93", severity: "moderate" }] },
    expectExit: 1,
  },
  {
    name: "package-level ignore without an advisory id → rejected",
    exceptions: { exceptions: [{ ...GOOD, advisory: "tinypool" }] },
    expectExit: 1,
    expectText: "invalid advisory id",
  },
  {
    name: "critical advisory without criticalAuthorized → rejected",
    exceptions: { exceptions: [{ ...GOOD, criticalAuthorized: false }] },
    expectExit: 1,
    expectText: "criticalAuthorized",
  },
  {
    name: "missing reachability assessment → rejected",
    exceptions: { exceptions: [{ ...GOOD, reachability: undefined }] },
    expectExit: 1,
    expectText: "reachability",
  },
  {
    name: "severity mismatch → rejected",
    exceptions: { exceptions: [{ ...GOOD, severity: "low" }] },
    expectExit: 1,
  },
  {
    name: "register is not valid JSON → nothing suppressed",
    rawExceptions: "{ not json",
    expectExit: 1,
  },
  {
    name: "blanket wildcard id → rejected",
    exceptions: { exceptions: [{ ...GOOD, advisory: "*" }] },
    expectExit: 1,
  },
];

function run(auditPath, exceptionsPath) {
  return spawnSync(process.execPath, [auditScript, `--input=${auditPath}`, `--exceptions=${exceptionsPath}`], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, AUDIT_LEVEL: "high", AUDIT_EXCEPTIONS_JSON: "" },
  });
}

function main() {
  const tmp = mkdtempSync(join(tmpdir(), "dep-policy-"));
  const auditPath = join(tmp, "audit.json");
  writeFileSync(auditPath, JSON.stringify(REPORT, null, 2));

  let failures = 0;
  let index = 0;

  try {
    for (const testCase of cases) {
      index += 1;
      const exceptionsPath = join(tmp, `exceptions-${index}.json`);
      if (testCase.rawExceptions !== undefined) {
        writeFileSync(exceptionsPath, testCase.rawExceptions);
      } else if (testCase.exceptions === null) {
        // Point at a path that does not exist.
        rmSync(exceptionsPath, { force: true });
      } else {
        writeFileSync(exceptionsPath, JSON.stringify(testCase.exceptions, null, 2));
      }

      const result = run(auditPath, exceptionsPath);
      const output = `${result.stdout || ""}${result.stderr || ""}`;
      const codeOk = result.status === testCase.expectExit;
      const textOk =
        !testCase.expectText || output.includes(testCase.expectText);

      if (codeOk && textOk) {
        console.log(`  PASS  ${testCase.name}  (exit ${result.status})`);
      } else {
        failures += 1;
        console.log(
          `  FAIL  ${testCase.name}\n` +
            `        expected exit ${testCase.expectExit}` +
            `${testCase.expectText ? ` and text "${testCase.expectText}"` : ""}, ` +
            `got exit ${result.status}${textOk ? "" : " and no matching text"}`
        );
        const relevant = output
          .split("\n")
          .filter((line) => line.trim())
          .slice(-6)
          .map((line) => `        | ${line}`)
          .join("\n");
        if (relevant) console.log(relevant);
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  console.log(
    `\n[dependency-policy] ${cases.length - failures}/${cases.length} cases behaved as specified`
  );
  if (failures) {
    console.error(
      "[dependency-policy] FAIL — the exception gate does not enforce the documented policy.\n" +
        "  A suppression that is not rejected is a suppression that can hide a vulnerability."
    );
    process.exit(1);
  }
  console.log("[dependency-policy] PASS — expiry, drift, scope and authorization are all enforced.");
}

main();
