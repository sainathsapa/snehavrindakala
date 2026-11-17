"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";

/**
 * Currency picker.
 *
 * A visitor should not have to reason about rupees to buy a painting from London.
 * The choice is written to a cookie and the page is refreshed, because prices are
 * calculated per region on the server — switching currency client-side would only
 * relabel numbers, not re-price them.
 *
 * Deliberately small: five currencies that actually have prices behind them
 * rather than a long menu of flags that fall back to INR.
 */

const CURRENCIES = [
  { code: "inr", label: "India", symbol: "₹" },
  { code: "usd", label: "United States", symbol: "$" },
  { code: "gbp", label: "United Kingdom", symbol: "£" },
  { code: "eur", label: "Europe", symbol: "€" },
  { code: "aed", label: "UAE", symbol: "د.إ" },
];

export function CurrencySwitcher({
  current,
  compact = false,
  tone = "ink",
}: {
  current: string;
  /**
   * Shorter option text for the mobile menu sheet.
   *
   * The full "₹ INR · India" label made this select nearly twice the width of
   * the language select sitting beside it, which read as a layout mistake.
   */
  compact?: boolean;
  /**
   * Which ground this sits on. The footer is #2A120C, where the deep-ink text
   * these originally hard-coded is unreadable; "paper" flips the palette to the
   * light-text-on-dark variant.
   */
  tone?: "ink" | "paper";
}) {
  const [value, setValue] = useState(current);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const t = useTranslations("currency");
  const locale = useLocale();

  const dark = tone === "paper";

  useEffect(() => setValue(current), [current]);

  async function change(next: string) {
    setValue(next);
    await fetch("/api/currency", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currency: next, locale }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <label className="group relative inline-flex items-center">
      <span className="sr-only">{t("label")}</span>
      {/* The unit mark reads as a currency before the select is opened — the
          select alone showed an abbreviation and nothing else. */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute left-2 font-serif text-[13px] leading-none ${
          dark ? "text-haldi/80" : "text-terracotta/80"
        }`}
      >
        {CURRENCIES.find((c) => c.code === value)?.symbol ?? "₹"}
      </span>
      <select
        value={value}
        onChange={(e) => change(e.target.value)}
        disabled={pending}
        className={`cursor-pointer appearance-none rounded-sm border bg-transparent py-1 pl-6 pr-6 font-sans text-[11px] font-medium uppercase tracking-[0.12em] transition-colors focus:outline-none disabled:opacity-60 ${
          dark
            ? "border-rang-paper/30 text-rang-paper/85 hover:border-haldi hover:text-haldi focus:border-haldi focus:ring-1 focus:ring-haldi/40"
            : "border-sand-border/70 text-deep-ink/75 hover:border-kumkum hover:text-kumkum focus:border-sindoor focus:ring-1 focus:ring-sindoor/40"
        }`}
      >
        {CURRENCIES.map((c) => (
          <option
            key={c.code}
            value={c.code}
            className="bg-rang-paper text-deep-ink"
          >
            {compact
              ? `${c.code.toUpperCase()}`
              : `${c.code.toUpperCase()} · ${c.label}`}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 10 6"
        className={`pointer-events-none absolute right-1.5 h-1.5 w-2.5 transition-colors ${
          dark
            ? "text-rang-paper/45 group-hover:text-haldi"
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
