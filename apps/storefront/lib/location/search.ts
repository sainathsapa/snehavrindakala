/**
 * Search, filtering and validation helpers for the address form.
 *
 * All pure — no React, no DOM — so the tests can run in plain node and so the
 * combobox's behaviour is defined by a function rather than by whatever the
 * component happens to do. Every rule here is quoted in the checkout copy or in
 * an inline error message, so this file is the single statement of "what counts
 * as a valid address".
 */

import { countryByCode, postalInputMode, postalMaxLength } from "./index";

/** Locale-aware, accent-tolerant matching for the location pickers. */
export function normalise(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Rank options against a query.
 *
 * Ordering is deliberate: exact match first, then prefix, then a word-boundary
 * prefix ("york" matching "New York"), then anywhere in the string. A buyer
 * typing "jai" wants Jaipur at the top, not Jaisalmer, and typing "york" should
 * still find New York. Alphabetical order breaks ties so the list does not
 * reshuffle between identical queries.
 */
export function rankOptions(options: string[], query: string, limit = 50): string[] {
  const needle = normalise(query);
  if (!needle) return options.slice(0, limit);

  const scored: { value: string; score: number }[] = [];

  for (const option of options) {
    const haystack = normalise(option);
    let score = -1;

    if (haystack === needle) score = 0;
    else if (haystack.startsWith(needle)) score = 1;
    else if (haystack.split(/[\s,-]+/).some((word) => word.startsWith(needle))) score = 2;
    else if (haystack.includes(needle)) score = 3;

    if (score >= 0) scored.push({ value: option, score });
  }

  scored.sort(
    (a, b) => a.score - b.score || a.value.localeCompare(b.value)
  );

  return scored.slice(0, limit).map((entry) => entry.value);
}

/* -------------------------------------------------------------------------- */
/*                                 fields                                     */
/* -------------------------------------------------------------------------- */

export interface AddressDraft {
  full_name: string;
  email: string;
  phone: string;
  country_code: string;
  postal_code: string;
  province: string;
  city: string;
  address_1: string;
  address_2: string;
}

export type AddressField = keyof AddressDraft;

export const EMPTY_ADDRESS: AddressDraft = {
  full_name: "",
  email: "",
  phone: "",
  country_code: "",
  postal_code: "",
  province: "",
  city: "",
  address_1: "",
  address_2: "",
};

/**
 * Commercial email shape, not RFC 5322.
 *
 * The goal is to reject "test@test" and "a b@c.com" without rejecting a real
 * address. Anything stricter starts refusing valid addresses with unusual TLDs.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Digits allowed for a phone number after the country code is stripped.
 *
 * A worldwide range rather than exact national plans: numbers change, and a
 * validation rule that is stricter than the customer's actual phone is a bug
 * that blocks a sale.
 */
export function validatePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "Enter a phone number so the courier can reach you.";
  if (digits.length < 6) return "That phone number looks too short.";
  if (digits.length > 15) return "That phone number looks too long.";
  return null;
}

/**
 * Postal code validation per destination.
 *
 * Only formats we are confident about are enforced. For a country whose format
 * we do not know we accept anything non-empty — refusing a real address because
 * our regex was wrong is worse than accepting a malformed one we then confirm.
 */
export function validatePostal(raw: string, countryCode: string): string | null {
  const value = raw.trim();
  const country = String(countryCode ?? "").toLowerCase();

  if (!value) {
    const label = countryByCode(country)?.postalLabel ?? "Postal code";
    return `Enter your ${label.toLowerCase()}.`;
  }

  switch (country) {
    case "in":
      return /^[1-9][0-9]{5}$/.test(value)
        ? null
        : "An Indian PIN code is six digits and cannot start with 0.";
    case "us":
      return /^\d{5}(-\d{4})?$/.test(value)
        ? null
        : "A US ZIP code is five digits.";
    case "ca":
      return /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/.test(value)
        ? null
        : "A Canadian postal code looks like K1A 0B1.";
    case "gb":
      return /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$/.test(value)
        ? null
        : "A UK postcode looks like SW1A 1AA.";
    case "de":
    case "fr":
    case "ae":
    case "sa":
      return /^\d{5,6}$/.test(value) ? null : "That postal code should be digits only.";
    case "nl":
      return /^\d{4}\s?[A-Za-z]{2}$/.test(value)
        ? null
        : "A Dutch postcode looks like 1012 AB.";
    default:
      return null;
  }
}

/**
 * The full validation pass.
 *
 * Returns a map of field → message for the fields that are wrong. An empty map
 * means the address may be submitted. Fields the customer has not touched yet
 * are reported too — this is the submit-time pass, not the per-keystroke one.
 */
export function validateAddress(draft: AddressDraft): Partial<Record<AddressField, string>> {
  const errors: Partial<Record<AddressField, string>> = {};

  if (!draft.full_name.trim()) {
    errors.full_name = "Enter the name the courier should ask for.";
  } else if (draft.full_name.trim().length < 2) {
    errors.full_name = "That name looks too short.";
  }

  if (!draft.email.trim()) {
    errors.email = "We send the order confirmation here.";
  } else if (!EMAIL.test(draft.email.trim())) {
    errors.email = "That email address is missing something.";
  }

  const phone = validatePhone(draft.phone);
  if (phone) errors.phone = phone;

  if (!countryByCode(draft.country_code)) {
    errors.country_code = "Choose a country we deliver to.";
  }

  const postal = validatePostal(draft.postal_code, draft.country_code);
  if (postal) errors.postal_code = postal;

  if (!draft.province.trim()) {
    errors.province = "Choose your state or region.";
  }

  if (!draft.city.trim()) {
    errors.city = "Choose or type your city.";
  }

  if (!draft.address_1.trim()) {
    errors.address_1 = "Enter your street address.";
  } else if (draft.address_1.trim().length < 5) {
    errors.address_1 = "Add the house or building number and the street.";
  }

  return errors;
}

/** True when nothing in the draft is filled in yet. */
export function isBlank(draft: AddressDraft): boolean {
  return Object.values(draft).every((value) => !String(value ?? "").trim());
}

/**
 * An address used only for billing — the contact details belong to the order,
 * not to this address, so they are deliberately absent.
 */
export interface BillingAddress {
  full_name: string;
  country_code: string;
  postal_code: string;
  province: string;
  city: string;
  address_1: string;
  address_2: string;
}

export type BillingField = keyof BillingAddress;

export const EMPTY_BILLING: BillingAddress = {
  full_name: "",
  country_code: "",
  postal_code: "",
  province: "",
  city: "",
  address_1: "",
  address_2: "",
};

/** True when a billing address has nothing typed in it yet. */
export function isBlankBilling(billing: BillingAddress): boolean {
  return Object.values(billing).every((value) => !String(value ?? "").trim());
}

/**
 * Validation for a billing address that differs from the delivery address.
 *
 * It is deliberately looser than `validateAddress`: a billing address has to be
 * plausible enough to raise an invoice, but a buyer may legitimately bill to a
 * registered office whose street line does not look like a delivery address.
 * Email and phone are not asked for again.
 */
export function validateBilling(
  billing: BillingAddress
): Partial<Record<BillingField, string>> {
  const errors: Partial<Record<BillingField, string>> = {};

  if (!billing.full_name.trim()) {
    errors.full_name = "Enter the name the invoice should be made out to.";
  }

  if (!countryByCode(billing.country_code)) {
    errors.country_code = "Choose a country.";
  }

  if (!billing.address_1.trim()) {
    errors.address_1 = "Enter the billing street address.";
  }

  if (!billing.city.trim()) {
    errors.city = "Enter the billing city.";
  }

  return errors;
}

/**
 * Which field the form should focus when a submit is rejected.
 *
 * Top-of-form order, not object-key order: the first *visible* problem is the one
 * a customer can fix without hunting, and scrolling to a field further down while
 * an earlier one is also wrong makes the form feel arbitrary.
 */
export const FIELD_ORDER: AddressField[] = [
  "full_name",
  "email",
  "phone",
  "address_1",
  "address_2",
  "country_code",
  "postal_code",
  "province",
  "city",
];

export function firstInvalidField(
  errors: Partial<Record<AddressField, string>>
): AddressField | null {
  return FIELD_ORDER.find((field) => Boolean(errors[field])) ?? null;
}

/** Digits only, with the country calling code shown separately in the UI. */
export function localPhoneDigits(raw: string, dialCode: string): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (!dialCode) return digits;
  return digits.startsWith(dialCode) ? digits.slice(dialCode.length) : digits;
}

/** Compose the E.164-ish value Medusa stores, from a local number + dial code. */
export function composePhone(local: string, dialCode: string): string {
  const digits = String(local ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return dialCode ? `+${dialCode}${digits}` : digits;
}

export { postalInputMode, postalMaxLength };
