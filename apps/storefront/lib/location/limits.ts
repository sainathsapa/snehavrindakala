/**
 * The set of country codes we accept at checkout.
 *
 * Kept separate from `lib/currency` so the server actions can import a plain
 * value without pulling the cookie-reading currency module into every call.
 */

import { SHIPPING_COUNTRIES } from "@/lib/currency";

export const COUNTRY_CODES = new Set(
  SHIPPING_COUNTRIES.map((country) => country.code)
);
