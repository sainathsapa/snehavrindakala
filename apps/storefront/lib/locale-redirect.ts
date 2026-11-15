import { redirect as nextRedirect } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";

/**
 * `redirect()` that keeps the visitor in the language they were reading.
 *
 * Next's own `redirect()` takes a raw path and emits it verbatim. On a site
 * whose Hindi pages live under `/hi`, that meant a Hindi shopper who signed in
 * was sent to `/account` — a valid page, but an English one — and the sign-in
 * form, already in Hindi, then pointed at an English account screen with English
 * errors. Worse, a failed login silently changed the language the visitor had
 * chosen, which reads as the site forgetting them.
 *
 * Two details matter here:
 *
 * 1. It is deliberately **synchronous** and returns `never`. An `async` version
 *    had to be awaited, and awaiting it stopped TypeScript narrowing control
 *    flow — so `if (!token) redirect(...)` no longer proved `token` was defined
 *    afterwards, and every caller after an auth guard started reporting
 *    "used before being assigned".
 * 2. The locale arrives as an argument rather than being resolved here. Server
 *    actions already have `getLocale()` available, but making it a parameter
 *    means this helper stays a plain function that can be unit-tested and used
 *    from anywhere, including places where the request config is not loaded.
 *
 *   redirect("/account", locale)   ->  /hi/account   on the Hindi site
 *                                  ->  /account      in English
 */
export function localeRedirect(path: string, locale: Locale | string): never {
  const [pathname, hash] = path.split("#");

  // English is the default and lives on bare URLs; prefixing it would create a
  // second, duplicate URL for every page.
  if (!locale || locale === routing.defaultLocale) {
    nextRedirect(path);
  }

  const [base, query] = pathname.split("?");
  const prefix = `/${locale}${base === "/" ? "" : base}`;
  const target = query ? `${prefix}?${query}` : prefix;
  nextRedirect(hash ? `${target}#${hash}` : target);
}
