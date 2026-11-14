import { cookies } from "next/headers";

/**
 * Which currency the visitor is shopping in.
 *
 * Currency is a presentation choice, not an account setting: a visitor from
 * London should see pounds without signing in, and the choice should survive
 * navigation. A cookie is the right store for that — it is readable on the
 * server during render, so prices are correct in the first paint rather than
 * flickering from rupees once JavaScript runs.
 *
 * The list is deliberately short. Every currency needs prices, tax handling and a
 * merchant account that can settle in it, so a long menu of currencies that
 * silently fall back to INR would be worse than four that work.
 */

export interface CurrencyOption {
  code: string; // ISO 4217, lowercase
  regionId: string;
  label: string;
  symbol: string;
}

export const CURRENCY_COOKIE = "svk_currency";

/** Default when nothing is chosen: the home currency. */
export const DEFAULT_CURRENCY_CODE = "inr";

export const CURRENCIES: CurrencyOption[] = [
  {
    code: "inr",
    regionId: "reg_01M6R4FSX0TH8KNNJEX609VZN1",
    label: "India (INR)",
    symbol: "₹",
  },
  {
    code: "usd",
    regionId: "reg_01M7D2RJD2VYFFHRE6GS4MFKN6",
    label: "United States (USD)",
    symbol: "$",
  },
  {
    code: "gbp",
    regionId: "reg_01M7D2RJF6VMADYX8PWQBT92QZ",
    label: "United Kingdom (GBP)",
    symbol: "£",
  },
  {
    code: "eur",
    regionId: "reg_01M7D2RJG5G2RQKN31VYTAM9HJ",
    label: "Europe (EUR)",
    symbol: "€",
  },
  {
    code: "aed",
    regionId: "reg_01M7D42RB7JGYQVCXMS0EH1ZKG",
    label: "United Arab Emirates (AED)",
    symbol: "د.إ",
  },
];

/**
 * Region ids are pinned rather than looked up by currency on every request. They
 * are stable once created, and pinning means a misconfigured backend produces a
 * visible fallback instead of silently serving rupee prices to everyone.
 */
export function regionIdFor(code: string): string | undefined {
  return CURRENCIES.find((c) => c.code === code)?.regionId || undefined;
}

/**
 * The visitor's currency, falling back to the default.
 *
 * Reading the cookie can throw when called outside a request scope (during a
 * build, for example), so it is guarded and simply returns the default.
 */
export async function getPreferredCurrency(): Promise<string> {
  try {
    const store = await cookies();
    const value = store.get(CURRENCY_COOKIE)?.value?.toLowerCase();
    if (value && CURRENCIES.some((c) => c.code === value)) return value;
  } catch {
    // No request scope; use the default.
  }
  return DEFAULT_CURRENCY_CODE;
}

export function currencyLabel(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.label ?? code.toUpperCase();
}

/**
 * Where we will actually ship.
 *
 * Kept deliberately short and tied to the currencies that have prices. Offering
 * a country we cannot quote for would mean taking an order and then asking the
 * buyer to pay more or cancel — worse than not listing it.
 */
export const SHIPPING_COUNTRIES: { code: string; name: string; currency: string }[] = [
  { code: "in", name: "India", currency: "inr" },
  { code: "us", name: "United States", currency: "usd" },
  { code: "ca", name: "Canada", currency: "usd" },
  { code: "gb", name: "United Kingdom", currency: "gbp" },
  { code: "de", name: "Germany", currency: "eur" },
  { code: "fr", name: "France", currency: "eur" },
  { code: "nl", name: "Netherlands", currency: "eur" },
  { code: "ae", name: "United Arab Emirates", currency: "aed" },
  { code: "sa", name: "Saudi Arabia", currency: "aed" },
];

/**
 * Whether a destination needs a customs declaration.
 *
 * Anything leaving India does. The checkout says so plainly rather than
 * estimating duty, because a wrong estimate is worse than an honest warning.
 */
export function isInternational(countryCode: string): boolean {
  return countryCode.toLowerCase() !== "in";
}
