import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ROLE_PERMISSIONS,
  can,
  getDefaultSuperAdminEmail,
  hasPermission,
  type Role,
} from "../lib/rbac";
import {
  ADMIN_SESSION_MAX_AGE,
  signAdminSession,
  verifyAdminSession,
} from "../lib/admin-session";
import { getAdminSessionSecret } from "../lib/session-secret";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("RBAC matrix is enforced by data, not by the UI", () => {
  it("a viewer cannot modify products or approve refunds", () => {
    expect(hasPermission("viewer", "products:write")).toBe(false);
    expect(hasPermission("viewer", "products:delete")).toBe(false);
    expect(hasPermission("viewer", "refunds:approve")).toBe(false);
    expect(can("viewer", "products:write", "refunds:approve")).toBe(false);
  });

  it("finance can approve refunds but cannot modify products or manage users", () => {
    expect(hasPermission("finance", "refunds:approve")).toBe(true);
    expect(hasPermission("finance", "products:write")).toBe(false);
    expect(hasPermission("finance", "users:write")).toBe(false);
  });

  it("support can request a refund but cannot approve one", () => {
    expect(hasPermission("support", "refunds:write")).toBe(true);
    expect(hasPermission("support", "refunds:approve")).toBe(false);
  });

  it("super admin has every permission, partner is scoped, viewer is read-only", () => {
    const all = ROLE_PERMISSIONS.super_admin;
    for (const permission of all) {
      expect(hasPermission("super_admin", permission)).toBe(true);
    }
    expect(hasPermission("partner", "users:write")).toBe(false);
    expect(hasPermission("partner", "settings:write")).toBe(false);
    const writes = (ROLE_PERMISSIONS.viewer || []).filter((p) => p.endsWith(":write") || p.endsWith(":delete") || p === "refunds:approve");
    expect(writes).toEqual([]);
  });

  it("denies unknown roles and unknown permissions (fail closed)", () => {
    expect(hasPermission("not_a_role", "products:write")).toBe(false);
    expect(hasPermission("" as Role, "orders:read")).toBe(false);
  });

  it("has no built-in super-admin email default", () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    vi.stubEnv("ADMIN_EMAIL", "");
    expect(getDefaultSuperAdminEmail()).toBeNull();
    vi.stubEnv("ADMIN_EMAILS", "owner@example.com");
    expect(getDefaultSuperAdminEmail()).toBe("owner@example.com");
  });
});

describe("admin session signing", () => {
  it("round-trips a valid session", () => {
    const token = signAdminSession({ email: "a@b.co", role: "manager" });
    const session = verifyAdminSession(token);
    expect(session?.email).toBe("a@b.co");
    expect(session?.role).toBe("manager");
    expect(session!.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("rejects a tampered payload", () => {
    const token = signAdminSession({ email: "a@b.co", role: "viewer" });
    const [body, sig] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ email: "a@b.co", role: "super_admin", exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE })
    ).toString("base64url");
    expect(verifyAdminSession(`${forged}.${sig}`)).toBeNull();
    expect(verifyAdminSession(`${body}.deadbeef`)).toBeNull();
    expect(verifyAdminSession("garbage")).toBeNull();
  });

  it("rejects an expired session", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
    const token = signAdminSession({ email: "a@b.co", role: "viewer" });
    vi.setSystemTime(new Date("2030-01-08T00:00:01Z"));
    expect(verifyAdminSession(token)).toBeNull();
  });

  it("signs with COOKIE_SECRET and verifies with the same chain used by middleware", () => {
    vi.stubEnv("COOKIE_SECRET", "test-cookie-secret");
    vi.stubEnv("JWT_SECRET", "different-jwt-secret");
    expect(getAdminSessionSecret()).toBe("test-cookie-secret");
    const token = signAdminSession({ email: "a@b.co", role: "viewer" });
    expect(verifyAdminSession(token)?.role).toBe("viewer");
  });
});

describe("production secret fails closed", () => {
  it("throws when no session secret is configured in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("COOKIE_SECRET", "");
    vi.stubEnv("JWT_SECRET", "");
    expect(() => getAdminSessionSecret()).toThrow(/ Admin session secret|Admin session secret/);
  });
});
