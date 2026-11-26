import { WORDS } from "./words";
import { MATERIALS } from "./materials";
import { HISTORY } from "./history";
import { PLATES, type Entry, type Plate, type PlateId } from "./types";

export * from "./types";

/** Every entry, in book order. */
export const ENTRIES: Entry[] = [...WORDS, ...MATERIALS, ...HISTORY];

export const ENTRIES_BY_PLATE: Record<PlateId, Entry[]> = {
  words: WORDS,
  materials: MATERIALS,
  history: HISTORY,
};

export function entriesFor(plate: PlateId): Entry[] {
  return ENTRIES_BY_PLATE[plate];
}

export function plateCount(plate: PlateId): number {
  return ENTRIES_BY_PLATE[plate].length;
}

export function entryBySlug(plate: PlateId, slug: string): Entry | undefined {
  return ENTRIES_BY_PLATE[plate].find((entry) => entry.slug === slug);
}

/** Find an entry anywhere, so cross-plate references resolve. */
export function findEntry(slug: string): Entry | undefined {
  return ENTRIES.find((entry) => entry.slug === slug);
}

/**
 * Resolve related slugs into entries.
 *
 * A missing reference is dropped rather than crashing the page: the copy is
 * allowed to be edited without breaking a build.
 */
export function relatedEntries(entry: Entry): Entry[] {
  return entry.related
    .map((slug) => findEntry(slug))
    .filter((value): value is Entry => Boolean(value) && value!.slug !== entry.slug);
}

/** Previous and next inside the same plate, for the footer. */
export function neighbours(entry: Entry): { previous?: Entry; next?: Entry } {
  const list = entriesFor(entry.plate);
  const index = list.findIndex((item) => item.slug === entry.slug);
  if (index < 0) return {};
  return { previous: list[index - 1], next: list[index + 1] };
}

/** Page path, kept in one place so links cannot drift. */
export function hrefFor(entry: Pick<Entry, "plate" | "slug">): string {
  return `/learn/${entry.plate}/${entry.slug}`;
}

export function plateHref(plate: PlateId): string {
  return `/learn/${plate}`;
}

/** Rough reading time, at a slow 180 words per minute. */
export function readingMinutes(entry: Entry): number {
  const words =
    entry.body.join(" ").split(/\s+/).length + entry.definition.split(/\s+/).length;
  return Math.max(1, Math.round(words / 180));
}

/** All the languages across a plate, sorted, for the filter rail. */
export function languagesFor(plate: PlateId): string[] {
  const set = new Set<string>();
  for (const entry of entriesFor(plate)) {
    for (const language of entry.languages ?? []) set.add(language);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export { PLATES };
export type { Entry, Plate, PlateId };
