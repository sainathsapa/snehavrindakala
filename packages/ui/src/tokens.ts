/**
 * SnehaVrinda Kala — brand design tokens.
 *
 * Single source of truth for the brand palette (build plan Section 4.2) and
 * typography (Section 4.3). Consumed by packages/ui components and the
 * storefront Tailwind config.
 *
 * Values match config-tailwind exactly so Tailwind utility classes and JS
 * token references stay in sync.
 */

export const brandColors = {
  // Surfaces — parchment and ivory, per the brand design references
  "rang-paper": "#F8EBDD",
  surface: "#FFF7EC",
  // Text — deep brown ink, not neutral grey
  "deep-ink": "#42170F",
  "muted-ink": "#6B5347",
  // Borders
  "sand-border": "#E2CFB6",
  // Brand accents
  marigold: "#E6A72E",
  sindoor: "#8F201D",
  kumkum: "#7B1019",
  peacock: "#176D6A",
  indigo: "#263A63",
  leaf: "#557447",
  haldi: "#F0C45B",
  gulabi: "#D98291",
  terracotta: "#B74620",
} as const;

export type BrandColor = keyof typeof brandColors;

/**
 * Tailwind utility class for a brand color background.
 */
export function bg(color: BrandColor): string {
  return `bg-${color}`;
}

/**
 * Tailwind utility class for a brand color text.
 */
export function text(color: BrandColor): string {
  return `text-${color}`;
}

/**
 * Tailwind utility class for a brand color border.
 */
export function border(color: BrandColor): string {
  return `border-${color}`;
}

export const brand = {
  // Primary action colour (burgundy) on light surfaces
  primary: "kumkum",
  primaryForeground: "rang-paper",
  // Parchment canvas
  background: "rang-paper",
  backgroundForeground: "deep-ink",
  // Card/product surface
  card: "surface",
  cardForeground: "deep-ink",
  // Muted supporting text
  muted: "muted-ink",
  // Borders/dividers
  border: "sand-border",
  // Trust/availability accent
  accent: "peacock",
} as const;
