import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Guards the "Representative image" note on generated product photographs.
 *
 * Sixteen works carry an AI-generated stand-in. Labelling them is what keeps the
 * catalogue honest while they are provisional, so two things matter:
 *
 *   1. The note must appear when the image is generated.
 *   2. It must disappear on its own once a real photograph replaces the file.
 *
 * The second is the point. The note is keyed on the filename rather than a
 * boolean column or a hand-kept list, so retiring it needs no code change and
 * cannot drift out of sync with the images. That property is easy to break in
 * passing — swap the test for a flag and the label outlives the placeholder.
 *
 * The round trip was verified against the running container: pointing one
 * product at a real image made the note disappear from the rendered DOM, and
 * restoring the generated filename brought it back. This test pins the rule that
 * made that work, since the DOM check itself needs a live deployment.
 */

const root = join(__dirname, "..");
const page = readFileSync(
  join(root, "app/[locale]/products/[handle]/page.tsx"),
  "utf8"
);

describe("representative-image note", () => {
  it("keys on the filename, not on a stored flag", () => {
    expect(page).toMatch(/includes\("\/generated-"\)/);

    // A flag or a hard-coded list would survive the real photograph.
    expect(page).not.toMatch(/isGenerated\s*[:=]/);
    expect(page).not.toMatch(/REPRESENTATIVE_IMAGE_HANDLES/);
  });

  it("checks the thumbnail as well as the gallery images", () => {
    // One work has a generated thumbnail and no image row, so checking only the
    // gallery left that page silently unlabelled.
    expect(page).toMatch(/images as \{ url\?: string \}\[\]/);
    expect(page).toMatch(/thumbnail/);
  });

  it("renders the translated string rather than hard-coded English", () => {
    // The note has to exist in both locales like the rest of the PDP.
    expect(page).toMatch(/t\("representativeImage"\)/);
  });
});
