/**
 * Product tags are the only channel the storefront reads for facts that are not
 * first-class Medusa fields: the maker, the availability, and the artwork's
 * specifications (dimensions, medium, framing, year, edition, care).
 *
 * All of those are written through one flat list here rather than by replacing
 * the whole tag set. Replacing is what a naive save does, and it silently
 * deletes anything the current form does not happen to render — so editing a
 * price would wipe a dimension entered last week.
 *
 * The rule: a request may only replace the keys it actually submits. Everything
 * else is carried over verbatim.
 */

export const SPEC_KEYS = [
  "dimensions",
  "medium",
  "framing",
  "year",
  "edition",
  "care",
  // Provenance and condition are what make "one of one" checkable rather than
  // asserted. Written by the owner from what they know about the object, and
  // left out entirely when unknown.
  "provenance",
  "condition",
] as const;

export type SpecKey = (typeof SPEC_KEYS)[number];
export type SpecInput = Partial<Record<SpecKey, string>>;

export interface TagEdit {
  artist?: string;
  stock_type?: string;
  specs?: SpecInput;
}

/** Read one `key:value` tag. The value may itself contain colons. */
export function tagValue(tags: unknown[], key: string): string | undefined {
  for (const tag of tags) {
    const value = typeof tag === "string" ? tag : (tag as { value?: string })?.value;
    if (typeof value === "string" && value.startsWith(`${key}:`)) {
      return value.slice(key.length + 1);
    }
  }
  return undefined;
}

/** The specification block of a product, ready to prefill an admin form. */
export function specsFromTags(tags: unknown[]): Record<SpecKey, string> {
  return Object.fromEntries(
    SPEC_KEYS.map((key) => [key, tagValue(tags, key) ?? ""])
  ) as Record<SpecKey, string>;
}

/**
 * Produce the full tag list to persist.
 *
 * An emptied field removes its tag instead of storing `key:`. "We do not know
 * the size" must read as unknown, not as a blank string that renders as an empty
 * row on the product page.
 */
export function mergeTags(currentValues: string[], edit: TagEdit): string[] {
  const editedKeys = new Set<string>();
  if (edit.artist !== undefined) editedKeys.add("artist");
  if (edit.stock_type !== undefined) editedKeys.add("stock");
  if (edit.specs) {
    for (const key of SPEC_KEYS) {
      // Only a key the request actually mentions is replaced. A partial update
      // that omits `framing` leaves the stored framing alone.
      if (edit.specs[key] !== undefined) editedKeys.add(key);
    }
  }

  const wanted = currentValues.filter(
    (value) => ![...editedKeys].some((key) => value.startsWith(`${key}:`))
  );

  if (typeof edit.artist === "string" && edit.artist.trim()) {
    wanted.push(`artist:${edit.artist.trim()}`);
  }
  if (typeof edit.stock_type === "string" && edit.stock_type.trim()) {
    wanted.push(`stock:${edit.stock_type.trim()}`);
  }
  if (edit.specs) {
    for (const key of SPEC_KEYS) {
      const value = edit.specs[key];
      if (typeof value === "string" && value.trim()) {
        wanted.push(`${key}:${value.trim()}`);
      }
    }
  }

  return wanted;
}
