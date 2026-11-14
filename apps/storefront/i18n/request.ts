import { getRequestConfig } from "next-intl/server";
import { routing, type Locale } from "./routing";

/**
 * Where a request's messages come from.
 *
 * Messages are imported statically rather than read from disk so the bundler
 * can tree-shake and the files ship inside the standalone build — the container
 * has no `messages/` directory to find at runtime, and a dynamic read would
 * fail there while working perfectly in dev.
 *
 * If a locale's file is missing or throws, we fall back to English instead of
 * surfacing a 500. A visitor seeing the site in the wrong language is a far
 * smaller failure than a visitor seeing nothing.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  let locale = (await requestLocale) as Locale | undefined;
  if (!locale || !routing.locales.includes(locale)) {
    locale = routing.defaultLocale;
  }

  let messages: Record<string, unknown>;
  try {
    messages =
      locale === "hi"
        ? (await import("../messages/hi.json")).default
        : (await import("../messages/en.json")).default;
  } catch {
    messages = (await import("../messages/en.json")).default;
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages,
    timeZone: "Asia/Kolkata",
  };
});
