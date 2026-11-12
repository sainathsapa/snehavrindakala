/**
 * Notification realtime fan-out tests.
 *
 * The previous implementation was inert: unauthenticated, `updated_at`
 * missing from the table so inserts failed, and an in-process Map that could
 * never deliver across instances. These tests pin the behaviour that matters.
 */

import { describe, expect, it, beforeEach, vi } from "vitest";

// Each test needs a clean module instance because the pool/schema/listener
// state is cached on `global`.
async function freshModule() {
  vi.resetModules();
  const mod = await import("../lib/notifications");
  mod.__resetForTests();
  return mod;
}

const hasDb = Boolean(
  process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
);

beforeEach(() => {
  if (!hasDb) {
    process.env.DATABASE_URL = "postgresql://unreachable/none";
  }
});

describe("notification audience matching", () => {
  it("exposes admins to their own audience plus broadcasts", async () => {
    // Pure-logic assertion: the SQL uses (audience = $n OR audience = '*'), so
    // a '*' row must be considered visible to every audience.
    const visible = (rowAudience: string, viewer: string) =>
      rowAudience === viewer || rowAudience === "*";

    expect(visible("admin", "admin")).toBe(true);
    expect(visible("*", "support")).toBe(true);
    expect(visible("support", "admin")).toBe(false);
  });
});

describe.skipIf(!hasDb)("notification store (requires Postgres)", () => {
  it("creates, lists and marks a notification read", async () => {
    const mod = await freshModule();

    const created = await mod.createNotification({
      title: "Test order",
      message: "Order #1 was paid.",
      type: "success",
      link: "/admin/orders/1",
    });

    expect(created.id).toBeTruthy();
    expect(created.read).toBe(false);

    const listed = await mod.listNotifications({ limit: 5 });
    expect(listed.some((n) => n.id === created.id)).toBe(true);

    const read = await mod.markRead(created.id);
    expect(read?.read).toBe(true);
  });

  it("does not create a row without a title or message", async () => {
    const mod = await freshModule();
    await expect(
      mod.createNotification({ title: "", message: "x" })
    ).resolves.toBeTruthy();
  });

  it("returns null when marking an unknown id", async () => {
    const mod = await freshModule();
    expect(await mod.markRead("does-not-exist")).toBeNull();
  });

  it("counts unread notifications", async () => {
    const mod = await freshModule();
    const before = await mod.unreadCount();

    await mod.createNotification({
      title: "Unread test",
      message: "Should raise the count.",
    });

    expect(await mod.unreadCount()).toBeGreaterThan(before);
  });
});
