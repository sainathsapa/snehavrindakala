/**
 * Starter catalogue used by `bootstrap-store.mjs`.
 *
 * Photographs ship with the storefront in `public/images/products`, so a fresh
 * install looks like the real shop instead of a wall of grey placeholders.
 *
 * Prices are in rupees; Medusa stores minor units, so they are multiplied by 100
 * on the way out (`inr()`).
 *
 * `stock` becomes the `stock:...` tag the storefront reads for the availability
 * pill and the dispatch copy:
 *   ready_to_ship  — in the studio, dispatches in days
 *   made_to_order  — made for the order, weeks
 *   custom_only    — quoted per commission
 */

export const CATEGORIES = [
  ["Painting & Drawing", "painting-drawing"],
  ["Traditional & Folk Art", "traditional-folk-art"],
  ["Home & Decorative Art", "home-decorative-art"],
  ["Textile & Fibre Art", "textile-fibre-art"],
  ["Paper, Stationery & Books", "paper-stationery-books"],
  ["Wearable Art", "wearable-art"],
  ["Commissions", "commissions"],
];

export const inr = (rupees) => Math.round(rupees * 100);

export const PRODUCTS = [
  {
    title: "Hand-painted Terracotta Vase",
    handle: "hand-painted-terracotta-vase",
    category: "home-decorative-art",
    price: 2200,
    image: "/images/products/terracotta-vase.jpg",
    medium: "Terracotta, natural pigment",
    tradition: "Folk",
    dimensions: "22 cm × 14 cm",
    stock: "ready_to_ship",
    description:
      "A hand-thrown terracotta vase painted with folk motifs in natural pigment. Made one at a time, so no two are identical.",
  },
  {
    title: "Madhubani Fish & Lotus",
    handle: "madhubani-folk-painting",
    category: "traditional-folk-art",
    price: 8500,
    image: "/images/products/madhubani-painting.jpg",
    medium: "Natural pigment on handmade paper",
    tradition: "Madhubani",
    dimensions: "45 cm × 30 cm",
    stock: "ready_to_ship",
    description:
      "Fish and lotus in the Mithila manner, outlined in double lines and filled with hand-ground pigment. Fish stand for fertility and abundance; the lotus for unfolding.",
  },
  {
    title: "Embroidered Cotton Throw",
    handle: "embroidered-cotton-throw",
    category: "textile-fibre-art",
    price: 3400,
    image: "/images/products/cotton-throw.jpg",
    medium: "Handloom cotton, cotton thread",
    tradition: "Phulkari",
    dimensions: "180 cm × 130 cm",
    stock: "ready_to_ship",
    description:
      "A handloom cotton throw finished with a phulkari-inspired embroidered border. Warm enough for a winter evening, light enough to leave out all year.",
  },
  {
    title: "Pattachitra Scroll Panel",
    handle: "pattachitra-scroll-panel",
    category: "traditional-folk-art",
    price: 7200,
    image: "/images/products/generated-pattachitra-scroll-panel.jpg",
    medium: "Natural pigment on cloth",
    tradition: "Pattachitra",
    dimensions: "60 cm × 35 cm",
    stock: "made_to_order",
    description:
      "A scroll panel painted in the Odisha tradition: cloth prepared with chalk and gum, then painted in mineral colour and outlined in fine black line.",
  },
  {
    title: "Silver Filigree Earrings",
    handle: "silver-filigree-earrings",
    category: "wearable-art",
    price: 4200,
    image: "/images/products/generated-silver-filigree-earrings.jpg",
    medium: "Sterling silver",
    tradition: "Filigree",
    dimensions: "4 cm drop",
    stock: "ready_to_ship",
    description:
      "Hand-drawn silver wire, twisted and soldered into a lattice fine enough to see daylight through. Light on the ear despite the spread.",
  },
  {
    title: "Gond Tree of Life",
    handle: "gond-tree-of-life",
    category: "painting-drawing",
    price: 9800,
    image: "/images/products/generated-gond-tree-of-life.jpg",
    medium: "Acrylic on canvas",
    tradition: "Gond",
    dimensions: "60 cm × 60 cm",
    stock: "made_to_order",
    description:
      "A single tree crowded with birds, animals and people, painted in the Gond manner where every living thing shares one root system.",
  },
  {
    title: "Warli Harvest Painting",
    handle: "warli-harvest-painting",
    category: "painting-drawing",
    price: 6400,
    image: "/images/products/generated-warli-harvest-painting.jpg",
    medium: "Rice paste on cloth",
    tradition: "Warli",
    dimensions: "55 cm × 40 cm",
    stock: "ready_to_ship",
    description:
      "Figures drawn in rice paste on a mud-brown ground, arranged in the spirals and circles of a Warli harvest.",
  },
  {
    title: "Madhubani Celebration",
    handle: "madhubani-celebration",
    category: "traditional-folk-art",
    price: 7600,
    image: "/images/products/generated-madhubani-celebration.jpg",
    medium: "Natural pigment on handmade paper",
    tradition: "Madhubani",
    dimensions: "50 cm × 35 cm",
    stock: "ready_to_ship",
    description:
      "A dense field of birds, flowers and ritual forms in five natural colours, worked edge to edge as Mithila painting does not leave empty space.",
  },
  {
    title: "Kalamkari Penwork Panel",
    handle: "kalamkari-penwork-panel",
    category: "textile-fibre-art",
    price: 6900,
    image: "/images/products/generated-kalamkari-penwork-panel.jpg",
    medium: "Natural dye on cotton",
    tradition: "Kalamkari",
    dimensions: "70 cm × 45 cm",
    stock: "made_to_order",
    description:
      "Drawn with a bamboo pen and dyed in myrobalan and madder, then washed in running water — the process that gives Kalamkari its soft, sun-faded depth.",
  },
  {
    title: "Gold Leaf Miniature Portrait",
    handle: "gold-leaf-miniature-portrait",
    category: "painting-drawing",
    price: 12500,
    image: "/images/products/generated-gold-leaf-miniature-portrait.jpg",
    medium: "Gouache and gold leaf on wasli",
    tradition: "Miniature",
    dimensions: "18 cm × 13 cm",
    stock: "made_to_order",
    description:
      "A portrait in the miniature tradition, built up in thin gouache layers over wasli paper and finished with burnished gold leaf.",
  },
  {
    title: "Hand-marbled Paper Journal",
    handle: "hand-marbled-paper-journal",
    category: "paper-stationery-books",
    price: 1200,
    image: "/images/products/generated-hand-marbled-paper-journal.jpg",
    medium: "Marbled paper, cotton rag",
    tradition: "Marbling",
    dimensions: "A5, 120 pages",
    stock: "ready_to_ship",
    description:
      "Marbled by hand in a size bath, so every cover is a one-off. Cotton rag pages, sewn flat so it opens without a fight.",
  },
  {
    title: "Hand-thrown Stoneware Bowl",
    handle: "hand-thrown-stoneware-bowl",
    category: "home-decorative-art",
    price: 1800,
    image: "/images/products/generated-hand-thrown-stoneware-bowl.jpg",
    medium: "Stoneware, ash glaze",
    tradition: "Studio pottery",
    dimensions: "16 cm × 7 cm",
    stock: "ready_to_ship",
    description:
      "Wheel-thrown stoneware with an ash glaze that pools where the form curves. Food safe, dishwasher safe, and happy in a low oven.",
  },
  {
    title: "Hand-woven Ikat Stole",
    handle: "hand-woven-ikat-stole",
    category: "textile-fibre-art",
    price: 3900,
    image: "/images/products/generated-hand-woven-ikat-stole.jpg",
    medium: "Mulberry silk, natural dye",
    tradition: "Ikat",
    dimensions: "200 cm × 70 cm",
    stock: "ready_to_ship",
    description:
      "The pattern is dyed into the threads before a single weft passes, which is why the edges of every motif breathe slightly. Woven in silk.",
  },
  {
    title: "Block-printed Table Runner",
    handle: "block-printed-table-runner",
    category: "home-decorative-art",
    price: 1500,
    image: "/images/products/generated-block-printed-table-runner.jpg",
    medium: "Cotton, vegetable dye",
    tradition: "Block printing",
    dimensions: "180 cm × 33 cm",
    stock: "ready_to_ship",
    description:
      "Printed with hand-carved teak blocks and vegetable dye, so repeat motifs drift by a millimetre or two — the signature of a human hand rather than a screen.",
  },
  {
    title: "Phulkari Embroidered Dupatta",
    handle: "phulkari-embroidered-dupatta",
    category: "textile-fibre-art",
    price: 5200,
    image: "/images/products/generated-phulkari-embroidered-dupatta.jpg",
    medium: "Khaddar cotton, silk floss",
    tradition: "Phulkari",
    dimensions: "220 cm × 90 cm",
    stock: "made_to_order",
    description:
      "Darn-stitched in silk floss from the back of the cloth, so the front carries the shine and the reverse carries the knots. Takes six weeks of evening work.",
  },
  {
    title: "Bidriware Silver Inlay Box",
    handle: "bidriware-silver-inlay-box",
    category: "home-decorative-art",
    price: 4800,
    image: "/images/products/generated-bidriware-silver-inlay-box.jpg",
    medium: "Blackened alloy, silver inlay",
    tradition: "Bidriware",
    dimensions: "12 cm × 8 cm",
    stock: "made_to_order",
    description:
      "Silver hammered into an engraved black ground, then soiled and oxidised so the alloy goes deep black and the inlay stays bright.",
  },
  {
    title: "Lacquer Wooden Pen Case",
    handle: "lacquer-wooden-pen-case",
    category: "paper-stationery-books",
    price: 950,
    image: "/images/products/generated-lacquer-wooden-pen-case.jpg",
    medium: "Seasoned wood, natural lacquer",
    tradition: "Lacquerware",
    dimensions: "17 cm × 5 cm",
    stock: "ready_to_ship",
    description:
      "Turned on a hand lathe and finished with coloured lacquer while the wood still spins, so the bands sit in the grain.",
  },
  {
    title: "Art Pendant",
    handle: "art-pendant",
    category: "wearable-art",
    price: 1600,
    image: "/images/products/art-pendant.jpg",
    medium: "Brass, enamel",
    tradition: "Studio",
    dimensions: "3 cm",
    stock: "ready_to_ship",
    description:
      "A small hand-enamelled pendant on a brass chain — a fragment of colour to wear every day.",
  },
  {
    title: "Custom Portrait Commission",
    handle: "custom-portrait-commission",
    category: "commissions",
    price: 15000,
    image: "/images/products/generated-custom-portrait-commission.jpg",
    medium: "Gouache on paper",
    tradition: "Miniature",
    dimensions: "Commissioned to size",
    stock: "custom_only",
    sizes: ["A4 portrait", "A3 portrait"],
    description:
      "A portrait painted to your brief: share the subject and the setting, receive a sketch to approve, then a finished painting. Starts with a conversation.",
  },
];
