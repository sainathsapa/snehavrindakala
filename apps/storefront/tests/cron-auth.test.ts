import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { authoriseCron } from "../lib/cron-auth";

/**
 * A machine-triggered endpoint that mails customers is exactly the kind of route
 * that becomes an open relay when a variable is missing. These tests pin the
 * refusals.
 */

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const repoRoot = join(root, "..", "..");
const readRepo = (path: string) => readFileSync(join(repoRoot, path), "utf8");

describe("authoriseCron", () => {
  it("accepts a bearer token matching the secret", () => {
    expect(
      authoriseCron({ secret: "s3cret", authorization: "Bearer s3cret" }).ok
    ).toBe(true);
  });

  it("accepts the secret in the query string, for cron jobs that cannot set headers", () => {
    expect(authoriseCron({ secret: "s3cret", querySecret: "s3cret" }).ok).toBe(true);
  });

  it("refuses when the secret is unset rather than running open", () => {
    const result = authoriseCron({ secret: "", authorization: "Bearer anything" });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/CRON_SECRET is not set/);
    expect(authoriseCron({ secret: undefined, querySecret: "x" }).ok).toBe(false);
  });

  it("refuses a wrong or missing secret", () => {
    expect(authoriseCron({ secret: "s3cret", authorization: "Bearer nope" }).ok).toBe(false);
    expect(authoriseCron({ secret: "s3cret" }).ok).toBe(false);
    expect(authoriseCron({ secret: "s3cret", authorization: "Basic s3cret" }).ok).toBe(false);
  });

  it("does not accept a prefix or a different case", () => {
    for (const candidate of ["s3cre", " s3cretX", "S3CRET", "s3cret-x"]) {
      expect(
        authoriseCron({ secret: "s3cret", authorization: `Bearer ${candidate}` }).ok
      ).toBe(false);
    }
  });

  it("tolerates surrounding whitespace, because pasted secrets have it", () => {
    // Deliberate: a trailing newline from `cat .env` or a copied value is not an
    // attack, and rejecting it makes the operator think the secret is wrong.
    expect(
      authoriseCron({ secret: "s3cret", authorization: "Bearer s3cret\n" }).ok
    ).toBe(true);
  });

  it("answers 503 (not 401) when the secret is unset, so the cause is obvious", () => {
    const route = read("app/api/cron/cart-reminders/route.ts");
    expect(route).toMatch(/const status = process\.env\.CRON_SECRET \? 401 : 503/);
  });
});

describe("cart reminder cron route", () => {
  it("reuses the same rules as the admin page", () => {
    const route = read("app/api/cron/cart-reminders/route.ts");
    expect(route).toMatch(/listAbandonedCarts/);
    expect(route).toMatch(/sendCartReminder/);
    // No second implementation of "once per cart".
    expect(route).not.toMatch(/INSERT INTO cart_reminders/);
  });

  it("skips carts that were already reminded", () => {
    expect(read("app/api/cron/cart-reminders/route.ts")).toMatch(
      /filter\(\(cart\) => !cart\.reminded_at\)/
    );
  });

  it("is capped per run, so one hour cannot mail hundreds of people", () => {
    expect(read("app/api/cron/cart-reminders/route.ts")).toMatch(/MAX_PER_RUN = 25/);
  });

  it("is documented for the operator", () => {
    const deploy = readRepo("docs/DEPLOY.md");
    expect(deploy).toMatch(/api\/cron\/cart-reminders/);
    expect(deploy).toMatch(/CRON_SECRET/);
  });
});

describe("the job has a caller", () => {
  const compose = readFileSync(join(root, "..", "..", "docker-compose.yml"), "utf8");

  it("a compose service runs the reminder endpoint on a schedule", () => {
    expect(compose).toMatch(/^\s{2}cron:/m);
    expect(compose).toMatch(/api\/cron\/cart-reminders/);
    expect(compose).toMatch(/CRON_INTERVAL_SECONDS/);
    // Beared in a header, not the query string: query strings land in logs.
    expect(compose).toMatch(/Authorization: Bearer/);
  });

  it("refuses to start without a secret instead of looping on 503s", () => {
    expect(compose).toMatch(/CRON_SECRET is empty/);
  });

  it("is behind the ops profile, so a laptop does not start it", () => {
    expect(compose).toMatch(/profiles: \["ops"\]/);
  });

  it("the deployment doc points at the service", () => {
    const docs = readFileSync(join(root, "..", "..", "docs", "DEPLOY.md"), "utf8");
    expect(docs).toMatch(/docker compose --profile ops up -d cron/);
  });
});
