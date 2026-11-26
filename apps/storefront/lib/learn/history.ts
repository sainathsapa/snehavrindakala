import type { Entry } from "./types";

/**
 * Plate 03 — the history.
 *
 * An Indian art house cannot survey painting with nine stops. This plate covers
 * the traditions the shop actually deals in, grouped into eras so the list reads
 * as a history rather than an inventory. Every date is a range, because the
 * evidence is a wall, a colophon or a traveller's note — and a single year would
 * claim more than the evidence can carry.
 */
export const HISTORY: Entry[] = [
  /* ── prehistory ─────────────────────────────────────────────────────── */
  {
    slug: "bhimbetka",
    plate: "history",
    era: "Prehistory",
    title: "Bhimbetka",
    gloss: "Shelter paintings in Madhya Pradesh — the oldest surviving picture-making on the subcontinent.",
    definition:
      "Painted rock shelters in the Vindhya hills, with animals, hunts and handprints in red ochre, made over tens of thousands of years.",
    body: [
      "The earliest marks are handprints and simple animal forms in ochre and manganese, and they are not isolated: the same shelters were painted, abandoned and repainted across an enormous span. What survives is a palimpsest, not an image.",
      "The technical lesson is permanence. Ochre and manganese bound with fat or water have lasted where almost nothing else would, because the shelters were dry, sheltered and never cleaned. A medium is only as durable as its site.",
      "Warli and Gond line work are not descended from Bhimbetka in any documented way, but they share its grammar — figures in profile, repeated marks for movement, animals drawn from memory rather than observation.",
    ],
    lookFor: [
      "Figures packed in rows to indicate many, not depth.",
      "Animals drawn with interior detail — the early ancestor of Gond digna.",
      "Red ochre and black manganese on a rough, unpainted rock face.",
    ],
    related: ["digna", "tarpa", "cow-dung-wall"],
    source: { tradition: ["Madhya Pradesh"], period: "c. 10,000 BCE onward" },
  },

  /* ── classical ──────────────────────────────────────────────────────── */
  {
    slug: "ajanta",
    plate: "history",
    era: "Classical",
    title: "Ajanta and the mural tradition",
    gloss: "Rock-cut caves painted with mineral pigment on plaster, where figures are modelled with light.",
    definition:
      "Buddhist cave murals in Maharashtra, painted over several centuries, that establish a fully modelled, shaded figure in India.",
    body: [
      "The figures are modelled with light, unlike the flat colour of later folk painting — proof that 'Indian painting' was never one style. Ajanta's bodies turn in space; a Pattachitra's do not, and both are correct within their own aims.",
      "Technically these are fresco-secco: pigment on a dry lime and clay ground, burnished from behind. Lime plaster stays alkaline and destroys organic binders over time, which is exactly what happened here.",
      "Ajanta sets a contrast that runs through this whole plate: a courtly, modelled, interior tradition, and a graphic, flat, exterior one. Both continue, sometimes on the same object.",
    ],
    lookFor: [
      "Faces built up in graded tones, unlike the flat fills of folk traditions.",
      "A ground that follows the rock's curvature, filling a cave rather than a frame.",
      "Losses that follow the plaster, not the image.",
    ],
    related: ["kala", "pattachitra-rasa", "lamp-soot-black"],
    source: { tradition: ["Maharashtra"], period: "c. 500 BCE – 500 CE" },
  },
  {
    slug: "chola-bronze",
    plate: "history",
    era: "Classical",
    title: "Chola bronzes",
    gloss: "Lost-wax cast images made for procession, not for a plinth.",
    definition:
      "Bronze figures cast by the cire-perdue method in Tamil Nadu, designed to be carried, dressed and seen in moving light.",
    body: [
      "These are not sculpture in the museum sense. A Nataraja or a Parvati was made to be bathed, dressed, garlanded and carried through a crowd, which is why the casting is hollow, the base is small and the silhouette is designed to read from below and in motion.",
      "The lost-wax method means the mould is destroyed to release the image: every bronze is an original and none can be repeated. That single fact is why a cast's quality is read from the wax model, not the metal.",
      "Tanjore painting grows directly out of this practice. Once the god is a dressed image rather than a stone, the painter's job becomes gilding and relief, and the surface matters as much as the figure.",
    ],
    lookFor: [
      "Weight carried low, with a small base made for lifting.",
      "Hollow casting, thin walls, and finishing marks inside the drapery.",
      "A silhouette readable from a distance in a crowd.",
    ],
    related: ["tanjore-painting", "kalash", "torana"],
    source: { tradition: ["Tamil Nadu"], period: "c. 850 – 1250 CE" },
  },
  {
    slug: "temple-walls",
    plate: "history",
    era: "Classical",
    title: "The regional temple walls",
    gloss: "Kerala murals, Tanjore work and the first Mithila wall paintings — art moves inside the building.",
    definition:
      "A period in which the wall becomes the book: colour is mixed from whatever the region grows or quarries.",
    body: [
      "Three traditions consolidate in this span, each with a palette drawn from local material: Kerala's ochres and greens, Tanjore's gesso and gold leaf, Mithila's earth and lamp black on mud.",
      "The building decides the composition. A mural is made for a dark interior and a single processional viewpoint, so figures are built for oblique viewing and large passes of colour — the opposite of a manuscript held in the hand.",
      "Tanjore is the outlier worth noting: relief gesso and gold leaf make the painting an object that reflects light, closer to sculpture than to the flat mural next door.",
    ],
    lookFor: [
      "Palettes traceable to local stone and earth.",
      "Figures scaled for a viewer standing low and close, not for a page.",
      "Relief or gesso, where a tradition wanted the image to catch lamplight.",
    ],
    related: ["kerala-mural", "tanjore-painting", "bharni"],
    source: { tradition: ["Kerala", "Tamil Nadu", "Bihar"], period: "c. 750 – 1200 CE" },
  },
  {
    slug: "kerala-mural",
    plate: "history",
    era: "Classical",
    title: "Kerala mural",
    gloss: "Wall painting in a narrow earth palette, built for lamplit interiors.",
    definition:
      "Temple and palace murals of Kerala, painted in ochre, red, green and white, with figures modelled in graded tone.",
    body: [
      "The palette is unusually small and unusually warm: yellow ochre, red, green from a local earth, white from shell or lime, black from soot. Five colours carry an entire wall.",
      "Composition follows the architecture. Figures are packed, overlapping, and drawn at an angle to be read as you walk past a doorway; a mural that looks crowded head-on is often correct from the path.",
      "The graded modelling is the technical signature — a face turns from light to shadow in three or four flat bands, not a smooth gradient, which is why these walls still read in near-darkness.",
    ],
    lookFor: [
      "Flat tonal bands rather than smooth shading.",
      "Green used structurally, not decoratively — it separates depth planes.",
      "Packing that resolves when viewed at an angle.",
    ],
    related: ["temple-walls", "conch-shell-white", "pattachitra-rasa"],
    source: { tradition: ["Kerala"], period: "c. 750 – 1200 CE onward" },
  },
  {
    slug: "tanjore-painting",
    plate: "history",
    era: "Classical",
    title: "Tanjore painting",
    gloss: "Gesso relief and gold leaf, made for lamplight.",
    definition:
      "Devotional panel painting from Tamil Nadu, built up in relief and gilded so the image catches a flame.",
    body: [
      "Tanjore is closer to a jewelled object than a picture. The board is prepared, the figure built up in gesso relief, then covered in gold leaf and set with glass or stone — the surface is the point.",
      "This follows from where it was seen: a shrine lit by oil lamps and moving flame, where a flat painting would disappear. The relief throws a shadow of its own, so the image changes as the light does.",
      "The format also explains the palette. Large areas of red and green frame a central gilded figure, because contrast at a distance in low light is what a devotional panel must deliver.",
    ],
    lookFor: [
      "Raised ornament you can see in profile at the edge of the frame.",
      "Gold leaf laid over relief, not painted gold.",
      "Lamps reflected once, from the gilding, not painted in as a highlight.",
    ],
    related: ["chola-bronze", "temple-walls", "kalash"],
    source: { tradition: ["Tamil Nadu"], period: "c. 1600 onward" },
  },
  {
    slug: "mysore-painting",
    plate: "history",
    era: "Classical",
    title: "Mysore painting",
    gloss: "The quieter cousin of Tanjore: gesso, thin gold, and restraint.",
    definition:
      "Devotional painting from Karnataka using the same materials as Tanjore but far less of them.",
    body: [
      "Where Tanjore fills the frame with ornament, Mysore leaves it open. Gilding is thin and selective, the palette is cooler, and large passages of plain ground do the work — restraint is the distinguishing discipline.",
      "The technique is shared: a prepared cloth or board, gesso for relief, gold leaf over it, natural pigment bound for permanence. The difference is proportion.",
      "For a buyer, the two are often confused because the subjects overlap. The test is the amount of empty space: a Mysore panel is comfortable with ground showing.",
    ],
    lookFor: [
      "More unpainted ground than a Tanjore of the same size.",
      "Thin gold lines rather than solid gilded fields.",
      "Cooler, softer colour with fewer saturated passages.",
    ],
    related: ["tanjore-painting", "temple-walls", "conch-shell-white"],
    source: { tradition: ["Karnataka"], period: "c. 1700 onward" },
  },

  /* ── court ─────────────────────────────────────────────────────────── */
  {
    slug: "mughal-rajput-miniature",
    plate: "history",
    era: "Court",
    title: "Mughal and Rajput miniature",
    gloss: "Small-format painting on paper, made for albums and for looking closely.",
    definition:
      "Court painting in which the sheet, the brush and the composite album become the organising technology.",
    body: [
      "Everything that makes fine Indian painting possible arrives here: paper, the squirrel-hair brush, the flat colour field, and the profile face that later folk painting inherits.",
      "The album is the unit, not the picture. Miniatures are arranged against a margin, often with calligraphy above and below, so a page is a designed relationship rather than a single image. Colour fields are burnished flat from the reverse.",
      "The convention of the profile — visible eye on a turned face — is not a failure of anatomy. It carries expression at small scale, and it persists because it works.",
    ],
    lookFor: [
      "A single visible eye on a profile face, drawn rather than implied.",
      "Colour fields with no visible brushwork, burnished from behind.",
      "A ruled margin, with the image composed into it.",
    ],
    related: ["kishangarh", "pahari-kangra", "squirrel-hair-brush"],
    source: { tradition: ["Mughal", "Rajput"], period: "c. 1550 – 1750" },
  },
  {
    slug: "kishangarh",
    plate: "history",
    era: "Court",
    title: "Kishangarh",
    gloss: "The Rajput school that painted weather, not just figures.",
    definition:
      "A Rajasthani court atelier known for monsoon scenes, night skies and a very tall, very cool figure of Krishna.",
    body: [
      "Kishangarh's subject is atmosphere. Cloud banks stack in modelled grey-violet, lightning is drawn rather than implied, and the ground is often a dark field that makes a single pale figure carry the whole page.",
      "The famous long-limbed Bani Thani profile is a formal invention, not portraiture: the proportions are pulled to a point where the figure reads as an idea of grace rather than a person.",
      "Technically these are miniatures, but the colour decisions are unusual — large areas of cool blue and lilac, which is why a Kishangarh page can be picked out across a room.",
    ],
    lookFor: [
      "Clouds built in bands of grey-violet, with a dark horizon.",
      "An unnaturally elongated figure, especially in profile.",
      "Cool colour dominating a warm court tradition.",
    ],
    related: ["mughal-rajput-miniature", "bundi-kota", "pahari-kangra"],
    source: { tradition: ["Rajasthan"], period: "c. 1730 – 1800" },
  },
  {
    slug: "bundi-kota",
    plate: "history",
    era: "Court",
    title: "Bundi and Kota",
    gloss: "Hunting, forest and the densest foliage in Rajput painting.",
    definition:
      "Two neighbouring Rajasthani courts whose ateliers specialised in landscape, animals and the hunt.",
    body: [
      "Bundi and Kota share a palette and a subject: a forest painted as a wall of individual leaves, with animals and hunters threaded through it at a scale that keeps the eye working.",
      "The foliage is the technical achievement. Rather than a green mass, every leaf is outlined, so a jungle panel reads as embroidery at arm's length and as depth from across a room.",
      "Kota pushes toward the dramatic — tigers, night hunts, fire — while Bundi stays cooler and more lyrical. Both reward looking at the edges, where the forest is densest.",
    ],
    lookFor: [
      "Individual outlined leaves, never a painted mass.",
      "Animals in profile, half hidden, at the same scale as the trees.",
      "A horizon placed high to leave room for foliage.",
    ],
    related: ["kishangarh", "mughal-rajput-miniature", "pahari-kangra"],
    source: { tradition: ["Rajasthan"], period: "c. 1650 – 1850" },
  },
  {
    slug: "pahari-kangra",
    plate: "history",
    era: "Court",
    title: "Pahari and Kangra",
    gloss: "Hill painting: cool light, soft faces, and a landscape with weather in it.",
    definition:
      "Painting from the Punjab hills, best known for the Kangra and Guler ateliers and for lyric poetry set in landscape.",
    body: [
      "Pahari work trades court formality for tenderness. Faces are rounder, eyes lower, and the figure sits inside a landscape that has its own weather rather than a neutral ground.",
      "Colour is cooler and softer than the plains: greens, blues and creams, laid in flat fields with very fine line work on top. The line is the constant — delicate, unbroken, and never doubled.",
      "Much of the subject matter is literary: the Gita Govinda, Baramasa, Nayika themes. A Pahari page is usually an illustration of a poem you are meant to be able to recite.",
    ],
    lookFor: [
      "A landscape that occupies more of the page than the figures.",
      "Fine single-line drawing with no double contour.",
      "Cool green and blue fields with warm accents only in the flesh.",
    ],
    related: ["kishangarh", "mughal-rajput-miniature", "squirrel-hair-brush"],
    source: { tradition: ["Punjab Hills"], period: "c. 1690 – 1830" },
  },
  {
    slug: "pichwai",
    plate: "history",
    era: "Court",
    title: "Pichwai",
    gloss: "A painted cloth hung behind a temple image — the wall the god stands in front of.",
    definition:
      "Large devotional textile from Nathdwara, Rajasthan, painted for a specific position behind the deity.",
    body: [
      "A pichwai is architecture by other means. It hangs behind an image, so its composition is built to be seen in fragments between and around a physical figure, and its borders carry the eye upward.",
      "The subject is usually a season, a festival or an episode from Krishna's life, and the format changes with the occasion — a different cloth for the monsoon, for Sharad Purnima, for Annakuta.",
      "Technically these are painted and sometimes embroidered or appliquéd, on cotton, at a scale far larger than miniature work. Gold is used for water and for ornament, so the cloth shifts as the temple lamps move.",
    ],
    lookFor: [
      "An empty central zone, where the deity would stand.",
      "Borders built as architecture — pavilions, gateways, rows of figures.",
      "Gold used for river and pond surfaces.",
    ],
    related: ["torana", "kalash", "kishangarh"],
    source: { tradition: ["Rajasthan"], period: "c. 1700 onward" },
  },

  /* ── colonial ──────────────────────────────────────────────────────── */
  {
    slug: "scroll-trades",
    plate: "history",
    era: "Colonial",
    title: "Pattachitra and the scroll trades",
    gloss: "Scroll painting serves pilgrimage and storytelling: a picture is unrolled and sung.",
    definition:
      "The period in which scroll painting is a service performed for an audience, not an object collected.",
    body: [
      "Scroll painters travelled to pilgrimage towns and performed: unrolling a panel at a time, singing the episode, collecting a fee. The object was a tool of the performance and wore out as one.",
      "This explains the physical form. Cloth rather than paper, because it rolls; borders painted as part of the structure, because the panel is handled by its edges; and fixed sequence, because the narration cannot be reordered.",
      "The same economy runs through phad in Rajasthan, patua in Bengal and chitrakathi in Maharashtra. Painting was paid for as a service, and the sale of a painting as a wall object is comparatively recent.",
    ],
    lookFor: [
      "Panels that group into a sequence with a fixed order.",
      "Heavy, handling-friendly borders painted rather than bound.",
      "Subjects chosen to be narrated: episodes, entrances, recognitions.",
    ],
    related: ["chitrakathi", "patua-scroll", "phad"],
    source: { tradition: ["Odisha", "Rajasthan", "Bengal"], period: "c. 1700 – 1900" },
  },
  {
    slug: "kalighat",
    plate: "history",
    era: "Colonial",
    title: "Kalighat pat",
    gloss: "Cheap, fast, satirical painting for pilgrims — India's first popular print culture.",
    definition:
      "Calcutta paintings on mill paper, sold near the Kali temple, made in hours and priced for a visitor.",
    body: [
      "Kalighat is a market form: smaller, faster and bolder than the scroll traditions, with a brush line that swings because speed mattered more than finish. Backgrounds are often left blank.",
      "Its subjects are unusually wide — gods, but also scandals, lawyers, courtesans, women riding bicycles. This is early urban satire, and it is the closest thing in Indian painting to a newspaper cartoon.",
      "The form died when lithography arrived, which is the honest lesson of the plate: a technique that cannot beat a cheaper reproduction either changes what it is for, or ends.",
    ],
    lookFor: [
      "A confident, sweeping outline with little interior detail.",
      "Blank or barely touched backgrounds.",
      "Secular, satirical subjects beside devotional ones.",
    ],
    related: ["patua-scroll", "company-painting", "kala"],
    source: { tradition: ["Bengal"], period: "c. 1830 – 1930" },
  },
  {
    slug: "company-painting",
    plate: "history",
    era: "Colonial",
    title: "Company painting",
    gloss: "Indian hands painting for European catalogues — the market decides the subject.",
    definition:
      "Watercolours made by Indian artists for East India Company patrons, documenting trades, castes, birds and monuments.",
    body: [
      "These exist because a buyer wanted an inventory, not an interpretation. A page might show twelve trades, each in dress, each labelled — an ethnographic catalogue in paint.",
      "The technique hybridises: Indian line and flat colour combined with European perspective and watercolour wash. The result is often technically excellent and emotionally empty, which is exactly the criticism it received then and now.",
      "Its value to a studio like this one is documentary. Company painting is often the best surviving record of what a craft looked like at the moment it was being displaced.",
    ],
    lookFor: [
      "Blank white grounds, with no landscape or interior.",
      "Perspective used inconsistently with Indian figure conventions.",
      "Labels or numbers, often in English, in the margin.",
    ],
    related: ["kalighat", "mughal-rajput-miniature", "kala"],
    source: { tradition: ["Bengal", "Madras", "Delhi"], period: "c. 1760 – 1880" },
  },

  /* ── the craft economies ───────────────────────────────────────────── */
  {
    slug: "swadeshi",
    plate: "history",
    era: "Colonial",
    title: "Kalamkari and the nationalist turn",
    gloss: "Hand-printed and hand-drawn textiles become a symbol of swadeshi.",
    definition:
      "A turn in which the technique survives partly because of what it came to stand for.",
    body: [
      "Hand production became an argument. Khadi, hand-block printing and kalamkari were read as economic self-determination, and demand for them was political as much as aesthetic.",
      "The consequence for the craft was double-edged: it secured patronage, and it froze certain forms as representative. Designs that read instantly as 'traditional' were repeated and exported, while quieter work was not.",
      "It is worth remembering when a label says 'revival'. Sometimes a technique survived because someone bought it, and the reasons for that purchase were not about the object.",
    ],
    lookFor: [
      "Repeated, instantly legible motifs on 20th-century cloth.",
      "Institutional or government marks on labels, which often date a piece.",
      "Technique that has survived with limited variation across decades.",
    ],
    related: ["kalamkari", "ajrakh-resist", "tana-bana"],
    source: { tradition: ["pan-Indian"], period: "1930s onward" },
  },
  {
    slug: "patua-scroll",
    plate: "history",
    era: "Colonial",
    title: "Bengal patua scroll",
    gloss: "A single long cloth, painted and sung, still performed today.",
    definition:
      "Scroll painting from Bengal, where panels are painted in sequence and narrated by the painter.",
    body: [
      "The patua tradition is the clearest surviving example of the scroll-as-performance. A vertical cloth carries panel after panel; the singer unrolls as they go, so the image is revealed at the speed of the story.",
      "Colour is flat and strong, and panels are separated by bands rather than frames, because the eye has to find the next register quickly in poor light.",
      "In the twentieth century the repertoire widened to include floods, epidemics and political events — proof that a form survives by taking on new subjects, not by preserving old ones.",
    ],
    lookFor: [
      "One continuous cloth divided into horizontal registers.",
      "Flat saturated colour with heavy outline.",
      "Modern subjects painted in a traditional grammar.",
    ],
    related: ["kalighat", "scroll-trades", "chitrakathi"],
    source: { tradition: ["Bengal"], period: "18th century onward" },
  },
  {
    slug: "phad",
    plate: "history",
    era: "Colonial",
    title: "Phad",
    gloss: "A long narrative cloth carried and unrolled by hereditary singer-painters.",
    definition:
      "Rajasthani scroll painting of epic heroes, performed by the Joshi families of Shahpura.",
    body: [
      "A phad is enormous and read while moving: the cloth is held open at one section, then the next. Composition is therefore built in registers with unmistakable entries, so a viewer can join at any point.",
      "Colour is applied flat and the outline is drawn last and heavily, over everything — the opposite order to most painting, and the reason the figures stay legible at four metres.",
      "The painters are also the performers. The images were not made to be sold but to be used in a recitation, and the hero's genealogy is painted as a map rather than a scene.",
    ],
    lookFor: [
      "Heavy outline applied over colour, uniting the whole surface.",
      "Registers that read as a map of events rather than a single scene.",
      "Figures in strict profile, at large scale, on a red ground.",
    ],
    related: ["scroll-trades", "patua-scroll", "pichwai"],
    source: { tradition: ["Rajasthan"], period: "c. 1700 onward" },
  },
  {
    slug: "madhubani-paper",
    plate: "history",
    era: "Modern",
    title: "Madhubani moves to paper",
    gloss: "A drought pushes the women of Mithila to paint on paper for sale rather than walls for the household.",
    definition:
      "The moment a wall tradition becomes a portable, sellable form — and keeps a line that only made sense on a wall.",
    body: [
      "The move was economic before it was aesthetic. With crops failing, painting on paper for sale turned a household practice into income, and the form changed scale, palette and audience within a decade.",
      "The double line survived the change. On mud walls the outer line blurred, so the inner line guaranteed the shape; on paper that protection was unnecessary, and the double line became signature.",
      "The same transition later repeats with Gond and Warli painting. In every case the motif survives the move from wall to paper because the form was never in the wall.",
    ],
    lookFor: [
      "Every form outlined twice, including small background elements.",
      "Paper-sized compositions carrying the density of a wall panel.",
      "Later commercial pigments, brighter than an earth palette.",
    ],
    related: ["kacni", "bharni", "gond-warli-canvas"],
    source: { tradition: ["Mithila, Bihar"], period: "1966 – 1970s" },
  },
  {
    slug: "gond-warli-canvas",
    plate: "history",
    era: "Modern",
    title: "Gond and Warli on canvas",
    gloss: "Wall painters move to canvas and enter the gallery; the forms survive the change.",
    definition:
      "A shift from architecture to market, in which a ceremony becomes a picture and keeps its grammar.",
    body: [
      "The move is visible in the surface. Warli on canvas keeps the red-earth ground as a remembered wall; Gond painting develops a finer line and denser interior once it is made for a frame rather than a room.",
      "Something is gained and something is lost. Composition can now be planned as an image rather than integrated into a building; patronage arrives from galleries and collectors instead of a village and a ritual calendar.",
      "The honest way to read this later work is neither decline nor betrayal, but a tradition working for a different audience — same forms, different question.",
    ],
    lookFor: [
      "Canvas grounds imitating an earth wall.",
      "Denser digna and a finer line than the wall versions.",
      "Signatures, which almost never appear in ritual work.",
    ],
    related: ["digna", "tarpa", "madhubani-paper"],
    source: { tradition: ["Gond", "Warli"], period: "1970s onward" },
  },
  {
    slug: "santiniketan",
    plate: "history",
    era: "Modern",
    title: "Bengal School and Santiniketan",
    gloss: "A deliberate answer to Company painting: Indian subjects in an Indian hand.",
    definition:
      "The nationalist-modern movement around Abanindranath Tagore and Kala Bhavana, which argued for a painting neither colonial nor derivative.",
    body: [
      "The Bengal School turned away from oil and perspective toward wash, muted colour and literary subjects — a conscious recovery of manuscript conventions, using the watercolour technique the Company schools had introduced.",
      "Santiniketan went further, into mural scale, experiment and the idea of art as part of an education rather than a commodity. Nandalal Bose's work on festivals and public murals belongs here.",
      "The debate this started — how much of the past a modern Indian painting should carry — is still the live question in an art house. Every contemporary folk-revival piece is an answer to it.",
    ],
    lookFor: [
      "Wash technique with visible pooling and soft edges.",
      "Muted, almost dusty colour rather than saturated pigment.",
      "Literary and historical Indian subjects, painted without colonial props.",
    ],
    related: ["company-painting", "progressive-artists", "kala"],
    source: { tradition: ["Bengal"], period: "c. 1900 – 1950" },
  },

  /* ── modern + contemporary ─────────────────────────────────────────── */
  {
    slug: "progressive-artists",
    plate: "history",
    era: "Modern",
    title: "The Progressive Artists' Group",
    gloss: "Bombay, 1947: the year independence arrives, so does abstraction.",
    definition:
      "A group formed in 1947 that set out to paint without inherited iconography, in oil, for the new nation.",
    body: [
      "Husain, Raza, Souza, Gade and Bakre took the freedom of the moment literally: no mythology, no miniature conventions, and the city as subject. The gesture became the content.",
      "Their importance to the market is structural. This is where the Indian secondary market is anchored — the first generation whose works have an established auction record, and therefore a price floor.",
      "For a younger studio, the lesson is about risk. The group was controversial precisely because it refused the 'authentic Indian' brief that buyers wanted, and that refusal is what made the work consequential.",
    ],
    lookFor: [
      "Gesture used as subject, with drawing left visible.",
      "Oil on canvas in a market that had expected watercolour and tempera.",
      "Urban, secular imagery in place of mythological scenes.",
    ],
    related: ["santiniketan", "baroda-school", "kala"],
    source: { tradition: ["Mumbai"], period: "1947 – 1956" },
  },
  {
    slug: "baroda-school",
    plate: "history",
    era: "Contemporary",
    title: "Baroda and after",
    gloss: "Figuration returns, with narrative and irony.",
    definition:
      "The Faculty of Fine Arts in Baroda and its students, who re-introduced the figure and the story after abstraction.",
    body: [
      "Baroda painting is figurative without being traditional, narrative without being illustrative. The figure returns, but as a constructed, argued object rather than a subject to be admired.",
      "This is the generation that made Indian contemporary art legible internationally — large scale, installation, video, and a critical relationship to both folk sources and the market.",
      "It also matters for how a folk tradition is used. A Baroda-trained painter can quote a Gond motif without pretending to be a Gond painter, which is a different act from revival and should be priced differently.",
    ],
    lookFor: [
      "The figure built rather than observed — constructed forms, deliberate awkwardness.",
      "Scale that assumes a gallery wall, not a domestic one.",
      "Quotation of folk motifs used critically, not decoratively.",
    ],
    related: ["progressive-artists", "gond-warli-canvas", "kala"],
    source: { tradition: ["Vadodara"], period: "1980s onward" },
  },
  {
    slug: "line-pigment-hand",
    plate: "history",
    era: "Contemporary",
    title: "Line, pigment, hand",
    gloss: "The materials have not changed much, because they did not need to.",
    definition:
      "The present state of the traditions: technique intact, transmission at risk.",
    body: [
      "A shell white, a lamp black, a squirrel-hair brush and a cloth sized with tamarind would be recognisable to a painter working two centuries ago. The tools did not need improving, because the constraint they serve — one hand, one line at a time — has not moved.",
      "What is at risk is not the technique but the transmission. A form is alive only while someone is still learning it from someone; when the last person who can correct a student dies without a student, the corrections go with them.",
      "So the useful question about a contemporary piece is not 'is this authentic' but 'who taught this person, and are they teaching anyone'. The answer decides whether you are buying a tradition or a photograph of one.",
    ],
    lookFor: [
      "Evidence of correction: work showing a teacher's discipline, not a market's preference.",
      "Younger painters on established forms — transmission, not revival.",
      "Materials still made by hand, the cheapest proof the chain is intact.",
    ],
    related: ["kala", "squirrel-hair-brush", "conch-shell-white"],
    source: { tradition: ["pan-Indian"], period: "today" },
  },
];
