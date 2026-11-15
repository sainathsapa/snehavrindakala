import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

/**
 * The root layout owns `<html>` and `<body>`.
 *
 * Next requires exactly one root layout, and it must render the html element —
 * so it lives here, above `app/[locale]`. The locale is not available as a
 * route param at this level, so it is read from the header the locale
 * middleware sets. That keeps `<html lang>` accurate for screen readers and
 * search engines instead of being hardcoded to English on Hindi pages.
 *
 * `dir` is derived the same way so a future right-to-left language does not
 * need this file touched again.
 */
const SITE_URL = (
  process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000"
).replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
};

/** Languages written right-to-left. */
const RTL_LOCALES = new Set(["ar", "he", "fa", "ur"]);

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = (await headers()).get("x-locale") || "en";
  const dir = RTL_LOCALES.has(locale) ? "rtl" : "ltr";
  // Hindi gets the Devanagari stack on the body. The token itself lists Manrope
  // as its first Latin fallback, so English words embedded in Hindi copy (brand
  // names, "Madhubani") still set in the Latin face instead of jumping to a
  // system font. English pages are untouched: `font-sans` stays as it was.
  const bodyFont = locale === "hi" ? "font-devanagari" : "font-sans";

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className={`${bodyFont} antialiased`}>{children}</body>
    </html>
  );
}
