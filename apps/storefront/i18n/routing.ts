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
 */
export const routing = defineRouting({
  locales: ["en", "hi"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);

/** How each language names itself, for the switcher. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  hi: "हिन्दी",
};
