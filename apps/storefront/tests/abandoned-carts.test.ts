import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A cart reminder is the one piece of marketing this shop sends, so it has to
 * obey two rules: only genuinely abandoned carts, and only once. Both are tested
 * here, plus the honest bit — a mail server that is not configured must never be
 * recorded as a send.
 */

const root = join(__dirname, "..");
const repoRoot = join(root, "..", "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

vi.mock("@/lib/db", () => ({
  query: vi.fn(async () => []),
  queryResult: vi.fn(async () => ({ rows: [] })),
}));

describe("isAbandoned", () => {
  it("needs an email, at least one line, and enough quiet", async () => {
    const { isAbandoned } = await import("../lib/abandoned-carts");
    expect(
      isAbandoned({ ageHours: 7, minHours: 6, email: "a@b.test", itemCount: 1, completed: false })
    ).toBe(true);
  });

  it("is false while the cart is still fresh", async () => {
    const { isAbandoned } = await import("../lib/abandoned-carts");
    expect(
      isAbandoned({ ageHours: 2, minHours: 6, email: "a@b.test", itemCount: 1, completed: false })
    ).toBe(false);
  });

  it("is false once the cart became an order", async () => {
    const { isAbandoned } = await import("../lib/abandoned-carts");
    expect(
      isAbandoned({ ageHours: 99, minHours: 6, email: "a@b.test", itemCount: 1, completed: true })
    ).toBe(false);
  });

  it("is false without an address to write to", async () => {
    const { isAbandoned } = await import("../lib/abandoned-carts");
    for (const email of [null, "", "   "]) {
      expect(
        isAbandoned({ ageHours: 99, minHours: 6, email, itemCount: 1, completed: false })
      ).toBe(false);
    }
  });

  it("is false for an empty cart", async () => {
    const { isAbandoned } = await import("../lib/abandoned-carts");
    expect(
      isAbandoned({ ageHours: 99, minHours: 6, email: "a@b.test", itemCount: 0, completed: false })
    ).toBe(false);
  });
});

describe("abandonedAfterHours", () => {
  it("defaults to six hours and ignores nonsense", async () => {
    const { abandonedAfterHours } = await import("../lib/abandoned-carts");
    for (const value of [undefined, "", "abc", "0", "-3"]) {
      if (value === undefined) delete process.env.ABANDONED_CART_HOURS;
      else process.env.ABANDONED_CART_HOURS = value;
      expect(abandonedAfterHours()).toBe(6);
    }
    process.env.ABANDONED_CART_HOURS = "24";
    expect(abandonedAfterHours()).toBe(24);
    delete process.env.ABANDONED_CART_HOURS;
  });
});

describe("reminderPayload", () => {
  it("totals each line so the email can show what was chosen", async () => {
    const { reminderPayload } = await import("../lib/abandoned-carts");
    const payload = reminderPayload({
      id: "cart_1",
      email: "a@b.test",
      currency_code: "inr",
      updated_at: "2026-01-01T00:00:00Z",
      subtotal: 4_500_000,
      reminded_at: null,
      reminder_status: null,
      items: [
        { title: "Madhubani Celebration", quantity: 1, unit_price: 4_500_000 },
        { title: "A small study", quantity: 2, unit_price: 150_000 },
      ],
    });
    expect(payload.items[1].total).toBe(300_000);
    expect(payload.subtotal).toBe(4_500_000);
    expect(payload.email).toBe("a@b.test");
  });
});

describe("wiring", () => {
  it("registers the template on the backend and allows the storefront to send it", () => {
    const templates = readFileSync(
      join(repoRoot, "apps/backend/src/modules/notification/templates.ts"),
      "utf8"
    );
    expect(templates).toMatch(/cart_reminder: cartReminder/);

    const sendRoute = readFileSync(
      join(repoRoot, "apps/backend/src/api/store/notifications/send/route.ts"),
      "utf8"
    );
    expect(sendRoute).toMatch(/cart_reminder/);
  });

  it("cannot send twice for the same cart", () => {
    const route = read("app/api/admin/carts/remind/route.ts");
    expect(route).toMatch(/cart_reminders WHERE cart_id/);
    expect(route).toMatch(/status: 409/);
  });

  it("records skipped mail as skipped, never as sent", () => {
    const lib = read("lib/abandoned-carts.ts");
    expect(lib).toMatch(/status = result\.status === "sent" \? "sent" : "skipped"/);
  });

  it("is reachable from the admin shell", () => {
    expect(read("components/admin-chrome.tsx")).toMatch(/\/admin\/carts/);
  });
});
