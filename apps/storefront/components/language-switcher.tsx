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
 *
 * `tone` exists because the shop puts these on two different grounds: the
 * parchment body and the dark footer. The original styling hard-coded deep-ink
 * text, which was invisible on the footer — dark ink on a #2A120C ground. The
 * options also carry explicit colours: a native dropdown paints its own white
 * popup, so a light inherited colour would leave the choices unreadable.
 */
export function LanguageSwitcher({
  tone = "ink",
  size = "sm",
  showIcon = true,
  hideLabel = false,
}: {
  tone?: "ink" | "paper";
  /**
   * `md` is for the footer, where these are the only settings on a dark ground.
   * At 11px uppercase the controls were legible but not findable — they read as
   * part of the footer's ornament rather than as something you can operate.
   */
  size?: "sm" | "md";
  /** The globe earns its place beside two bare selects; under a visible heading
   *  it is decoration, so the footer turns it off. */
  showIcon?: boolean;
  /** Set when a visible label already names this control, so a screen reader
   *  does not hear the word "Language" twice. */
  hideLabel?: boolean;
}) {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("currency");

  const dark = tone === "paper";
  const big = size === "md";

  return (
    <label className="group relative inline-flex items-center">
      {hideLabel ? null : <span className="sr-only">{t("language")}</span>}
      {/* A globe rather than nothing: two adjacent selects with only
          abbreviations in them were indistinguishable at a glance. */}
      {showIcon ? <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className={`pointer-events-none absolute left-2 h-3 w-3 ${
          dark ? "text-haldi/70" : "text-terracotta/80"
        } ${big ? "h-3.5 w-3.5" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      >
        <circle cx="8" cy="8" r="6.2" />
        <path d="M1.8 8h12.4M8 1.8c1.7 1.7 2.5 3.9 2.5 6.2S9.7 12.5 8 14.2C6.3 12.5 5.5 10.3 5.5 8S6.3 3.5 8 1.8z" />
      </svg> : null}
      <select
        value={locale}
        onChange={(e) => {
          const next = e.target.value as Locale;
          // `usePathname` from next-intl strips the locale prefix, so replacing
          // it keeps the visitor on the same page instead of sending them home.
          router.replace(pathname, { locale: next });
        }}
        className={`cursor-pointer appearance-none rounded-sm border bg-transparent font-sans transition-colors focus:outline-none focus:ring-2 disabled:opacity-60 ${
          big
            ? `${showIcon ? "pl-7" : "pl-3"} py-2 pr-8 text-[13.5px] font-medium tracking-[0.02em]`
            : "py-1 pl-6 pr-6 text-[11px] font-medium uppercase tracking-[0.12em]"
        } ${
          dark
            ? "border-rang-paper/40 text-rang-paper hover:border-haldi hover:text-haldi focus:ring-haldi/50"
            : "border-sand-border/70 text-deep-ink/75 hover:border-kumkum hover:text-kumkum focus:ring-sindoor"
        }`}
      >
        {routing.locales.map((code) => (
          <option
            key={code}
            value={code}
            className="bg-rang-paper text-deep-ink"
          >
            {LOCALE_LABELS[code]}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 10 6"
        className={`pointer-events-none absolute right-2 h-1.5 w-2.5 transition-colors ${
          dark
            ? "text-rang-paper/60 group-hover:text-haldi"
            : "text-deep-ink/45 group-hover:text-kumkum"
        }`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      >
        <path d="M1 1l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}
