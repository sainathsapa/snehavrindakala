/**
 * Bridge between the reference page and the deep entries.
 *
 * `lib/art-reference.ts` holds the short, translated material that the /learn
 * page has always shown: a glossary, a materials list, a timeline — short enough
 * to scan, which is what a reference page should be. The long-form entries in
 * `lib/learn` are the essays behind those lines, one page each.
 *
 * Two datasets with drifting slugs is how link rot starts, so the mapping lives
 * here, keyed on title, and anything unmatched simply gets no link rather than a
 * broken one. If an entry is renamed, this is the single place to fix.
 */

import { ENTRIES, findEntry } from "./index";
import type { Entry, PlateId } from "./types";

function normalise(title: string): string {
  return title
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Titles that differ between the two datasets on purpose. */
const ALIASES: Record<string, string> = {
  "jangarh singh shyam and warli on canvas": "gond-warli-canvas",
  "warli on canvas": "gond-warli-canvas",
  "line pigment hand": "line-pigment-hand",
  "ajanta and the mural tradition": "ajanta",
  "the regional temple walls": "temple-walls",
  "mughal and rajput miniature": "mughal-rajput-miniature",
  "pattachitra and the scroll trades": "scroll-trades",
  "kalamkari and the nationalist turn": "swadeshi",
  "madhubani moves to paper": "madhubani-paper",
  "myrobalan black indigo": "ajrakh-resist",
  "tamarind seed chalk": "tamarind-chalk",
  "cow dung and red earth": "cow-dung-wall",
  "conch shell white": "conch-shell-white",
  "lamp soot black": "lamp-soot-black",
  "squirrel hair brush": "squirrel-hair-brush",
  "buffalo milk": "buffalo-milk",
  "iron acetate": "iron-acetate",
  "rice paste": "rice-paste",
  "pattachitra rasa": "pattachitra-rasa",
  "tana bana": "tana-bana",
};

const BY_TITLE = new Map<string, Entry>();
for (const entry of ENTRIES) {
  BY_TITLE.set(normalise(entry.title), entry);
  // "Rasa" in the glossary is the same entry as "pattachitra-rasa".
  if (entry.slug === "pattachitra-rasa") BY_TITLE.set("rasa", entry);
}

export function entryForTitle(title: string): Entry | undefined {
  const key = normalise(title);
  const alias = ALIASES[key];
  if (alias) return findEntry(alias);
  return BY_TITLE.get(key);
}

/** Path to the long-form page for a title, or null when there is none. */
export function deepHref(title: string): string | null {
  const entry = entryForTitle(title);
  return entry ? `/learn/${entry.plate}/${entry.slug}` : null;
}

/** Entries in a plate, for the "all entries" link on the reference page. */
export function countFor(plate: PlateId): number {
  return ENTRIES.filter((entry) => entry.plate === plate).length;
}
