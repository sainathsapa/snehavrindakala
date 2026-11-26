import type { Entry } from "./types";

/**
 * Plate 01 — the vocabulary.
 *
 * Order follows the book: the general word first, then the traditions that give
 * it specific meaning. Each entry is written to be read alone, because a reader
 * arrives from a product page with one word and no context.
 */
export const WORDS: Entry[] = [
  {
    slug: "kala",
    plate: "words",
    title: "Kala",
    languages: ["Sanskrit"],
    gloss: "Art, craft, and skill — one word for all three.",
    definition:
      "Kala covers the made thing and the ability that made it. A painting is kala; so is the hand that can draw it, and so is the judgement that decides where the line stops.",
    body: [
      "The distinction between art and craft is a European one, arriving with the academy and its hierarchy of mediums. Kala does not make it. A pot, a mural, a manuscript illustration and a dance are all kala, and the word does not rank them.",
      "That matters commercially as much as philosophically. When a shop separates 'fine art' from 'craft' on a shelf, it is importing a distinction the traditions themselves never used — and usually pricing by it. This studio does not: a Warli wall and an oil painting are both work, judged by whether they were done well.",
      "Kala also carries the sense of a skill that is learned rather than inspired. The word assumes training: someone taught, someone practised, someone can still tell a good line from a lazy one.",
    ],
    lookFor: [
      "Whether the work rewards close looking or only distance — kala assumes the hand is legible.",
      "Whether the label calls it craft, because the word rarely appears on traditional work itself.",
    ],
    related: ["pattachitra", "digna", "tana-bana"],
    source: { tradition: ["Sanskrit", "pan-Indian"] },
  },
  {
    slug: "pattachitra",
    plate: "words",
    title: "Pattachitra",
    languages: ["Odia"],
    gloss: "Patta (cloth) + chitra (picture).",
    definition:
      "A cloth-based scroll painting from Odisha, made to be shown in sequence: unrolled, sung, explained, rolled again.",
    body: [
      "The support is cotton treated with tamarind seed and chalk so that mineral pigment holds without bleeding into the weave. That preparation is the whole reason the form survives: paint on untreated cloth sinks, spreads and dulls within a season.",
      "The palette is deliberately tiny — conch white, lamp soot black, red from vermilion or hingula, yellow from orpiment. Each colour is ground and bound separately, and the order of application is fixed, because a lighter colour laid beside a darker one changes in the eye.",
      "The composition is built with borders. Not decoration: the border is a frame that keeps the eye inside, and in the older scrolls the border is painted in the same breath as the figures, so the panel reads as one object rather than a picture in a mount.",
    ],
    lookFor: [
      "A white that has stayed white — that is burnt shell, not chalk.",
      "Faces in profile, eyes large, bodies built from repeated decorative pattern rather than anatomy.",
      "A border that feels structurally necessary, with figures overlapping it rather than sitting inside it.",
    ],
    related: ["conch-shell-white", "lamp-soot-black", "squirrel-hair-brush"],
    source: { tradition: ["Odisha"], period: "c. 1700 – 1900 onward" },
  },
  {
    slug: "kalamkari",
    plate: "words",
    title: "Kalamkari",
    languages: ["Telugu", "Persian"],
    gloss: "Kalam (pen) + kari (work) — pen work.",
    definition:
      "Cloth drawn with a bamboo pen wrapped in cloth, then dyed. The drawing and the colour are separate acts, often by different hands.",
    body: [
      "There are two branches. Srikalahasti, in Andhra Pradesh, is drawn freehand with the pen, so the line carries the composition. Machilipatnam is printed with carved blocks and wax resist, so the line is repeated rather than drawn. Both are kalamkari; they look nothing alike.",
      "The pen is not a brush. It holds a fixed, small quantity of liquid, so the line thins as the hand lifts and stops when the reservoir empties. That is why kalamkari outlines have a slight tremor and a taper that printed imitations cannot reproduce honestly — a machine can copy the shape but not the depletion.",
      "Colour arrives afterwards, and traditionally not from a palette but from a sequence: myrobalan, iron, alum, indigo, a wash in the river. A single cloth may cross a courtyard four times before it is finished.",
    ],
    lookFor: [
      "A line that thins toward its end — the pen running out, not a brush lifting.",
      "Regions of colour and regions of line that do not quite align, because they were done separately.",
      "Slight irregularity in the repeat, where a block was pressed by hand.",
    ],
    related: ["myrobalan", "iron-acetate", "squirrel-hair-brush"],
    source: { tradition: ["Andhra Pradesh"], period: "17th century onward" },
  },
  {
    slug: "kacni",
    plate: "words",
    title: "Kacni",
    languages: ["Maithili"],
    gloss: "Line work — the first pass of an outline.",
    definition:
      "The drawn outline in Mithila painting, laid down before any colour. In Madhubani it is drawn twice, one line inside the other.",
    body: [
      "The double line is the signature of the form. It was not invented as decoration: on a mud wall the outer line could blur, so a second, inner line guaranteed the shape survived. When the paintings moved to paper in the late 1960s, the technical reason disappeared and the line stayed, because by then it was what the painting was.",
      "Kacni is unforgiving. It is drawn in one movement, usually with a bamboo nib or a twig, and a hesitation shows as a bulge. Painters describe it as the part that cannot be corrected — colour can be adjusted, a line cannot.",
      "Because the line carries the whole composition, the drawing is planned before it begins. Larger works are marked with faint guides, but the visible outline is single-pass.",
    ],
    lookFor: [
      "Two lines, close together, running parallel without touching.",
      "Confidence at corners: a rounded, unhurried turn rather than a correction.",
      "Colour that stops short of the inner line, leaving a deliberate gap of paper.",
    ],
    related: ["bharni", "kolam", "kala"],
    source: { tradition: ["Mithila, Bihar"] },
  },
  {
    slug: "bharni",
    plate: "words",
    title: "Bharni",
    languages: ["Maithili"],
    gloss: "Colour fill, applied inside the kacni outline.",
    definition:
      "The flat colour that fills a Mithila outline. No shading, no modelling — depth is suggested by the double line, not by light.",
    body: [
      "Bharni is flat on purpose. A form is filled with a single tone, and the transition between forms is a hard edge. This is not a lack of skill: shading would destroy the graphic clarity the composition depends on, and it would introduce a light source, which these paintings do not have.",
      "The palette is small and locally sourced — lamp black, ochre, vermilion, indigo, and later commercial colours. Contrast, not gradient, does the work: a red figure on a yellow field reads at three metres.",
      "Different Mithila styles distribute colour differently. Kachni-style paintings are almost all line with a thin wash; Bharni-style paintings flood the ground. The name of the style often follows the amount of pigment, not the subject.",
    ],
    lookFor: [
      "Hard edges between colours, with no blending zone.",
      "A thin unpainted margin between line and colour — the outline stays visible.",
      "Colour used to separate figures from ground, not to model them.",
    ],
    related: ["kacni", "lamp-soot-black", "kala"],
    source: { tradition: ["Mithila, Bihar"] },
  },
  {
    slug: "digna",
    plate: "words",
    title: "Digna",
    languages: ["Gondi"],
    gloss: "The pattern that fills the inside of a form.",
    definition:
      "In Gond painting, the interior texture of a figure: seeds, dashes, small creatures, dots in rows.",
    body: [
      "A Gond animal is filled with its own habitat. The body of a deer becomes a field of grass and insects; a fish fills with water and smaller fish. The interior is not ornament around the subject, it is the subject's world compressed into its outline.",
      "Technically, digna is what keeps a large flat shape alive. Without it a big animal on a plain ground reads as a silhouette; with it, the eye keeps moving and the surface stays in tension.",
      "Watch how the pattern follows the form: strokes curve with the body, tighten at the joints, and rarely run across an edge without turning. That obedience to the shape is the difference between digna and a texture applied from outside.",
    ],
    lookFor: [
      "Interior marks that change direction to follow the body's contour.",
      "Content from the animal's own world inside the animal.",
      "Denser pattern near edges and joints, looser at the centre.",
    ],
    related: ["kala", "cow-dung-wall", "rice-paste"],
    source: { tradition: ["Gond, Madhya Pradesh"] },
  },
  {
    slug: "pulli",
    plate: "words",
    title: "Pulli",
    languages: ["Tamil"],
    gloss: "Dots — the grid a kolam is woven around.",
    definition:
      "The dot grid that determines where a kolam's line may go. Usually 5×5 or 7×7; the line is drawn around the dots without lifting the hand.",
    body: [
      "Pulli is the ruling, not the drawing. The painter sets the grid first, then draws a single closed curve that loops around every dot without crossing itself and without lifting. The dots are the constraint; the line is the solution.",
      "The mathematics is real. A kolam is a closed loop in the plane around a lattice, and small changes to the grid change what is possible — some grids admit many solutions, some admit few. This is why the form is used to teach symmetry and why it survives as a puzzle, not only as ritual.",
      "In the street version, the grid is laid in rice flour before sunrise, and the drawing is complete and imperfect by design: the line is swept away by the day.",
    ],
    lookFor: [
      "Dots still visible where the line has not covered them.",
      "One continuous curve: trace it with your eye and you should return to the start.",
      "Symmetry about both axes, and the same figure repeated at each doorway in a row.",
    ],
    related: ["kolam", "kacni", "rice-paste"],
    source: { tradition: ["Tamil Nadu"] },
  },
  {
    slug: "kolam",
    plate: "words",
    title: "Kolam",
    languages: ["Tamil"],
    gloss: "A threshold drawing made in rice flour before sunrise.",
    definition:
      "A drawing at the entrance of a house, laid daily in rice flour, feeding insects, greeting visitors, and marking ground that is tended.",
    body: [
      "Three functions, one act. The flour feeds ants and birds; the figure marks the boundary of a household and welcomes a guest; and the daily redrawing is a claim that someone lives here and keeps the place. Remove any one and the practice stops making sense.",
      "It is deliberately temporary. The drawing is not preserved, signed or sold. Its value is in repetition — a kolam that lasts a week would be a different object, closer to decoration than to observance.",
      "The dot grid and the loop line are shared with pulli. The best-known figures are geometric, but the everyday ones are often free: a lamp, a flower, a small bird.",
    ],
    lookFor: [
      "Rice flour, not chalk or paint — it is matte, and it is food.",
      "A figure that returns to its own start without lifting the hand.",
      "Wear at the edge, where the day has walked through it.",
    ],
    related: ["pulli", "rice-paste", "torana"],
    source: { tradition: ["Tamil Nadu", "Karnataka", "Kerala"] },
  },
  {
    slug: "tarpa",
    plate: "words",
    title: "Tarpa",
    languages: ["Warli", "Marathi"],
    gloss: "A spiral dance around a central pipe instrument.",
    definition:
      "The Warli dance in which performers circle a tarpa player, drawn in painting as a spiral of linked figures.",
    body: [
      "The painting does not depict the dance from the outside; it records the dance's own shape. Figures are drawn shoulder to shoulder in a chain that coils inward, ending in a single standing player at the centre. Seen flat, it is a spiral. Performed, it is a group moving together.",
      "This is the clearest case in the tradition of an image that is not a picture of something but a diagram of it. The spiral carries the choreography: you can read the direction of movement and the number of turns from the drawing.",
      "Warli composition generally works this way — rows of figures for work, circles for ceremony — so the spiral is not a stylistic flourish but the correct form for what is being recorded.",
    ],
    lookFor: [
      "Figures joined hand to hand, with no gap between them.",
      "A single figure at the centre, often taller or differently posed.",
      "The spiral tightening evenly, as a dance would.",
    ],
    related: ["digna", "cow-dung-wall", "rice-paste"],
    source: { tradition: ["Warli, Maharashtra"] },
  },
  {
    slug: "pattachitra-rasa",
    plate: "words",
    title: "Rasa",
    languages: ["Odia", "Sanskrit"],
    gloss: "The mood a painting is composed to carry.",
    definition:
      "Rasa is the emotional state a work is built to produce in the viewer. Composition is chosen to serve it, not the other way round.",
    body: [
      "The classical list runs to nine: love, laughter, sorrow, anger, heroism, fear, disgust, wonder, and peace. A painting is organised to deliver one of them, and the choices follow from that — the direction of the dominant lines, the density of pattern, the distribution of colour.",
      "Practically, this is what a good Pattachitra is doing that a decorative panel is not. A heroic scene is built on diagonals and wide stances. A tender one sits inside circles and soft intervals. Nothing is arbitrary; the geometry is the argument.",
      "For a buyer, rasa is the reason two paintings of the same size and subject can feel completely different in a room.",
    ],
    lookFor: [
      "One clear emotional reading at a distance, before any detail is legible.",
      "Diagonals for confrontation, circles and horizontals for calm.",
      "Colour temperature used to reinforce the mood rather than decorate.",
    ],
    related: ["pattachitra", "chitrakathi", "kala"],
    source: { tradition: ["Odisha"], period: "classical theory, applied c. 1700 onward" },
  },
  {
    slug: "chitrakathi",
    plate: "words",
    title: "Chitrakathi",
    languages: ["Marathi"],
    gloss: "Picture-story — a painted scroll shown while it is sung.",
    definition:
      "A performance form from Maharashtra where a painted panel is shown and narrated, image and voice together.",
    body: [
      "The object is not a painting that happens to have a story. It is one half of a performance: the performer unrolls a panel, sings the episode, and moves on. Without the narration the panels are inert; without the panels the narration loses its place.",
      "This is why chitrakathi figures are drawn for legibility in poor light and at a distance — heavy outline, flat colour, few characters per panel, each entrance clearly signalled.",
      "The same logic runs through patua scrolls in Bengal and phad in Rajasthan. Indian scroll painting is a service performed, not an object owned, and the composition is built for an audience that is watching a person, not studying a wall.",
    ],
    lookFor: [
      "Panels sized to be held in two hands.",
      "Few, large characters per panel, each instantly recognisable.",
      "Sequential panels whose order cannot be swapped.",
    ],
    related: ["pattachitra-rasa", "pattachitra", "tana-bana"],
    source: { tradition: ["Maharashtra"] },
  },
  {
    slug: "tana-bana",
    plate: "words",
    title: "Tana-bana",
    languages: ["Hindi", "Urdu"],
    gloss: "Warp and weft.",
    definition:
      "The two directions of a woven cloth, used as a metaphor for the structure of a story.",
    body: [
      "Tana is the warp, stretched before weaving begins; bana is the weft, passed through it. The warp decides the width and takes the tension; the weft is what shows on the surface and carries the pattern.",
      "The metaphor is exact and it is used constantly in Indian writing about both textiles and narrative: a story with a weak tana falls apart no matter how good the visible bana. Structure first, surface second.",
      "It is also a useful way to read a textile. Look for the warp count and you learn how much labour the cloth holds before any ornament was added.",
    ],
    lookFor: [
      "Warp threads in a finer, tighter yarn than the weft — the skeleton is the expensive part.",
      "Patterns that run in the weft direction only, following the shuttle.",
      "Selvedge tension that stays even from end to end.",
    ],
    related: ["jali", "ambi", "kala"],
    source: { tradition: ["pan-Indian"] },
  },
  {
    slug: "jali",
    plate: "words",
    title: "Jali",
    languages: ["Persian", "Hindi"],
    gloss: "A pierced screen.",
    definition:
      "A screen carved or cut so that light itself becomes the pattern; in painting, a field of punctuated texture.",
    body: [
      "In architecture, jali is a pierced stone or wood screen that shades, ventilates and hides — the light arriving through it is drawn on the floor in a moving lattice. In painting, the same idea is used for a field of texture: a ground of small openings rather than a flat colour.",
      "The painting version is a deliberate borrowing from the building. In Mughal and Rajput work, interiors are often closed off with a jali rather than a wall, so the space reads as screened rather than sealed.",
      "Because the motif is fundamentally a rhythm of holes, it is one of the few traditional patterns that reads correctly at any scale — a window, a border, or a ground behind a figure.",
    ],
    lookFor: [
      "A repeating unit with open space inside it, not a printed dot.",
      "Pattern continuing past the frame edge rather than stopping at it.",
      "Use as a field behind figures, to keep the background from going flat.",
    ],
    related: ["ambi", "tana-bana", "kalash"],
    source: { tradition: ["Mughal", "Rajput", "Rajasthan"] },
  },
  {
    slug: "ambi",
    plate: "words",
    title: "Ambi",
    languages: ["Gujarati", "Punjabi"],
    gloss: "The mango motif — 'paisley' in English.",
    definition:
      "A curved drop shape derived from the mango, one of the oldest continuously used motifs on the subcontinent.",
    body: [
      "The English name is a place, not a form. Paisley, in Scotland, wove shawls copying Kashmiri imports in the nineteenth century, and the town's name stuck to the shape. The motif travelled west and came back renamed.",
      "In Indian textiles it is ambi or kairi, and it is not merely decorative: the mango is auspicious, associated with fertility and with the start of summer. A shawl border of ambi is an argument about abundance, not a pattern choice.",
      "It survives because it is structurally forgiving — the curve flexes to fill a corner, a border, or a whole field, and reads correctly in embroidery, block print, weave and painting alike.",
    ],
    lookFor: [
      "A tip that curls decisively in one direction, not a symmetric leaf.",
      "Interior filling that differs by tradition — floral in Kashmiri, geometric in block print.",
      "Scale changes across a border, larger at the centre and smaller at the ends.",
    ],
    related: ["jali", "tana-bana", "kalash"],
    source: { tradition: ["Gujarat", "Punjab", "Kashmir"] },
  },
  {
    slug: "kalash",
    plate: "words",
    title: "Kalash",
    languages: ["Sanskrit"],
    gloss: "The auspicious pot, with mango leaves and a coconut.",
    definition:
      "A pot set at the start of a ritual, marking that something has been deliberately begun.",
    body: [
      "The kalash is a compound symbol: pot for the vessel, water for life, mango leaves for growth, coconut for the fruit that comes later. Placed at a threshold or a corner, it says this place has been consecrated rather than merely occupied.",
      "In painting, the kalash appears as a motif at entrances, in borders, and above doorways — and it functions the same way it does in a room: it marks a beginning. A panel with a kalash at its edge is telling you where to start reading.",
      "Its presence is also evidence of intent. An empty pot is furniture; a kalash with leaves and coconut is a decision.",
    ],
    lookFor: [
      "Leaves radiating from the mouth of the pot, always an odd number.",
      "A coconut sitting above the leaves, not inside the pot.",
      "Symmetry about the vertical axis, since the pot is a fixed reference.",
    ],
    related: ["torana", "ambi", "kolam"],
    source: { tradition: ["pan-Indian"] },
  },
  {
    slug: "torana",
    plate: "words",
    title: "Torana",
    languages: ["Sanskrit"],
    gloss: "A ceremonial gateway.",
    definition:
      "A decorated entrance structure — a whole composition, not a border.",
    body: [
      "A torana is architecture: two posts and a spanning element, carved or painted, hung with leaves and cloth for an occasion. Its purpose is to make crossing a deliberate act. You do not walk through a torana by accident.",
      "The common mistake is to treat torana motifs in painting as ornamental borders. They are not: when a painted panel shows a torana, it is showing a threshold, and the composition is divided by it into before and after.",
      "The same structure appears in temple gateways, in wedding pandals, in textile borders that behave like entrance frames. Wherever you find it, the reading is the same: this is a way in.",
    ],
    lookFor: [
      "Two supports and a spanning member, however stylised.",
      "A figure or scene entering through it, not standing beside it.",
      "Hanging elements — leaves, bells, cloth — that mark occasion rather than decoration.",
    ],
    related: ["kalash", "kolam", "jali"],
    source: { tradition: ["pan-Indian", "temple architecture"] },
  },
];
