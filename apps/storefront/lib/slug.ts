/**
 * URL slug helpers.
 *
 * A product URL must be readable and carry its keywords — `/products/003` is
 * opaque to a person and worthless to a search engine, whereas
 * `/products/embroidered-cotton-throw` says what the thing is. Handles are the
 * primary key in Medusa, so this only *generates* them for records that do not
 * have one yet; it never rewrites a live handle, because that would break
 * existing links and search rankings.
 */

const MAX_SLUG_LENGTH = 72;

/**
 * Turn a title into a URL-safe handle.
 *
 * Diacritics are stripped (so "Pattachitrā" → "pattachitra"), the ampersand
 * becomes "and" rather than vanishing ("Home & Decor" → "home-and-decor"),
 * punctuation is dropped, and runs of separators collapse. The result is
 * lower-case ASCII, which is what Medusa and every search engine expect.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
}

/**
 * Build a descriptive product handle from title, artist and art form.
 *
 * Mirrors how the large art platforms do it: the subject leads, then the
 * tradition, then a short maker tag. `/products/madhubani-ritual-painting-arjun-mehta`
 * is harder to guess than `/products/madhubani-ritual-painting`, and the maker
 * is a genuine search term ("Arjun Mehta Madhubani"), so it earns its place —
 * but only as a short form so the URL stays readable.
 */
export function productSlug({
  title,
  artist,
  artForm,
}: {
  title: string;
  artist?: string;
  artForm?: string;
}): string {
  const parts = [slugify(title)];

  // Only add the tradition if the title does not already name it, so we do not
  // get "madhubani-painting-madhubani".
  if (artForm) {
    const form = slugify(artForm);
    if (form && !parts[0].includes(form)) parts.push(form);
  }

  if (artist) {
    const maker = slugify(artist);
    // Skip placeholders like "Commission only" and anything already present.
    const isPlaceholder = /^(commission|studio|snehavrinda|various|unknown)/.test(maker);
    if (maker && !isPlaceholder && !parts.join("-").includes(maker)) {
      parts.push(maker.split("-").slice(0, 2).join("-"));
    }
  }

  const joined = parts.filter(Boolean).join("-").slice(0, MAX_SLUG_LENGTH).replace(/-+$/g, "");

  // A handle must never be empty: fall back to the title, then to a literal.
  return joined || "artwork";
}

/**
 * A handle is only "readable" if it is not a bare identifier like `003`,
 * `prod_003` or a UUID. Records with opaque handles get a generated one.
 */
export function isOpaqueHandle(handle: string | undefined | null): boolean {
  if (!handle) return true;
  const bare = handle.replace(/^prod_/, "");
  // Digits only (`003`), or any hex-and-hyphen run that begins with a UUID
  // group (`5f2a1c3e-...`). Medusa sometimes truncates the id in a handle, so
  // matching only the full UUID shape would miss `prod_5f2a1c3e-9b7d-4a21`.
  if (/^\d+$/.test(bare)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(bare)) return true;
  // A single short token with no hyphen and no vowels reads as a code.
  if (!bare.includes("-") && bare.length <= 6 && !/[aeiou]/i.test(bare)) return true;
  return false;
}

/**
 * Ensure a handle is unique within a set, appending -2, -3, … as needed.
 * Duplicate handles are a hard collision in Medusa and a duplicate content
 * problem for search engines.
 */
export function uniqueHandle(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
