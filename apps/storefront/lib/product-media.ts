/**
 * Whether a product image is a photograph of the work, or a stand-in.
 *
 * Sixteen of the catalogue's images are placeholders drawn to show the shape of
 * a piece — madhubani-celebration, gond-tree-of-life and the rest — and three of
 * the twenty-one files in `public/images/products/` are actual photographs of
 * actual works. Nothing in the shop said so. A buyer looking at a generated
 * image of a "one of one, 50 × 35 cm" painting has no way to know they are
 * looking at an illustration, and on a shop whose entire promise is that the
 * photograph is the work, that is the worst kind of quiet.
 *
 * The convention is structural rather than a flag somebody has to remember:
 * stand-ins carry a `generated-` prefix in their filename, photographs carry the
 * handle. A new photograph replaces the file and the disclosure disappears with
 * it, which is the behaviour we want — the shop cannot drift into showing a
 * stand-in without saying so, and cannot keep apologising for a photo that now
 * exists.
 */

const STAND_IN = /(^|\/)generated-/i;

export function isStandInImage(url: string | null | undefined): boolean {
  if (!url) return false;
  // Only the file name matters; a CDN prefix must not confuse the test.
  const path = url.split(/[?#]/)[0];
  const name = path.slice(path.lastIndexOf("/") + 1);
  return STAND_IN.test(name);
}

/** True when at least one image on a product is a stand-in. */
export function hasStandInImage(
  images: Array<string | null | undefined> | null | undefined
): boolean {
  return (images || []).some(isStandInImage);
}

/**
 * What to say, in one sentence, when the picture is not the work.
 *
 * Deliberately specific about what is and is not being shown: not "image for
 * illustration", which is what a stock catalogue says, but the fact that the
 * studio has not photographed this piece yet.
 */
export const STAND_IN_NOTE =
  "The photograph of this work is still being taken. What you see is a studio illustration of the piece — the size, materials and maker above are accurate, the picture is not. Write to us and we will send photographs before you order.";
