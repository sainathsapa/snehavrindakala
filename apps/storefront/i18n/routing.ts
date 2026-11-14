import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

/**
 * Which languages the storefront speaks.
 *
 * Two, deliberately. Hindi is the language most of this country reads, and
 * adding German or Arabic before those strings have been reviewed by a native
 * speaker would produce a site that is translated rather than legible. The
 * array is the single source of truth: adding a language means adding a
 * messages file and one entry here.
 *
 * `localePrefix: "as-needed"` keeps English on bare URLs (`/shop`) and puts
 * Hindi behind a prefix (`/hi/shop`). That preserves every existing link and
 * the search ranking English has already earned, instead of moving the whole
 * site to `/en/...` for no benefit.
 *
 * `localeDetection: false` is essential here, not a style choice. With
 * detection on, next-intl reads the Accept-Language header and the NEXT_LOCALE
 * cookie and redirects bare URLs to the detected language — so a visitor who
 * ever opened /hi could never reach the English site again, because /shop
 * silently became /hi/shop for them. The URL is now the only thing that
 * decides the language, which is also what hreflang and the canonical tags
 * promise search engines.
 */
export const routing = defineRouting({
  locales: ["en", "hi"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);

/** How each language names itself, for the switcher. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  hi: "हिन्दी",
};
