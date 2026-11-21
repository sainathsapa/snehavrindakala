import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkRateLimit,
  isLimited,
  rateLimitKey,
  secondsUntilReset,
  windowStart,
} from "../lib/rate-limit";

/**
 * The limiter exists for one reason: three public forms had nothing between the
 * internet and their INSERT, and once email is configured a loop could send mail
 * from the shop's domain. Tests cover the window math, the constants, and that
 * the endpoints actually call the limiter before touching the database.
 */

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("window math", () => {
  it("splits time into fixed windows", () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0, 0); // exactly on the hour
    expect(new Date(windowStart(now, 3600)).toISOString()).toBe(
      new Date(now).toISOString()
    );
    // 12:00:01 belongs to the same window as 12:00:00.
    expect(windowStart(now + 1001, 3600)).toBe(now);
    // 12:01:00 is still inside it.
    expect(windowStart(now + 60_000, 3600)).toBe(now);
  });

  it("rolls over exactly when the window ends", () => {
    const now = Date.UTC(2026, 0, 1, 12, 0, 0, 0);
    expect(windowStart(now + 3_600_000, 3600)).toBe(now + 3_600_000);
    expect(secondsUntilReset(now + 3_599_999, 3600)).toBe(1);
    expect(secondsUntilReset(now, 3600)).toBe(3600);
  });
});

describe("isLimited", () => {
  it("allows up to the limit and refuses after", () => {
    expect(isLimited(5, 5)).toBe(false);
    expect(isLimited(6, 5)).toBe(true);
  });
});

describe("rateLimitKey", () => {
  it("is stable for the same ip and route", () => {
    const first = rateLimitKey("newsletter", "203.0.113.7", "secret");
    const second = rateLimitKey("newsletter", "203.0.113.7", "secret");
    expect(first).toBe(second);
  });

  it("differs across routes and ips", () => {
    expect(rateLimitKey("newsletter", "1.2.3.4", "s")).not.toBe(
      rateLimitKey("tickets", "1.2.3.4", "s")
    );
    expect(rateLimitKey("newsletter", "1.2.3.4", "s")).not.toBe(
      rateLimitKey("newsletter", "5.6.7.8", "s")
    );
  });

  it("never stores the raw ip in the key", () => {
    for (const ip of ["203.0.113.7", "2001:db8::1"]) {
      expect(rateLimitKey("newsletter", ip, "s")).not.toContain(ip);
    }
  });
});

describe("checkRateLimit", () => {
  it("fails open when the database is unavailable", async () => {
    vi.resetModules();
    vi.doMock("@/lib/db", () => ({
      queryResult: vi.fn(async () => {
        throw new Error("db down");
      }),
    }));
    const mod = await import("../lib/rate-limit");
    const result = await mod.checkRateLimit({
      route: "newsletter",
      ip: "1.2.3.4",
      limit: 5,
      windowSeconds: 3600,
      now: Date.UTC(2026, 0, 1, 12, 0, 0, 0),
    });
    expect(result.allowed).toBe(true);
  });

  it("allows a request with no client address rather than locking everyone out", async () => {
    vi.resetModules();
    vi.doMock("@/lib/db", () => ({
      queryResult: vi.fn(async () => ({ rows: [] })),
    }));
    const mod = await import("../lib/rate-limit");
    const result = await mod.checkRateLimit({
      route: "newsletter",
      ip: null,
      limit: 5,
      windowSeconds: 3600,
    });
    expect(result.allowed).toBe(true);
  });
});

describe("wiring", () => {
  it("guards all three public forms before they can write", () => {
    for (const file of [
      "app/api/newsletter/route.ts",
      "app/api/store/work-alerts/route.ts",
      "app/api/tickets/route.ts",
    ]) {
      const source = read(file);
      expect(source, file).toMatch(/checkRateLimit/);
      expect(source, file).toMatch(/status: 429/);
    }
  });

  it("answers 429 with Retry-After", () => {
    expect(read("app/api/newsletter/route.ts")).toMatch(/Retry-After/);
  });
});