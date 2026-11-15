/**
 * SEO-friendly slug utilities for the SnehaVrinda Kala storefront.
 *
 * Maps human-readable art-form names to clean URL slugs and back, so the
 * shop can use `/shop/folk` instead of `/shop?q=Folk`.
 */

export interface ArtFormSlug {
  slug: string;
  name: string;
  description: string;
  query: string; // Medusa search query / category filter
  /**
   * One line of place, in the shape docs/design-system.md gives for a museum
   * label: "<region>, <state>". Only set where the storefront's own published
   * writing states it (see the note on each tradition below); absent otherwise,
   * because a guessed origin is a false claim about a tradition.
   */
  origin?: string;
}

export const artFormSlugs: ArtFormSlug[] = [
  {
    slug: "painting",
    name: "Painting & Drawing",
    description:
      "Original paintings, sketches, portraits, prints, and illustration across mediums.",
    query: "Painting",
  },
  {
    slug: "folk",
    name: "Traditional & Folk Art",
    description:
      "Region- and technique-led work with careful cultural attribution and provenance.",
    query: "Folk",
  },
  {
    slug: "home-decor",
    name: "Home & Decorative Art",
    description:
      "Wall décor, sculpture, ceramics, lamps, and decorative objects for the home.",
    query: "Home & Decorative",
  },
  {
    slug: "textile",
    name: "Textile & Fibre Art",
    description:
      "Embroidery, weaving, crochet, macramé, and textile décor in natural fibres.",
    query: "Textile",
  },
  {
    slug: "paper",
    name: "Paper, Stationery & Books",
    description:
      "Paper art, handmade cards, journals, calligraphy, and creative stationery.",
    query: "Paper",
  },
  {
    slug: "wearable",
    name: "Wearable Art",
    description:
      "Art jewellery, accessories, painted apparel, and wearable craft pieces.",
    query: "Wearable",
  },

  // ── Individual traditions ───────────────────────────────────────────────
  //
  // The six entries above are *categories* — useful for browsing, but four of
  // them mix several traditions under one heading, so none of them can carry a
  // single honest origin. These five are real traditions with a place, added
  // alongside rather than replacing the categories, so studio work that belongs
  // to no tradition still has somewhere to live.
  //
  // Each origin below is taken from this storefront's own published essay on
  // that tradition, not from outside knowledge:
  //   madhubani   — "the women of Mithila"            (why-madhubani-lines-never-waver)
  //   warli       — "Thane and Palghar districts of Maharashtra" (warli-has-no-gods-in-it)
  //   pattachitra — "a traditional Puri Pattachitra"   (how-to-read-a-pattachitra)
  //   gond        — "Madhya Pradesh, Chhattisgarh, Maharashtra and Odisha"
  //                                                    (the-gond-eye-and-why-the-world-is-full)
  //   kalamkari   — Srikalahasti and Machilipatnam, the two styles that essay
  //                 names (what-a-kalamkari-actually-goes-through)
  //
  // Only Madhubani and Warli name a state outright. Pattachitra's essay says
  // "Puri"; Gond spans four states; Kalamkari's essay names towns rather than a
  // state. Those are recorded exactly as the writing has them.
  {
    slug: "madhubani",
    name: "Madhubani",
    description:
      "Mithila painting from Bihar, built on a doubled outline and flat colour.",
    query: "Madhubani",
    origin: "Mithila, Bihar",
  },
  {
    slug: "warli",
    name: "Warli",
    description:
      "White rice-paste figures on a mud ground, from the Warli community.",
    query: "Warli",
    origin: "Thane and Palghar, Maharashtra",
  },
  {
    slug: "pattachitra",
    name: "Pattachitra",
    description:
      "Cloth treated with tamarind seed and chalk, outlined before it is filled.",
    query: "Pattachitra",
    origin: "Puri, Odisha",
  },
  {
    slug: "gond",
    name: "Gond",
    description:
      "Gond painting, where the whole ground is filled and nothing is left empty.",
    query: "Gond",
    origin: "Madhya Pradesh, Chhattisgarh, Maharashtra and Odisha",
  },
  {
    slug: "kalamkari",
    name: "Kalamkari",
    description:
      "Drawn with a bamboo pen and dyed in myrobalan and madder, washed many times.",
    query: "Kalamkari",
    origin: "Srikalahasti and Machilipatnam, Andhra Pradesh",
  },
];

export function getArtFormBySlug(slug: string): ArtFormSlug | undefined {
  return artFormSlugs.find((f) => f.slug === slug);
}

export function getArtFormByQuery(query: string): ArtFormSlug | undefined {
  return artFormSlugs.find((f) => f.query.toLowerCase() === query.toLowerCase());
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
