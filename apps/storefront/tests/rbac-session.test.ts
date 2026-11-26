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

describe("support may add content, not change the shop", () => {
  // The studio asked that support staff be able to add things. What they may add
  // is content and product fixes; what stays out of reach is pricing, deletion
  // and settings. That boundary is the reason `content:*` exists as its own
  // permission instead of reusing `products:write`.
  it("lets support write content and products", () => {
    for (const permission of ["content:read", "content:write", "products:write"] as const) {
      expect(hasPermission("platform_support", permission)).toBe(true);
    }
  });

  it("keeps destructive and financial actions away from support", () => {
    for (const permission of [
      "products:delete",
      "settings:write",
      "users:write",
      "refunds:approve",
      "roles:write",
    ] as const) {
      expect(hasPermission("platform_support", permission)).toBe(false);
    }
  });

  it("gives every admin-tier role content access, so the screens are not dead", () => {
    for (const role of [
      "platform_super_admin",
      "platform_admin",
      "platform_manager",
    ] as const) {
      expect(hasPermission(role, "content:write")).toBe(true);
    }
  });
});
