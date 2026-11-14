"use client";

import { useLocale } from "next-intl";
import {
  LOCALE_LABELS,
  routing,
  usePathname,
  useRouter,
  type Locale,
} from "@/i18n/routing";
/**
 * Language switcher.
 *
 * Sits beside the currency switcher because they are the same kind of choice —
 * how this visitor wants the shop to speak to them. Switching navigates rather
 * than setting a cookie: each language has its own URL, so the page a visitor
 * lands on is the page Google can index and the one they can share.
 *
 * The label is the language's own name (हिन्दी, not "Hindi"), which is how
 * people find their own language in a list.
 */
export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Language</span>
      <select
        value={locale}
        onChange={(e) => {
          const next = e.target.value as Locale;
          // `usePathname` from next-intl strips the locale prefix, so replacing
          // it keeps the visitor on the same page instead of sending them home.
          router.replace(pathname, { locale: next });
        }}
        className="cursor-pointer appearance-none rounded-sm border border-sand-border/70 bg-transparent py-1 pl-2 pr-6 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-deep-ink/75 transition-colors hover:border-kumkum hover:text-kumkum focus:outline-none focus:ring-2 focus:ring-sindoor"
      >
        {routing.locales.map((code) => (
          <option key={code} value={code}>
            {LOCALE_LABELS[code]}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 10 6"
        className="pointer-events-none absolute right-1.5 h-1.5 w-2.5 text-deep-ink/45"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      >
        <path d="M1 1l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}
