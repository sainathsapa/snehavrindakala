import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Every route under app/api/admin/** must check for an admin session, and the
 * routes that act on money or on a customer's correspondence must too, even
 * when they live outside /admin.
 *
 * This exists because two real holes were found by hand: /api/tickets/[id] let
 * anyone read a sender's email and message from a short ticket id, and
 * /api/store/shipping/shipment booked real courier pickups from a public POST.
 * Guessing at reviewers is not a control; a test that fails on the next
 * unguarded file is.
 */

const root = join(__dirname, "..");
const apiRoot = join(root, "app", "api");

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...routeFiles(path));
    else if (entry === "route.ts") out.push(path);
  }
  return out;
}

const guarded = /requireAdmin|getAdminIdentity|authoriseCron|timingSafeEqual/;

describe("admin API routes", () => {
  const files = routeFiles(join(apiRoot, "admin")).map((file) => ({
    file,
    path: relative(root, file),
    source: readFileSync(file, "utf8"),
  }));

  it("finds the admin routes", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("all of them check for a session, except the login itself", () => {
    const unguarded = files
      .filter((entry) => !entry.path.endsWith("admin/login/route.ts"))
      .filter((entry) => !guarded.test(entry.source))
      .map((entry) => entry.path);
    expect(unguarded, `admin routes with no auth check: ${unguarded.join(", ")}`).toEqual([]);
  });

  it("sensitive mutations enforce a permission, not just identity", () => {
    const mustGate: Array<[string, string]> = [
      ["admin/products/[id]/route.ts", "products:delete"],
      ["admin/products/route.ts", "products:write"],
      ["admin/users/route.ts", "users:write"],
      ["admin/settings/route.ts", "settings:write"],
      ["admin/refunds/route.ts", "refunds:approve"],
      ["admin/orders/[id]/refund/route.ts", "refunds:write"],
      ["admin/partners/[id]/route.ts", "partners:write"],
    ];
    for (const [relativePath, permission] of mustGate) {
      const source = readFileSync(join(apiRoot, relativePath), "utf8");
      expect(source, `${relativePath} must gate ${permission}`).toMatch(
        new RegExp(`requirePermission\\(["']${permission}["']\\)`)
      );
    }
  });

  it("the login route is the only one that sets a session rather than reading one", () => {
    const setsCookie = files
      .filter((entry) => /cookies\(\)\.set|\.cookies\.set/.test(entry.source))
      .map((entry) => entry.path);
    expect(setsCookie).toEqual(
      expect.arrayContaining([expect.stringContaining("admin/login")])
    );
  });
});

describe("routes outside /admin that must still be protected", () => {
  const mustBeProtected = [
    // Someone else's correspondence.
    "tickets/[id]/route.ts",
    // Books a real courier pickup against the studio's account.
    "store/shipping/shipment/route.ts",
  ];

  it.each(mustBeProtected)("%s requires a session", (relativePath) => {
    const source = readFileSync(join(apiRoot, relativePath), "utf8");
    expect(source).toMatch(/requireAdmin/);
    expect(source).toMatch(/status: 401/);
  });

  it("the internal notify endpoint uses the shared secret, not a session", () => {
    const source = readFileSync(join(apiRoot, "internal/notifications/route.ts"), "utf8");
    expect(source).toMatch(/INTERNAL_NOTIFY_SECRET/);
    expect(source).toMatch(/timingSafeEqual/);
    // Refusing when the secret is unset is what makes the check real.
    expect(source).toMatch(/if \(!expected \|\| !header\) return false/);
  });

  it("the commission upload is limited, because it writes to disk unauthenticated", () => {
    const source = readFileSync(join(apiRoot, "store/commission-upload/route.ts"), "utf8");
    expect(source).toMatch(/checkRateLimit/);
    expect(source).toMatch(/status: 429/);
  });
});
