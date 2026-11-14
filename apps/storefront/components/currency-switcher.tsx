"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Currency picker.
 *
 * A visitor should not have to reason about rupees to buy a painting from London.
 * The choice is written to a cookie and the page is refreshed, because prices are
 * calculated per region on the server — switching currency client-side would only
 * relabel numbers, not re-price them.
 *
 * Deliberately small: four currencies that actually have prices behind them
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
}: {
  current: string;
  /**
   * Shorter option text for the mobile menu sheet.
   *
   * The full "₹ INR · India" label made this select nearly twice the width of
   * the language select sitting beside it, which read as a layout mistake.
   */
  compact?: boolean;
}) {
  const [value, setValue] = useState(current);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => setValue(current), [current]);

  async function change(next: string) {
    setValue(next);
    await fetch("/api/currency", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currency: next }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">Currency</span>
      <select
        value={value}
        onChange={(e) => change(e.target.value)}
        disabled={pending}
        className="cursor-pointer rounded-sm border border-sand-border bg-transparent px-2 py-1 font-sans text-[11px] uppercase tracking-[0.12em] text-deep-ink/80 transition-colors hover:border-terracotta/50 focus:border-terracotta focus:outline-none disabled:opacity-60"
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {compact
              ? `${c.symbol} ${c.code.toUpperCase()}`
              : `${c.symbol} ${c.code.toUpperCase()} · ${c.label}`}
          </option>
        ))}
      </select>
    </label>
  );
}
