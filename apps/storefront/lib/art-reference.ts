/**
 * The glossary and history of Indian art, written as content rather than
 * decoration.
 *
 * A visitor to an art house usually arrives with one of three questions:
 * *what am I looking at*, *what is it made of*, and *how did this tradition
 * come to exist*. The site answered the first (art-form stories) and the third
 * only in fragments. This file holds plain-language reference material for the
 * other two, so `/learn` can teach without a single product on the page.
 *
 * Everything here is deliberately factual and short. It is a glossary, not an
 * essay — the essays live in the journal.
 */

export interface GlossaryTerm {
  term: string;
  /** Language of origin, shown as a small tag. */
  language: string;
  meaning: string;
  /** Where or how it is used. */
  note: string;
}

/** Terms a reader meets constantly on an Indian art site and rarely sees defined. */
export const GLOSSARY: GlossaryTerm[] = [
  {
    term: "Kala",
    language: "Sanskrit",
    meaning: "Art, craft, and skill — one word for all three.",
    note: "The distinction between 'art' and 'craft' is a European one. Kala does not make it.",
  },
  {
    term: "Pattachitra",
    language: "Odia",
    meaning: "Patta (cloth) + chitra (picture).",
    note: "Cloth treated with tamarind seed and chalk so mineral pigment holds without bleeding.",
  },
  {
    term: "Kalamkari",
    language: "Telugu / Persian",
    meaning: "Kalam (pen) + kari (work) — pen work.",
    note: "Drawn with a bamboo pen wrapped in cloth. The colour comes later, in the river.",
  },
  {
    term: "Kacni",
    language: "Maithili",
    meaning: "Line work — the first pass of an outline.",
    note: "In Madhubani the outline is drawn twice, one line inside the other. See Bharni.",
  },
  {
    term: "Bharni",
    language: "Maithili",
    meaning: "Colour fill, applied inside the kacni outline.",
    note: "Flat colour, no shading. Depth is suggested by the double line, not by light.",
  },
  {
    term: "Digna",
    language: "Gondi",
    meaning: "The pattern that fills the inside of a form.",
    note: "Seeds, dashes and small creatures. A Gond animal is filled with its own habitat.",
  },
  {
    term: "Pulli",
    language: "Tamil",
    meaning: "Dots — the grid a kolam is woven around.",
    note: "Usually 5×5 or 7×7. The line is drawn around the dots without lifting the hand.",
  },
  {
    term: "Kolam",
    language: "Tamil",
    meaning: "A threshold drawing made in rice flour before sunrise.",
    note: "It feeds insects, greets a visitor, and marks ground that is tended.",
  },
  {
    term: "Tarpa",
    language: "Warli / Marathi",
    meaning: "A spiral dance around a central pipe instrument.",
    note: "Painted as a spiral of linked figures. It is the ceremony, not a picture of one.",
  },
  {
    term: "Pattachitra rasa",
    language: "Odia",
    meaning: "The mood a painting is composed to carry.",
    note: "Composition follows the rasa: a heroic scene is built on diagonals, a tender one on circles.",
  },
  {
    term: "Chitrakathi",
    language: "Marathi",
    meaning: "Picture-story — a painted scroll shown while it is sung.",
    note: "The image and the narration were never separate objects.",
  },
  {
    term: "Tana-bana",
    language: "Hindi / Urdu",
    meaning: "Warp and weft.",
    note: "Used of textiles and of the structure of a story. Both are woven, not stacked.",
  },
  {
    term: "Jali",
    language: "Persian / Hindi",
    meaning: "A pierced screen.",
    note: "Carved so light becomes pattern. In painting, used as a field of texture.",
  },
  {
    term: "Ambi",
    language: "Gujarati / Punjabi",
    meaning: "The mango motif — 'paisley' in English.",
    note: "Named after Paisley in Scotland, which copied it. The form is Indian.",
  },
  {
    term: "Kalash",
    language: "Sanskrit",
    meaning: "The auspicious pot, with mango leaves and a coconut.",
    note: "It marks a beginning. Its presence means 'this has been deliberately started'.",
  },
  {
    term: "Torana",
    language: "Sanskrit",
    meaning: "A ceremonial gateway.",
    note: "Not a border — a composition. Indian entrances are decorated as whole structures.",
  },
];

export interface MaterialNote {
  material: string;
  what: string;
  /** Why the artist uses it rather than something easier. */
  why: string;
  /** Which traditions depend on it. */
  usedIn: string[];
}

export const MATERIALS: MaterialNote[] = [
  {
    material: "Rice paste",
    what: "Rice ground with water, drawn with a bamboo stick chewed at the end to form a brush.",
    why: "It is what a household already had. The medium never travelled further than the kitchen.",
    usedIn: ["Warli", "Kolam"],
  },
  {
    material: "Conch shell white",
    what: "Shell burnt and ground to a fine powder, then mixed with gum.",
    why: "It stays white for centuries where chalk would yellow. The brightest passages in a Pattachitra are shell.",
    usedIn: ["Pattachitra", "Kerala Mural"],
  },
  {
    material: "Lamp soot black",
    what: "Soot collected from an oil lamp, bound with gum or water.",
    why: "Black made this way ages to a warm brown-black. Chemical black stays blue forever, which is how forgeries are spotted.",
    usedIn: ["Pattachitra", "Kalamkari"],
  },
  {
    material: "Iron acetate",
    what: "Rusty iron soaked in jaggery water until it turns black.",
    why: "It does not sit on the cloth; it binds to the fibre and survives twenty washes.",
    usedIn: ["Kalamkari"],
  },
  {
    material: "Myrobalan",
    what: "Dried Terminalia chebula fruit powder, applied to cotton before drawing.",
    why: "It leaves a tannin ground that the dye grips. Without it the line bleeds and the cloth is lost.",
    usedIn: ["Kalamkari", "Block printing"],
  },
  {
    material: "Buffalo milk",
    what: "Soured milk brushed over cloth and dried before drawing.",
    why: "A sizing coat. It stops the pen line spreading into the weave.",
    usedIn: ["Kalamkari"],
  },
  {
    material: "Tamarind seed + chalk",
    what: "A paste used to coat cotton so it behaves like paper.",
    why: "Cloth is porous and paint sinks. The paste gives the surface 'tooth', as priming does for a canvas.",
    usedIn: ["Pattachitra"],
  },
  {
    material: "Cow dung and red earth",
    what: "A wall base levelled by hand and painted with clay.",
    why: "Warli was painted on the wall it was about. The surface is the building.",
    usedIn: ["Warli"],
  },
  {
    material: "Myrobalan black + indigo",
    what: "The two-stage resist used in Ajrakh: black from iron, blue from indigo, with mud as resist.",
    why: "A fourteen-stage process where the mud is the shield and the river is the rinse.",
    usedIn: ["Ajrakh", "Block printing"],
  },
  {
    material: "Squirrel-hair brush",
    what: "A few hairs bound to a bamboo handle, cut to a single point.",
    why: "Made for the one thing a machine cannot do: a line that thins as the hand lifts.",
    usedIn: ["Pattachitra", "Miniature", "Kalamkari"],
  },
];

export interface TimelineEntry {
  era: string;
  title: string;
  body: string;
}

/** A short, honest history — the dates people argue about, stated as ranges. */
export const TIMELINE: TimelineEntry[] = [
  {
    era: "c. 10,000 BCE",
    title: "Bhimbetka",
    body: "Shelter paintings in Madhya Pradesh: animals, hunts, and handprints in red ochre. The oldest surviving picture-making on the subcontinent, and still the reference point for Warli and Gond line work.",
  },
  {
    era: "c. 500 BCE – 500 CE",
    title: "Ajanta and the mural tradition",
    body: "Rock-cut caves painted with mineral pigment on plaster. The figures are modelled with light, unlike the flat colour of later folk painting — proof that 'Indian painting' was never one style.",
  },
  {
    era: "c. 750 – 1200 CE",
    title: "The regional temple walls",
    body: "Kerala murals, Tanjore, and the early Mithila wall paintings. Art moves inside the building: the wall becomes the book, and colour is mixed from whatever the region grows.",
  },
  {
    era: "c. 1550 – 1750",
    title: "Mughal and Rajput miniature",
    body: "Small-format painting on paper, made for albums. The squirrel-hair brush, the flat field, and the profile face that later folk painting inherits all consolidate here.",
  },
  {
    era: "c. 1700 – 1900",
    title: "Pattachitra and the scroll trades",
    body: "Scroll painting serves pilgrimage and storytelling: a picture is unrolled and sung. Painting is a service performed, not an object owned.",
  },
  {
    era: "1930s",
    title: "Kalamkari and the nationalist turn",
    body: "Hand-printed and hand-drawn textiles become a symbol of swadeshi. The technique survives partly because of what it came to stand for.",
  },
  {
    era: "1966 – 1970s",
    title: "Madhubani moves to paper",
    body: "A drought pushes the women of Mithila to paint on paper for sale rather than walls for the household. The double line comes with them — insurance the paper no longer needs, kept as signature.",
  },
  {
    era: "1970s",
    title: "Jangarh Singh Shyam, and Warli on canvas",
    body: "Gond and Warli painters move from wall to canvas and enter the gallery. The forms survive the change, because the motif was never in the wall.",
  },
  {
    era: "Today",
    title: "Line, pigment, hand",
    body: "The materials have not changed much, because they did not need to. What is at risk is not the technique but the transmission — a form is only alive if someone is still learning it from someone.",
  },
];
