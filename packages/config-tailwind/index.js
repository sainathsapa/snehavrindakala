/**
 * Shared Tailwind design tokens for SnehaVrinda Kala.
 *
 * Visual concept: contemporary Indian art gallery meets warm craft studio.
 * Let artwork supply most of the colour; interface colours provide structure,
 * hierarchy, and recognition. Motifs (jaali, block print, lotus, rangoli) are
 * used as quiet texture, never as decoration that competes with artwork.
 */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Surfaces
        ivory: "#F4EFE6",
        paper: "#F7F2E8",
        surface: "#FFFDF8",
        border: "#D8CCB8",

        // Text
        ink: "#221F1A",
        muted: "#6B6258",

        // Brand accents
        madder: "#A63D2F",     // primary brand accent
        indigo: "#1F2A44",     // secondary accent / selected states
        haldi: "#D9A441",      // small highlights only
        peacock: "#1E6F6A",    // supportive natural accent
        rose: "#9C3F63",       // festive / occasion accent
        sage: "#6F7F5B",       // calm supporting accent
        gold: "#B8860B",       // ceremonial highlight

        // Compatibility aliases for existing storefront classes
        terracotta: "#A63D2F",
        saffron: "#D9A441",
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
        serif: ["Cormorant Garamond", "serif"],
        sans: ["Manrope", "sans-serif"],
        devanagari: ["Tiro Devanagari Hindi", "serif"],
      },
      borderRadius: {
        sm: "0.375rem",
        md: "0.625rem",
        lg: "0.875rem",
        xl: "1.25rem",
      },
      boxShadow: {
        soft: "0 10px 30px rgba(34, 31, 26, 0.08)",
        lifted: "0 18px 45px rgba(34, 31, 26, 0.12)",
      },
      backgroundImage: {
        "jaali":
          "radial-gradient(circle at 1px 1px, rgba(31,42,68,0.08) 1px, transparent 0)",
        "blockprint":
          "repeating-linear-gradient(45deg, rgba(166,61,47,0.05) 0 2px, transparent 2px 14px)",
      },
    },
  },
  plugins: [],
};
