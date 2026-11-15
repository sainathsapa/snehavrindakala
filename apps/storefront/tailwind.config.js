/** @type {import('tailwindcss').Config} */
const configTailwind = require("@snehavrinda-kala/config-tailwind");

module.exports = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  // ── Design-system primitives ──────────────────────────────────────────
  // `.btn-primary`, `.btn-outline`, `.btn-link`, `.section`, `.section-tight`
  // and `.shell` are declared in app/globals.css under @layer components.
  // Tailwind removes component classes that no template references, so a
  // primitive only starts shipping the first time a page uses it. Safelisting
  // them means the layer is available to every page immediately and a screen
  // can be converted without a missing-style regression in the interim.
  safelist: [
    "btn-primary",
    "btn-outline",
    "btn-link",
    "section",
    "section-tight",
    "shell",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // Brand palette from config-tailwind (build plan Section 4.2)
      colors: {
        ...configTailwind.theme.extend.colors,
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        serif: ["var(--font-serif)"],
        sans: ["var(--font-sans)"],
        devanagari: ["var(--font-devanagari)"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { transform: "translateY(6px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.6s ease-out both",
        "slide-up": "slide-up 0.5s ease-out both",
      },
      // ── Editorial type scale ────────────────────────────────────────────
      // Pages were reaching for arbitrary values (`text-[42px]`, `text-[28px]`)
      // and landing on slightly different sizes for the same rank of heading.
      // These six steps name the sizes the site already uses most, so a section
      // heading is the same everywhere and can be changed in one place.
      //
      // Sizes are deliberately kept as the existing rendered values: this is a
      // naming pass, not a resizing one.
      fontSize: {
        display: ["76px", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        h1: ["48px", { lineHeight: "1.1", letterSpacing: "-0.01em" }],
        h2: ["42px", { lineHeight: "1.15", letterSpacing: "-0.01em" }],
        h3: ["28px", { lineHeight: "1.25" }],
        lead: ["18px", { lineHeight: "1.7" }],
        body: ["15px", { lineHeight: "1.75" }],
        caption: ["10px", { lineHeight: "1.4", letterSpacing: "0.24em" }],
      },
    },
  },
  plugins: [],
};
