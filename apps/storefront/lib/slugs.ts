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
