import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hasStandInImage, isStandInImage } from "../lib/product-media";
import { isMeasured } from "../lib/certificates";
import { mergeTags, tagValue } from "../lib/admin-tags";

/**
 * Two things the shop cannot know by itself: what a work looks like, and how big
 * it is. Both used to be asserted anyway — a generated illustration as the piece,
 * a seeded dimension string on a signed certificate.
 *
 * The rule these tests pin: show what the studio states, certify only what the
 * studio confirmed, and say which is which.
 */

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("stand-in images", () => {
  it("recognises a generated illustration", () => {
    expect(isStandInImage("/images/products/generated-madhubani-celebration.jpg")).toBe(true);
    expect(isStandInImage("https://cdn.example.com/x/generated-thing.webp")).toBe(true);
  });

  it("does not flag a photograph", () => {
    expect(isStandInImage("/images/products/madhubani-painting.jpg")).toBe(false);
    expect(isStandInImage("/images/products/terracotta-vase.jpg")).toBe(false);
  });

  it("handles empty values without claiming a photo exists", () => {
    expect(isStandInImage(null)).toBe(false);
    expect(isStandInImage(undefined)).toBe(false);
    expect(isStandInImage("")).toBe(false);
  });

  it("does not mistake a query string or a CDN path for a name", () => {
    expect(isStandInImage("/images/products/generated-a.jpg?v=2")).toBe(true);
    // A folder called "generated" is not a stand-in file name; the convention is
    // the filename prefix, so a photograph filed under such a folder is still a
    // photograph.
    expect(isStandInImage("/assets/generated-products/vase.jpg")).toBe(false);
    expect(isStandInImage("/assets/photos/generated-2025/vase.jpg")).toBe(false);
  });

  it("reports a product with any stand-in image", () => {
    expect(hasStandInImage(["/images/products/a.jpg", "/images/products/generated-b.jpg"])).toBe(true);
    expect(hasStandInImage(["/images/products/a.jpg"])).toBe(false);
    expect(hasStandInImage([])).toBe(false);
  });
});

describe("the product page says when the picture is not the work", () => {
  const page = read("app/[locale]/products/[handle]/page.tsx");

  it("shows the disclosure beside the gallery", () => {
    expect(page).toContain("isStandInImage");
    expect(page).toMatch(/t\("standInPhoto"\)/);
  });

  it("has the sentence in both languages", () => {
    const en = JSON.parse(read("messages/en.json"));
    const hi = JSON.parse(read("messages/hi.json"));
    expect(en.productDetail.standInPhoto).toMatch(/still being taken/);
    expect(hi.productDetail.standInPhoto).toMatch(/तस्वीर/);
    expect(en.productDetail.standInPhoto).not.toBe(hi.productDetail.standInPhoto);
  });

  it("the admin list marks stand-in photos", () => {
    const route = read("app/api/admin/products/route.ts");
    expect(route).toMatch(/standInPhoto: isStandInImage/);
    expect(read("app/admin/products/page.tsx")).toContain("Stand-in photo");
  });
});

describe("dimensions may only be certified once measured", () => {
  it("accepts an explicit studio confirmation", () => {
    expect(isMeasured({ measured: "yes" })).toBe(true);
    expect(isMeasured({ measured: true })).toBe(true);
    expect(isMeasured({ dimensions_measured: "yes" })).toBe(true);
  });

  it("refuses a dimension string on its own", () => {
    // This is the whole point: a size is not a measurement just because it is
    // written down.
    expect(isMeasured({ dimensions: "50 cm × 35 cm" })).toBe(false);
    expect(isMeasured({})).toBe(false);
    expect(isMeasured(undefined)).toBe(false);
    expect(isMeasured({ measured: "no" })).toBe(false);
  });

  it("the certificate writes nothing when unmeasured", () => {
    const certificates = read("lib/certificates.ts");
    expect(certificates).toMatch(/isMeasured\(metadata\) \? firstString\(metadata\.dimensions\) : ""/);
  });

  it("the product page labels an unmeasured size as stated", () => {
    const panel = read("components/artwork-specs-panel.tsx");
    expect(panel).toMatch(/dimensionsMeasured/);
    const en = JSON.parse(read("messages/en.json"));
    expect(en.productDetail.specs.dimensionsStated).toMatch(/not yet measured/);
  });

  it("the studio can record a measurement from the admin", () => {
    expect(mergeTags([], { measured: true })).toContain("measured:yes");
    expect(mergeTags(["measured:yes"], { measured: false })).not.toContain("measured:yes");
    expect(tagValue(["measured:yes"], "measured")).toBe("yes");
    for (const page of [
      "app/admin/products/new/page.tsx",
      "app/admin/products/[id]/edit/page.tsx",
    ]) {
      expect(read(page)).toContain("I have measured this work");
    }
  });

  it("the admin list shows which works still need measuring", () => {
    expect(read("app/api/admin/products/route.ts")).toMatch(/needsMeasuring/);
    expect(read("app/admin/products/page.tsx")).toContain("Size unmeasured");
  });
});

describe("the brief exists so this is actionable", () => {
  const brief = readFileSync(join(root, "..", "..", "docs", "PHOTO-AND-MEASUREMENT-BRIEF.md"), "utf8");

  it("lists every published work", () => {
    expect(brief).toMatch(/## The works/);
    expect((brief.match(/^\| `[a-z0-9-]+`/gm) || []).length).toBeGreaterThan(10);
  });

  it("tells the studio how to check progress", () => {
    expect(brief).toContain("measured:yes");
    expect(brief).toMatch(/Stand-in photo/);
  });
});
