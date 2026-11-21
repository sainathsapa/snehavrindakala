import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = join(__dirname, "..", "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

/** Runs a script and returns its exit code and combined output. */
function run(script: string, args: string[], env: Record<string, string> = {}) {
  try {
    const stdout = execFileSync("bash", [join(root, script), ...args], {
      encoding: "utf8",
      stdio: "pipe",
      env: { ...process.env, ...env },
    });
    return { code: 0, output: stdout };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return {
      code: failure.status ?? 1,
      output: `${failure.stdout ?? ""}${failure.stderr ?? ""}`,
    };
  }
}

/**
 * Backups are only worth having if a failed run cannot look like a good one.
 * These check the refusals, because the happy path is the part that gets
 * exercised by hand.
 */
describe("backup scripts", () => {
  it("are syntactically valid bash", () => {
    for (const script of ["scripts/backup-db.sh", "scripts/restore-drill.sh"]) {
      expect(execFileSync("bash", ["-n", join(root, script)], { encoding: "utf8" })).toBe("");
    }
  });

  it("restore-drill refuses a file that is not gzip", () => {
    const dir = mkdtempSync(join(tmpdir(), "svk-drill-"));
    const file = join(dir, "not-a-dump.sql.gz");
    writeFileSync(file, "this is not gzip");
    const { code, output } = run("scripts/restore-drill.sh", [file]);
    expect(code).not.toBe(0);
    expect(output).toMatch(/not valid gzip/);
  });

  it("restore-drill refuses to drop a database that is not a scratch name", () => {
    const dir = mkdtempSync(join(tmpdir(), "svk-drill-"));
    const file = join(dir, "dump.sql.gz");
    // Valid gzip, so the guard being tested is the name check, not the archive.
    execFileSync("bash", ["-c", `printf 'x' | gzip > "${file}"`]);
    const { code, output } = run("scripts/restore-drill.sh", [file], {
      RESTORE_DB: "medusa",
    });
    expect(code).not.toBe(0);
    expect(output).toMatch(/must end in _check/);
  });

  it("restore-drill exits with usage when given no file", () => {
    const { code, output } = run("scripts/restore-drill.sh", []);
    expect(code).toBe(2);
    expect(output).toMatch(/usage/);
  });

  it("backup-db fails loudly instead of writing a partial dump as a backup", () => {
    const dir = mkdtempSync(join(tmpdir(), "svk-backup-"));
    const { code, output } = run("scripts/backup-db.sh", [], {
      BACKUP_DIR: dir,
      // No reachable database: the run must fail, not report success.
      PG_CONTAINER: "does-not-exist",
      PGHOST: "127.0.0.1",
      PGPORT: "1",
    });
    expect(code).not.toBe(0);
    expect(output).not.toMatch(/backup ok/);
    // Whatever it wrote is a `.partial`, never a file that looks restorable.
    const files = execFileSync("bash", ["-c", `ls -1 "${dir}" || true`], {
      encoding: "utf8",
    });
    expect(files).not.toMatch(/\.sql\.gz$/);
  });
});

describe("backup wiring", () => {
  it("is scheduled by compose, behind a profile so laptops do not get surprise dumps", () => {
    const compose = read("docker-compose.yml");
    expect(compose).toMatch(/^ {2}backup:/m);
    expect(compose).toMatch(/profiles: \["ops"\]/);
    expect(compose).toMatch(/BACKUP_RETENTION_DAYS/);
  });

  it("documents the drill, not just the dump", () => {
    const doc = read("docs/BACKUPS.md");
    expect(doc).toMatch(/restore-drill\.sh/);
    expect(doc).toMatch(/A backup is a hypothesis until it has been restored/);
    expect(read("docs/DEPLOY.md")).toMatch(/docs\/BACKUPS\.md|BACKUPS\.md/);
  });

  it("keeps dumps out of git", () => {
    expect(read(".gitignore")).toMatch(/^backups\/$/m);
  });
});
