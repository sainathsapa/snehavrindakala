import type { Metadata } from "next";
import { routing } from "@/i18n/routing";

/**
 * Alternates for one page: a self-referencing canonical plus an hreflang entry
 * for every locale.
 *
 * Next replaces `alternates` wholesale rather than merging, so a page that sets
 * only `canonical` silently drops the layout's `languages`. That is how the
 * shop page ended up with no hreflang at all despite the layout declaring it —
 * and without hreflang Google treats `/hi/shop` as an unrelated duplicate and
 * may index only one of the two.
 *
 * `path` is the locale-independent path, e.g. `/shop`. Pass `locale` whenever
 * the page knows it: a Hindi page must canonicalise to `/hi/...`, never to the
 * English URL, or it is treated as a duplicate of the English page and dropped
 * from the index. The optional argument keeps older callers (which only want
 * the hreflang map) unchanged.
 */
export function localeAlternates(
  path: string,
  locale?: string
): Metadata["alternates"] {
  const normalised = path === "/" ? "" : path.replace(/\/$/, "");

  const languages: Record<string, string> = {};
  for (const code of routing.locales) {
    // English lives on the bare URL; every other locale is prefixed.
    languages[code] =
      code === routing.defaultLocale ? normalised || "/" : `/${code}${normalised}`;
  }
  // x-default tells Google which version to serve when no language matches.
  languages["x-default"] = normalised || "/";

  return {
    canonical: locale ? canonicalFor(path, locale) : normalised || "/",
    languages,
  };
}

/**
 * The same path in the active language, for canonical tags on a translated page.
 *
 * A Hindi page must point its canonical at itself, not at the English one —
 * otherwise it is treated as a duplicate and dropped from the index, which
 * defeats the point of having Hindi URLs.
 */
export function canonicalFor(path: string, locale: string): string {
  const normalised = path === "/" ? "" : path.replace(/\/$/, "");
  return locale === routing.defaultLocale
    ? normalised || "/"
    : `/${locale}${normalised}`;
}
