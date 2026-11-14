"use client";

import { useLocale, useTranslations } from "next-intl";
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
  const t = useTranslations("currency");

  return (
    <label className="group relative inline-flex items-center">
      <span className="sr-only">{t("language")}</span>
      {/* A globe rather than nothing: two adjacent selects with only
          abbreviations in them were indistinguishable at a glance. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="pointer-events-none absolute left-2 h-3 w-3 text-terracotta/80"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      >
        <circle cx="8" cy="8" r="6.2" />
        <path d="M1.8 8h12.4M8 1.8c1.7 1.7 2.5 3.9 2.5 6.2S9.7 12.5 8 14.2C6.3 12.5 5.5 10.3 5.5 8S6.3 3.5 8 1.8z" />
      </svg>
      <select
        value={locale}
        onChange={(e) => {
          const next = e.target.value as Locale;
          // `usePathname` from next-intl strips the locale prefix, so replacing
          // it keeps the visitor on the same page instead of sending them home.
          router.replace(pathname, { locale: next });
        }}
        className="cursor-pointer appearance-none rounded-sm border border-sand-border/70 bg-transparent py-1 pl-6 pr-6 font-sans text-[11px] font-medium uppercase tracking-[0.12em] text-deep-ink/75 transition-colors hover:border-kumkum hover:text-kumkum focus:outline-none focus:ring-2 focus:ring-sindoor"
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
        className="pointer-events-none absolute right-1.5 h-1.5 w-2.5 text-deep-ink/45 transition-colors group-hover:text-kumkum"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      >
        <path d="M1 1l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}
