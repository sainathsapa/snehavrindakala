/**
 * SnehaVrinda Kala — shared Tailwind design tokens.
 *
 * Visual concept: "The Living Indian Art House" (build plan Section 4.1).
 * A warm paper base with vivid Indian pigment accents, editorial typography,
 * and restrained craft-inspired texture. Colours are applied through
 * purposeful section backgrounds, art-form tiles, editorial bands, buttons,
 * labels and footer treatments — never as generic minimal SaaS chrome.
 *
 * Core brand palette — matched to the brand design references
 * (see docs/design-system.md):
 *   rang-paper #F8EBDD   parchment canvas
 *   surface    #FFF7EC   ivory card/form surface
 *   deep-ink   #42170F   main text on light (deep brown)
 *   muted-ink  #6B5347   supporting text
 *   sand-border #E2CFB6  borders/dividers
 *   kumkum     #7B1019   primary action (burgundy)
 *   sindoor    #8F201D   emphasis / danger
 *   terracotta #B74620   earthy craft accent, links
 *   marigold   #E6A72E   optimistic highlight
 *   haldi      #F0C45B   warm feature blocks
 *   peacock    #176D6A   teal trust/availability
 *   indigo     #263A63   deep blue section / footer
 *   leaf       #557447   nature/green craft accent
 *   gulabi     #D98291   rose decorative accent
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Surfaces
        "rang-paper": "#F8EBDD",
        surface: "#FFF7EC",

        // Text
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
      },
      spacing: {
        0: "0px",
        1: "4px",
        2: "8px",
        3: "12px",
        4: "16px",
        5: "20px",
        6: "24px",
        8: "32px",
        10: "40px",
        12: "48px",
        16: "64px",
        20: "80px",
        24: "96px",
      },
      fontFamily: {
        // Display/editorial headings
        serif: ["Cormorant Garamond", "ui-serif", "Georgia", "serif"],
        // Body/UI
        sans: ["Manrope", "ui-sans-serif", "system-ui", "sans-serif"],
        // Regional scripts (Devanagari only after language review)
        devanagari: ["Noto Sans Devanagari", "ui-sans-serif", "sans-serif"],
      },
      fontSize: {
        // Editorial type scale (build plan Section 4.3)
        "display-xl": ["3.75rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "display-lg": ["3rem", { lineHeight: "1.15", letterSpacing: "-0.01em" }],
        "display-md": ["2.25rem", { lineHeight: "1.2" }],
        "display-sm": ["1.75rem", { lineHeight: "1.25" }],
        h1: ["2rem", { lineHeight: "1.25" }],
        h2: ["1.75rem", { lineHeight: "1.3" }],
        h3: ["1.5rem", { lineHeight: "1.35" }],
        body: ["1rem", { lineHeight: "1.6" }],
        small: ["0.875rem", { lineHeight: "1.5" }],
        caption: ["0.75rem", { lineHeight: "1.4" }],
      },
      borderRadius: {
        sm: "0.375rem",
        md: "0.625rem",
        lg: "0.875rem",
        xl: "1.25rem",
        full: "9999px",
      },
      boxShadow: {
        soft: "0 10px 30px rgba(43, 33, 30, 0.08)",
        lifted: "0 18px 45px rgba(43, 33, 30, 0.12)",
        none: "none",
      },
      backgroundImage: {
        "jaali":
          "radial-gradient(circle at 1px 1px, rgba(38,58,99,0.08) 1px, transparent 0)",
        "blockprint":
          "repeating-linear-gradient(45deg, rgba(200,70,54,0.06) 0 2px, transparent 2px 14px)",
        "rangoli": "radial-gradient(rgba(159,41,71,0.10) 0%, transparent 70%)",
      },
    },
  },
  plugins: [],
};
