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
  // Surfaces
  "rang-paper": "#FFF7E8",
  surface: "#FFFCF5",
  // Text
  "deep-ink": "#2B211E",
  "muted-ink": "#675A52",
  // Borders
  "sand-border": "#DCCBB4",
  // Brand accents
  marigold: "#E6A72E",
  sindoor: "#C84636",
  kumkum: "#9F2947",
  peacock: "#176D6A",
  indigo: "#263A63",
  leaf: "#557447",
  haldi: "#F0C45B",
  gulabi: "#D98291",
  terracotta: "#B96E4B",
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
  // Primary action colour (sindoor) on light surfaces
  primary: "sindoor",
  primaryForeground: "white",
  // Warm paper canvas
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
