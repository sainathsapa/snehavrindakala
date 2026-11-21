import { describe, expect, it, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * The off-site backup hook, and the records that were out of date.
 *
 * The gap `docs/BACKUPS.md` described — "no off-site copy" — was true and stayed
 * true because nothing in the repo called anything. Now a script does, and these
 * tests pin the behaviours that make it safe to run unattended: it never reports
 * success when nothing was configured, it refuses to ship a corrupt dump, and it
 * never deletes at the destination.
 */

const repo = join(__dirname, "..", "..", "..");
const script = join(repo, "scripts", "offsite-push.sh");
const read = (path: string) => readFileSync(join(repo, path), "utf8");

const dirs: string[] = [];
function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), "offsite-"));
  dirs.push(dir);
  mkdirSync(join(dir, "src"), { recursive: true });
  mkdirSync(join(dir, "dst"), { recursive: true });
  return dir;
}

function run(args: string[], env: Record<string, string> = {}, dir?: string) {
  try {
    const stdout = execFileSync("sh", [script, ...args], {
      env: { ...process.env, BACKUP_OFFSITE_TARGET: "", ...env },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out: stdout };
  } catch (err: any) {
    return { code: err.status ?? 1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

describe("offsite-push.sh", () => {
  it("says nothing was copied when no target is configured, and does not fail", () => {
    const dir = sandbox();
    writeFileSync(join(dir, "src", "medusa-x.sql.gz"), gzipSync("hello"));
    const { code, out } = run([join(dir, "src")]);
    expect(code).toBe(0);
    // The wording matters: "not configured" cannot be mistaken for "copied".
    expect(out).toMatch(/not configured/);
    expect(out).toMatch(/remain on this machine only/);
  });

  it("fails loudly with --require once a target is supposed to exist", () => {
    const dir = sandbox();
    writeFileSync(join(dir, "src", "medusa-x.sql.gz"), gzipSync("hello"));
    const { code, out } = run(["--require", join(dir, "src")]);
    expect(code).not.toBe(0);
    expect(out).toMatch(/BACKUP_OFFSITE_TARGET is empty/);
  });

  it("copies to a local target and reports what it did", () => {
    const dir = sandbox();
    writeFileSync(join(dir, "src", "medusa-x.sql.gz"), gzipSync("hello"));
    const { code, out } = run([join(dir, "src")], {
      BACKUP_OFFSITE_TARGET: join(dir, "dst"),
    });
    expect(code).toBe(0);
    expect(out).toMatch(/1 dump\(s\)/);
    expect(readdirSync(join(dir, "dst"))).toEqual(["medusa-x.sql.gz"]);
  });

  it("refuses to copy anything when one dump is corrupt", () => {
    const dir = sandbox();
    writeFileSync(join(dir, "src", "medusa-good.sql.gz"), gzipSync("hello"));
    writeFileSync(join(dir, "src", "medusa-bad.sql.gz"), "not gzip at all");
    const { code, out } = run([join(dir, "src")], {
      BACKUP_OFFSITE_TARGET: join(dir, "dst"),
    });
    expect(code).not.toBe(0);
    expect(out).toMatch(/is not valid gzip/);
    // Nothing was shipped: a corrupt copy off-site is the one someone trusts
    // after the disk is gone.
    expect(readdirSync(join(dir, "dst"))).toEqual([]);
  });

  it("does not overwrite a good earlier copy at the destination", () => {
    const dir = sandbox();
    writeGood(dir, "medusa-x.sql.gz", "first");
    const first = run([join(dir, "src")], { BACKUP_OFFSITE_TARGET: join(dir, "dst") });
    expect(first.code).toBe(0);
    const before = readFileSync(join(dir, "dst", "medusa-x.sql.gz"));

    writeGood(dir, "medusa-x.sql.gz", "second, different");
    run([join(dir, "src")], { BACKUP_OFFSITE_TARGET: join(dir, "dst") });
    expect(readFileSync(join(dir, "dst", "medusa-x.sql.gz")).equals(before)).toBe(true);
  });

  it("runs under sh, not bash", () => {
    // The nightly job runs this inside the Alpine postgres image, which has
    // busybox ash. A bash-only script passes every manual run and fails at 03:00.
    expect(read("scripts/offsite-push.sh").split("\n")[0]).toBe("#!/bin/sh");
  });

  it("the nightly backup service calls it", () => {
    const compose = read("docker-compose.yml");
    expect(compose).toMatch(/offsite-push\.sh/);
    expect(compose).toMatch(/BACKUP_OFFSITE_TARGET/);
  });

  it("the docs no longer claim there is no off-site hook", () => {
    const docs = read("docs/BACKUPS.md");
    expect(docs).toContain("scripts/offsite-push.sh");
    expect(docs).not.toMatch(/- \*\*No off-site copy\*\* until the operator configures one/);
  });
});

function writeGood(dir: string, name: string, body: string) {
  writeFileSync(join(dir, "src", name), gzipSync(body));
}

describe("the records match the code", () => {
  it("ADR-0005 carries a decision and a trigger, not just an outcome", () => {
    const adr = read("docs/adr/0005-static-rendering-blocked-by-currency-cookie.md");
    expect(adr).toMatch(/deferred with a stated trigger/);
    expect(adr).toMatch(/Trigger to revisit/);
    // The reverted attempt must stay recorded: it is the reason root-params alone
    // is not the answer.
    expect(adr).toMatch(/root-params/);
  });

  it("the UX checklist reflects what shipped and what is limited", () => {
    const checklist = read("docs/ux-implementation-checklist.md");
    expect(checklist).toMatch(/6\.5 Honesty pass/);
    expect(checklist).toMatch(/6\.6 Known limits/);
    // The stale test counts were the giveaway that this file had stopped being
    // maintained; assert it no longer says 97.
    expect(checklist).not.toMatch(/97 tests pass/);
  });
});
