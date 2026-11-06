/**
 * SnehaVrinda Kala — shared Tailwind design tokens.
 *
 * Visual concept: "The Living Indian Art House" (build plan Section 4.1).
 * A warm paper base with vivid Indian pigment accents, editorial typography,
 * and restrained craft-inspired texture. Colours are applied through
 * purposeful section backgrounds, art-form tiles, editorial bands, buttons,
 * labels and footer treatments — never as generic minimal SaaS chrome.
 *
 * Core brand palette (build plan Section 4.2):
 *   rang-paper #FFF7E8   warm primary canvas (handmade paper)
 *   marigold   #E6A72E   optimistic highlight / campaign band
 *   sindoor    #C84636   primary action / emphasis
 *   kumkum     #9F2947   deep rose/wine editorial accent
 *   peacock    #176D6A   teal trust/availability accent
 *   indigo     #263A63   deep blue section / footer
 *   leaf       #557447   nature/green craft accent
 *   haldi      #F0C45B   bright warm yellow feature blocks
 *   gulabi     #D98291   rose-pink decorative accent
 *   terracotta #B96E4B   earthy craft material accent
 *   deep-ink   #2B211E   main text on light
 *   muted-ink  #675A52   supporting text
 *   sand-border #DCCBB4  borders/dividers
 *   surface    #FFFCF5   product/form surfaces
 */
module.exports = {
  theme: {
    extend: {
      colors: {
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
