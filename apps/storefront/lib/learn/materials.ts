import type { Entry } from "./types";

/**
 * Plate 02 — materials.
 *
 * Each entry answers the same three questions, in the same order: what is it,
 * why this instead of something easier, and what goes wrong without it.
 */
export const MATERIALS: Entry[] = [
  {
    slug: "rice-paste",
    plate: "materials",
    title: "Rice paste",
    languages: ["Warli", "Kolam"],
    gloss: "Rice ground with water, drawn with a bamboo stick chewed at the end to form a brush.",
    definition:
      "The oldest drawing medium on the subcontinent that is still in daily use: ground rice, water, and a stick.",
    body: [
      "It is what a household already had. The medium never travelled further than the kitchen, which is why Warli walls and kolam thresholds use the same material for completely different purposes — one to keep an image, one to sweep it away by evening.",
      "The stick matters as much as the paste. A bamboo twig chewed at one end frays into bristles of uneven length, so the line is never mechanically even. A brush would be too controlled; the tool is part of the aesthetic.",
      "Rice paste is opaque on a dark wall and pale on a red-earth ground, and it fails gracefully: it flakes instead of bleeding, so an old Warli wall loses patches rather than turning into a smear.",
    ],
    lookFor: [
      "Chalky, matte surface with no sheen.",
      "Edges that crumble slightly — dried paste, not paint film.",
      "Thin passages where the unevenness of the stick shows.",
    ],
    related: ["kolam", "cow-dung-wall", "tarpa"],
    source: { tradition: ["Warli, Maharashtra", "Tamil Nadu"] },
  },
  {
    slug: "conch-shell-white",
    plate: "materials",
    title: "Conch shell white",
    languages: ["Pattachitra", "Kerala Mural"],
    gloss: "Shell burnt and ground to a fine powder, then mixed with gum.",
    definition:
      "The white of Pattachitra and Kerala murals: calcium from burnt shell, not from chalk or zinc.",
    body: [
      "It stays white for centuries where chalk yellows. That single property explains the material: a Pattachitra's brightest passages — eyes, conch, cloud, the whites of a face — had to survive being rolled, carried and unrolled in humid Odisha.",
      "Shell is burnt, then ground wet on a stone for hours. The fineness of the grind decides whether the white sits as a bright opaque patch or dries dull and grey.",
      "Because the preparation is slow and the result is unmistakable, a genuine shell white is one of the quickest ways to date a piece: modern substitutes read slightly blue under daylight, and blue-white in a photograph.",
    ],
    lookFor: [
      "A warm, slightly creamy white rather than a bright paper white.",
      "Opaque passages with brushmarks visible inside them, not flat digital white.",
      "No craquelure pattern typical of zinc or titanium whites in oil.",
    ],
    related: ["pattachitra", "lamp-soot-black", "squirrel-hair-brush"],
    source: { tradition: ["Odisha", "Kerala"] },
  },
  {
    slug: "lamp-soot-black",
    plate: "materials",
    title: "Lamp soot black",
    languages: ["Pattachitra", "Kalamkari"],
    gloss: "Soot collected from an oil lamp, bound with gum or water.",
    definition:
      "Carbon black gathered from the underside of a lamp, the warmest and most stable black in traditional Indian painting.",
    body: [
      "Black made this way ages to a warm brown-black. Chemical black stays blue forever. This is the single most reliable way to spot a forgery or a modern print finished by hand: look at the darkest line and ask whether it has warmth in it.",
      "Collection is a slow household practice — a lamp is set under a curved surface, soot accumulates, and it is scraped and bound. The labour is trivial; the result is not, because soot contains tars that give the black its depth.",
      "In kalamkari the same logic appears as iron acetate rather than soot: a black that has to live in cloth cannot be a pigment sitting on top of the fibre.",
    ],
    lookFor: [
      "Black with a brown edge under strong light, especially in thin lines.",
      "Density that varies with the brush's load, not a uniform printed black.",
      "Ageing to a soft charcoal rather than fading to grey-blue.",
    ],
    related: ["pattachitra", "iron-acetate", "conch-shell-white"],
    source: { tradition: ["Odisha", "Andhra Pradesh"] },
  },
  {
    slug: "iron-acetate",
    plate: "materials",
    title: "Iron acetate",
    languages: ["Kalamkari", "Ajrakh"],
    gloss: "Rusty iron soaked in jaggery water until it turns black.",
    definition:
      "A mordant-dye made by fermenting scrap iron with jaggery, used to draw black directly into cotton.",
    body: [
      "It does not sit on the cloth; it binds to the fibre and survives twenty washes. That is the whole reason kalamkari line work is still legible after two centuries, where a painted line would have washed out.",
      "The making is unglamorous: iron filings or old horseshoes in water with jaggery, left to ferment until the liquor turns dark. Strength varies between batches, so a dyer tests on a scrap before committing a cloth.",
      "Because the black is chemically part of the fibre, it behaves differently from pigment: it does not craze, does not peel, and can be pushed toward grey by diluting the liquor rather than by adding white.",
    ],
    lookFor: [
      "Black that reads through the weave from the reverse of the cloth.",
      "Soft edges where the liquor wicked into neighbouring threads.",
      "No surface texture on the line — it is inside the fibre, not on it.",
    ],
    related: ["kalamkari", "myrobalan", "lamp-soot-black"],
    source: { tradition: ["Andhra Pradesh", "Gujarat", "Rajasthan"] },
  },
  {
    slug: "myrobalan",
    plate: "materials",
    title: "Myrobalan",
    languages: ["Kalamkari", "Block printing"],
    gloss: "Dried Terminalia chebula fruit powder, applied to cotton before drawing.",
    definition:
      "A tannin ground applied to cloth before any drawing or dyeing, so that colour grips the fibre.",
    body: [
      "It leaves a tannin layer the dye can hold on to. Without it the line bleeds and the cloth is lost — literally; a kalamkari started without myrobalan cannot be rescued, only over-dyed darker.",
      "It also slightly yellows the cloth, which is why traditional kalamkari reads cream rather than white. That cream is not ageing, it is chemistry, and it is present on day one.",
      "Because myrobalan is a tannin, it interacts with iron to produce the black: the same fruit that prepares the ground also takes part in the drawing.",
    ],
    lookFor: [
      "A uniform pale cream ground, lighter where the cloth was folded.",
      "Colour that sits in the fibre rather than on it.",
      "White passages that were resisted rather than left undyed.",
    ],
    related: ["kalamkari", "iron-acetate", "ajrakh-resist"],
    source: { tradition: ["Andhra Pradesh", "Gujarat"] },
  },
  {
    slug: "buffalo-milk",
    plate: "materials",
    title: "Buffalo milk",
    languages: ["Kalamkari"],
    gloss: "Soured milk brushed over cloth and dried before drawing.",
    definition:
      "A sizing coat: sour milk brushed on cotton so the pen line does not spread into the weave.",
    body: [
      "Cloth is porous. A pen loaded with iron liquor on untreated cotton feathers outward along the threads, and a fine line becomes a blur. Soured milk fills the gaps between threads and gives the surface just enough resistance.",
      "It is the same problem priming solves for a canvas, and solved with the same logic: change the surface, not the paint. What is different is the material — milk, because it was there.",
      "The coat also hardens the cloth slightly, which is why kalamkari panels have a papery handle before their first wash.",
    ],
    lookFor: [
      "A faint stiffness, like sized fabric, that softens with washing.",
      "Line edges that stay crisp rather than feathering into the weave.",
    ],
    related: ["kalamkari", "tamarind-chalk", "myrobalan"],
    source: { tradition: ["Andhra Pradesh"] },
  },
  {
    slug: "tamarind-chalk",
    plate: "materials",
    title: "Tamarind seed + chalk",
    languages: ["Pattachitra"],
    gloss: "A paste used to coat cotton so it behaves like paper.",
    definition:
      "The preparation that turns cloth into a painting surface: tamarind seed powder and chalk, worked into the weave.",
    body: [
      "The paste gives the cloth 'tooth', the same property priming gives a canvas. Paint needs something to grip; without the coat, mineral pigment sinks, spreads and dries dull.",
      "Tamarind seed is a sizing agent and chalk is the filler — the two together produce a smooth, slightly absorbent surface that holds a crisp brush line and does not crack when the scroll is rolled.",
      "This is also why a Pattachitra can be rolled and carried: a painted cloth without this preparation would crack along every fold within a few journeys.",
    ],
    lookFor: [
      "A surface that looks painted on paper until you see the weave at the edge.",
      "Evenness across the whole panel — a patchy coat means uneven absorption.",
      "No cracking at fold lines in an old scroll.",
    ],
    related: ["pattachitra", "buffalo-milk", "conch-shell-white"],
    source: { tradition: ["Odisha"] },
  },
  {
    slug: "cow-dung-wall",
    plate: "materials",
    title: "Cow dung and red earth",
    languages: ["Warli"],
    gloss: "A wall base levelled by hand and painted with clay.",
    definition:
      "The ground of a Warli painting: dung, clay and water worked into a wall until it takes pigment.",
    body: [
      "Warli was painted on the wall it was about. The surface is the building, so the material had to work with the architecture rather than on top of it.",
      "The mix seals and slightly darkens the wall, giving rice paste a ground with enough contrast to read. It also regulates moisture, which is why these interiors stay cool and why the paste does not flake off within weeks.",
      "When Warli moved to canvas in the 1970s, painters carried the look of that ground with them — the reddish-brown field behind the white figures is a memory of a wall.",
    ],
    lookFor: [
      "A red-brown field with visible hand-levelling, not a flat painted ground.",
      "White figures sitting on the surface, thinning where the paste was scarce.",
      "In canvas work, a deliberately imitated earth tone behind the figures.",
    ],
    related: ["rice-paste", "tarpa", "digna"],
    source: { tradition: ["Warli, Maharashtra"] },
  },
  {
    slug: "ajrakh-resist",
    plate: "materials",
    title: "Myrobalan black + indigo",
    languages: ["Ajrakh", "Block printing"],
    gloss: "The two-stage resist used in Ajrakh: black from iron, blue from indigo, with mud as resist.",
    definition:
      "A fourteen-stage process in which mud is the shield and the river is the rinse.",
    body: [
      "Ajrakh is built on the order of operations rather than on the dyestuff. Myrobalan prepares, iron makes black, alum makes red, indigo makes blue, and a printed mud resist protects what must stay white while the indigo vat works.",
      "The mud is not a decorative choice. It is a physical barrier that is printed on, dried, and later washed out — which is why Ajrakh whites have soft, slightly irregular edges, the signature of a hand-printed resist.",
      "The washing between stages is done in running water. A fourteen-stage cloth may be rinsed as many times, and the final colour depends on how long each stage was left — which is why no two Ajrakh cloths are identical.",
    ],
    lookFor: [
      "White areas with faintly scalloped edges where mud was printed.",
      "Both sides of the cloth coloured, from indigo dyeing through, not printed on one face.",
      "Black and blue that meet without a halo — the mark of a resist, not a paint.",
    ],
    related: ["myrobalan", "iron-acetate", "buffalo-milk"],
    source: { tradition: ["Kutch, Gujarat", "Sindh"] },
  },
  {
    slug: "squirrel-hair-brush",
    plate: "materials",
    title: "Squirrel-hair brush",
    languages: ["Pattachitra", "Miniature", "Kalamkari"],
    gloss: "A few hairs bound to a bamboo handle, cut to a single point.",
    definition:
      "The fine brush of the miniature and the scroll: a handful of squirrel hairs that hold a load and release it in a taper.",
    body: [
      "Made for the one thing a machine cannot do: a line that thins as the hand lifts. The hairs are short, springy and hold a small reservoir, so pressure controls width continuously rather than in steps.",
      "A good brush is not bought so much as fitted. Painters trim the point themselves and keep several — one for outline, one for hair, one almost dry for dry-brush detail.",
      "Synthetic substitutes hold a sharper point but release unevenly, so the line goes thin then suddenly wet. The tell in an old miniature is a line that narrows smoothly across its whole length.",
    ],
    lookFor: [
      "Outlines that taper continuously, with no tremor at the end.",
      "Very fine hatching that stays dry rather than pooling.",
      "Hair and eyelash detail drawn with a single touch, not retraced.",
    ],
    related: ["pattachitra", "kalamkari", "conch-shell-white"],
    source: { tradition: ["Odisha", "Rajasthan", "Andhra Pradesh"] },
  },
];
