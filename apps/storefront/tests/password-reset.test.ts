import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The password reset request used to be a stub that answered "Reset link sent"
 * and sent nothing. These tests pin the two things that made that harmful: the
 * claim, and the absence of anywhere for the request to go.
 */

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const queries: { sql: string; params?: unknown[] }[] = [];
let insertReturns: unknown[] = [];

vi.mock("@/lib/db", () => ({
  query: vi.fn(async (sql: string, params?: unknown[]) => {
    queries.push({ sql, params });
    return [];
  }),
  queryResult: vi.fn(async (sql: string, params?: unknown[]) => {
    queries.push({ sql, params });
    if (/INSERT INTO password_reset_requests/i.test(sql)) {
      return { rows: insertReturns, rowCount: insertReturns.length };
    }
    return { rows: [], rowCount: 1 };
  }),
}));

beforeEach(() => {
  queries.length = 0;
  insertReturns = [];
  vi.resetModules();
});

describe("looksLikeEmail", () => {
  it("accepts ordinary addresses and rejects junk", async () => {
    const { looksLikeEmail } = await import("../lib/password-reset");
    expect(looksLikeEmail("someone@example.com")).toBe(true);
    expect(looksLikeEmail("  someone@example.com  ")).toBe(true);
    expect(looksLikeEmail("nope")).toBe(false);
    expect(looksLikeEmail("no@domain")).toBe(false);
    expect(looksLikeEmail(undefined)).toBe(false);
    expect(looksLikeEmail("a".repeat(300) + "@x.com")).toBe(false);
  });
});

describe("recordResetRequest", () => {
  it("writes a row even for an address that may not be a customer", async () => {
    const { recordResetRequest } = await import("../lib/password-reset");
    const result = await recordResetRequest("stranger@example.com");
    expect(result.recorded).toBe(true);
    // The point: no lookup, so there is nothing to infer from the answer.
    const sql = queries.map((entry) => entry.sql).join("\n");
    expect(sql).not.toMatch(/SELECT .* FROM customer/i);
  });

  it("keeps one open request per address", async () => {
    const { recordResetRequest } = await import("../lib/password-reset");
    await recordResetRequest("someone@example.com");
    const insert = queries.find((entry) => /INSERT INTO password_reset_requests/i.test(entry.sql));
    expect(insert?.sql).toMatch(/ON CONFLICT \(lower\(email\)\)/);
    expect(insert?.sql).toMatch(/DO NOTHING/);
  });

  it("does not record a malformed address", async () => {
    const { recordResetRequest } = await import("../lib/password-reset");
    const result = await recordResetRequest("not-an-email");
    expect(result.recorded).toBe(false);
    expect(queries.some((entry) => /INSERT INTO password_reset_requests/i.test(entry.sql))).toBe(false);
  });
});

describe("markResetHandled", () => {
  it("only closes a request that is still open", async () => {
    const { markResetHandled } = await import("../lib/password-reset");
    await markResetHandled(7, "studio@snehavrinda.in");
    const update = queries.find((entry) => /UPDATE password_reset_requests/i.test(entry.sql));
    expect(update?.sql).toMatch(/handled_at IS NULL/);
    expect(update?.params).toEqual([7, "studio@snehavrinda.in"]);
  });
});

describe("resetOutcome", () => {
  it("depends on configuration, not on the account", async () => {
    const { resetOutcome } = await import("../lib/password-reset");
    expect(resetOutcome(true)).toBe("sent");
    expect(resetOutcome(false)).toBe("studio");
  });
});

describe("the claim on the page matches what happens", () => {
  it("no longer promises a link unconditionally", () => {
    const page = read("app/[locale]/account/forgot-password/page.tsx");
    expect(page).not.toMatch(/>\s*Password reset sent\s*</);
    expect(page).toMatch(/emailReady/);
    expect(page).toMatch(/resetStudioBody/);
  });

  it("the endpoint answers the same way whatever the account", () => {
    const route = read("app/api/account/forgot-password/route.ts");
    expect(route).toMatch(/recordResetRequest/);
    expect(route).toMatch(/emailStatus\(\)\.level === "ready"/);
    // No customer lookup anywhere in the handler.
    expect(route).not.toMatch(/FROM customer/i);
    expect(route).toMatch(/checkRateLimit/);
  });

  it("the admin can see and close a request", () => {
    const route = read("app/api/admin/password-resets/route.ts");
    expect(route).toMatch(/requireAdmin/);
    expect(route).toMatch(/markResetHandled/);
    const page = read("app/admin/password-resets/page.tsx");
    expect(page).toMatch(/api\/admin\/password-resets/);
    const nav = read("components/admin-chrome.tsx");
    expect(nav).toMatch(/\/admin\/password-resets/);
  });
});
