/**
 * The three plates.
 *
 * A plate is a printed page in an art book: one subject, shown thoroughly. Each
 * entry has its own page, because a glossary that only ever shows one line is a
 * glossary nobody learns from — and these are words the shop uses on product
 * pages without ever explaining them.
 */

export type PlateId = "words" | "materials" | "history";

export interface EntrySource {
  /** Where the form is practised, as the shop would say it on a label. */
  tradition: string[];
  /** Roughly when it appears, only where a date is meaningful. */
  period?: string;
}

export interface Entry {
  slug: string;
  plate: PlateId;
  title: string;
  /** Era label, used to group the history plate into readable stretches. */
  era?: string;
  /** Script or language the word belongs to; for materials, the tradition. */
  languages?: string[];
  /** One line, the kind you would read on a label. */
  gloss: string;
  /** The full first statement: what it is, in plain words. */
  definition: string;
  /** The body: paragraphs that earn the page. */
  body: string[];
  /** What to look for when you are standing in front of a work. */
  lookFor: string[];
  /** Slugs of other entries that only make sense next to this one. */
  related: string[];
  source: EntrySource;
}

export interface Plate {
  id: PlateId;
  numeral: string;
  title: string;
  kicker: string;
  intro: string;
  /** How the plate should be read — sets expectation before the list. */
  howToRead: string;
  image?: { src: string; alt: string };
}

export const PLATES: Plate[] = [
  {
    id: "words",
    numeral: "01",
    title: "The words",
    kicker: "Words you will keep meeting",
    intro:
      "Sixteen terms, most of them untranslated on shop pages that use them constantly. Each is given in its own language, because the English word is usually a lossy translation.",
    howToRead:
      "Read one entry, then read the two it points to. The vocabulary is a web, not a list: kacni without bharni is half an argument, and kalamkari without myrobalan is an incomplete recipe.",
    image: { src: "/plates/words.webp", alt: "Script fragments and painted motifs on handmade paper" },
  },
  {
    id: "materials",
    numeral: "02",
    title: "The materials",
    kicker: "What the work is made of",
    intro:
      "Every material here is chosen for a reason that can be stated. A tradition that used rice paste did so because a household already had rice — not because rice is picturesque.",
    howToRead:
      "Ask the same three questions of every entry: what is it, why this and not something cheaper, and what fails inside a year if it is skipped.",
    image: {
      src: "/plates/materials.jpg",
      alt: "Indigo pigment, tamarind-seed paste, brushes and myrobalan seeds laid out on handmade paper",
    },
  },
  {
    id: "history",
    numeral: "03",
    title: "The history",
    kicker: "A short history",
    intro:
      "Nine moments, in ranges rather than single years — because the dates are argued about, and pretending otherwise would be a lie told in the service of tidiness.",
    howToRead:
      "Read in order the first time; the later entries assume the earlier ones. Every date is a range because the evidence is a wall, a colophon, or a traveller's note.",
    image: {
      src: "/plates/history.jpg",
      alt: "A palm-leaf manuscript fragment, a gold miniature border and a carved sandstone lotus",
    },
  },
];

export function plateById(id: PlateId): Plate {
  const plate = PLATES.find((p) => p.id === id);
  if (!plate) throw new Error(`Unknown plate: ${id}`);
  return plate;
}

/** Page path for an entry, used by every link so they cannot drift apart. */
export function entryHref(entry: Pick<Entry, "plate" | "slug">): string {
  return `/learn/${entry.plate}/${entry.slug}`;
}
