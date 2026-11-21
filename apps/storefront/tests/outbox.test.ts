import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  UNDELIVERED_STATUSES,
  detailFor,
  emptyOutboxMeans,
  linkFor,
  reasonFor,
} from "../lib/outbox";

/**
 * The outbox exists because a recorded-but-unsent message is easy to misread as
 * a sent one. A row saying `skipped` is the truth; the failure was that no screen
 * showed it. These tests pin the reading of that record.
 */

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("reasonFor", () => {
  it("reads a skipped message as a missing transport", () => {
    expect(reasonFor("skipped")).toBe("no-transport");
  });

  it("reads a failed message as a transport refusal", () => {
    expect(reasonFor("failed")).toBe("transport-error");
  });

  it("does not pretend to explain an unknown status", () => {
    expect(reasonFor("pending")).toBe("unknown");
    expect(reasonFor("")).toBe("unknown");
  });
});

describe("detailFor", () => {
  it("names the variables to set when there is no transport", () => {
    const text = detailFor("no-transport");
    expect(text).toContain("FROM_EMAIL");
    expect(text).toContain("AWS_SES_");
  });

  it("does not blame the address when the reason is unknown", () => {
    expect(detailFor("unknown")).toMatch(/does not explain/);
  });
});

describe("what counts as undelivered", () => {
  it("includes skipped and failed, and excludes in-flight statuses", () => {
    expect(UNDELIVERED_STATUSES).toContain("skipped");
    expect(UNDELIVERED_STATUSES).toContain("failed");
    // A pending message may still arrive; calling it undelivered would be a lie
    // in the other direction.
    expect(UNDELIVERED_STATUSES).not.toContain("pending");
    expect(UNDELIVERED_STATUSES).not.toContain("sent");
  });
});

describe("linkFor", () => {
  it("links an order notification to that order", () => {
    expect(
      linkFor({ source: "notification", resourceType: "order", resourceId: "order_1" })
    ).toBe("/admin/orders/order_1");
  });

  it("links a cart reminder to the carts list", () => {
    expect(linkFor({ source: "cart-reminder" })).toBe("/admin/carts");
  });

  it("offers no link rather than a wrong one", () => {
    expect(linkFor({ source: "notification", resourceType: "customer" })).toBeNull();
    expect(
      linkFor({ source: "notification", resourceType: "order", resourceId: null })
    ).toBeNull();
  });
});

describe("emptyOutboxMeans", () => {
  it("says an empty page is good news only when mail works", () => {
    expect(emptyOutboxMeans({ transportReady: true })).toMatch(/reached a transport/);
  });

  it("refuses to read an empty page as proof when mail is off", () => {
    const text = emptyOutboxMeans({ transportReady: false });
    expect(text).toContain("no mail transport is configured");
    expect(text).toContain("not proof");
  });
});

describe("the page", () => {
  const page = read("app/admin/outbox/page.tsx");

  it("requires an admin", () => {
    expect(page).toMatch(/requireAdmin/);
  });

  it("distinguishes an unreadable outbox from an empty one", () => {
    expect(page).toMatch(/could not be read/);
  });

  it("is reachable from the admin navigation", () => {
    expect(read("components/admin-chrome.tsx")).toContain('href: "/admin/outbox"');
  });

  it("offers no resend button it cannot honour", () => {
    // Resending would fail for the reason the row already gives, and a control
    // that does nothing is worse than no control.
    expect(page).not.toMatch(/<button/);
  });
});
