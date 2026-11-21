import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isUuid, normaliseProofUrl } from "../lib/commission-progress";

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("normaliseProofUrl", () => {
  it("accepts a stored upload path unchanged", () => {
    expect(normaliseProofUrl("/uploads/products/abc.jpg")).toBe(
      "/uploads/products/abc.jpg"
    );
  });

  it("turns a bare storage key into a servable path", () => {
    expect(normaliseProofUrl("abc-123.webp")).toBe("/uploads/abc-123.webp");
  });

  it("refuses anything that is not a file reference", () => {
    // A proof value is rendered into an <img src>. A javascript: or http: URL
    // there would be an injection point supplied by whoever filled the form.
    for (const value of [
      "https://example.com/x.jpg",
      "javascript:alert(1)",
      "  ",
      null,
      42,
    ]) {
      expect(normaliseProofUrl(value)).toBe("");
    }
  });
});

describe("isUuid", () => {
  it("accepts a uuid and rejects everything else", () => {
    expect(isUuid("2b1a5e0c-1111-4a2b-9c3d-1234567890ab")).toBe(true);
    expect(isUuid("1) OR 1=1")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

/**
 * The wiring that makes progress visible at all.
 *
 * `commission_milestone` existed with a proof column for as long as the
 * commission module has, and nothing read it — so a commission taking six weeks
 * looked identical to one that had stalled. These checks pin the two ends: the
 * buyer's page reads the milestones, and the admin writes them.
 */
describe("studio updates wiring", () => {
  it("shows updates on the buyer's status page", () => {
    const page = read("app/[locale]/commission-status/[referenceId]/page.tsx");
    expect(page).toMatch(/listMilestones/);
    expect(page).toMatch(/From the studio/);
    expect(page).toMatch(/update\.proof_url/);
  });

  it("writes updates only from an authenticated admin page", () => {
    const route = read("app/api/admin/commissions/[id]/milestones/route.ts");
    expect(route).toMatch(/requireAdmin\(\)/);
    const page = read("app/admin/commissions/requests/[id]/page.tsx");
    expect(page).toMatch(/requireAdmin\(\)/);
    expect(page).toMatch(/<StudioUpdateForm/);
  });

  it("never invents an update", () => {
    // No generated descriptions: the text on the buyer's page must be the text
    // the studio typed.
    const lib = read("lib/commission-progress.ts");
    expect(lib).not.toMatch(/description:\s*`[^`]*\$\{/);
  });
});
