/**
 * Pure validation for the public partner onboarding application.
 *
 * This module has no database, network or framework dependencies: the API route
 * uses it to decide whether a payload is safe to persist, and the form can use
 * the same rules for inline feedback. Nothing here trusts a client-supplied
 * status — the only statuses that exist in the output are none at all, because
 * a submitted application is always `pending` (decided by the server/DB).
 */

/** Free-form business information collected on the public form. */
export interface BusinessDetails {
  description?: string;
  business_type?: string;
  years_in_business?: string;
  website?: string;
  registration_number?: string;
  [key: string]: unknown;
}

/** Free-form artist / maker information collected on the public form. */
export interface ArtistInformation {
  studio_name?: string;
  practice?: string;
  story?: string;
  portfolio_url?: string;
  number_of_makers?: string;
  [key: string]: unknown;
}

/** Raw, untrusted shape coming from `req.json()`. */
export interface ApplicationInput {
  legal_name?: unknown;
  display_name?: unknown;
  contact_email?: unknown;
  contact_phone?: unknown;
  business_details?: unknown;
  artist_information?: unknown;
  product_categories?: unknown;
  document_keys?: unknown;
  // Deliberately not read: `status`, `review_status`, ids, partner ids, etc.
  [key: string]: unknown;
}

/** Normalised, allow-listed value that is safe to hand to the insert statement. */
export interface ValidApplication {
  legal_name: string;
  display_name: string;
  contact_email: string;
  contact_phone: string | null;
  business_details: BusinessDetails;
  artist_information: ArtistInformation;
  product_categories: string[];
  document_keys: string[];
}

/** Result of {@link validateApplication}. `value` is null unless `ok` is true. */
export interface ValidationResult {
  ok: boolean;
  errors: Record<string, string>;
  value: ValidApplication | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isEmail(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 254 &&
    EMAIL_RE.test(value.trim())
  );
}

/**
 * Validate and normalise a public partner application payload.
 *
 * Required: `legal_name`, `display_name`, `contact_email` (non-empty strings),
 * `business_details` (a non-empty object) and `product_categories` (a non-empty
 * array of strings). `contact_phone`, `artist_information` and `document_keys`
 * are optional and get safe defaults. Unknown keys — including any client
 * attempt to set a status — are dropped from the returned `value`.
 */
export function validateApplication(input: unknown): ValidationResult {
  const errors: Record<string, string> = {};
  const source: ApplicationInput = isPlainObject(input)
    ? (input as ApplicationInput)
    : {};

  if (!isPlainObject(input)) {
    errors.form = "Application must be a JSON object.";
    return { ok: false, errors, value: null };
  }

  const legalName = nonEmptyString(source.legal_name);
  if (!legalName) errors.legal_name = "Legal name is required.";

  const displayName = nonEmptyString(source.display_name);
  if (!displayName) errors.display_name = "Display name is required.";

  const rawEmail = typeof source.contact_email === "string" ? source.contact_email.trim() : "";
  if (!rawEmail) {
    errors.contact_email = "Contact email is required.";
  } else if (!isEmail(rawEmail)) {
    errors.contact_email = "Enter a valid email address.";
  }

  let contactPhone: string | null = null;
  if (source.contact_phone !== undefined && source.contact_phone !== null && source.contact_phone !== "") {
    if (typeof source.contact_phone !== "string") {
      errors.contact_phone = "Contact phone must be text.";
    } else {
      contactPhone = source.contact_phone.trim() || null;
    }
  }

  let businessDetails: BusinessDetails = {};
  if (!isPlainObject(source.business_details)) {
    errors.business_details = "Business details are required.";
  } else if (Object.keys(source.business_details).length === 0) {
    errors.business_details = "Business details cannot be empty.";
  } else {
    businessDetails = source.business_details as BusinessDetails;
  }

  let artistInformation: ArtistInformation = {};
  if (
    source.artist_information !== undefined &&
    !isPlainObject(source.artist_information)
  ) {
    errors.artist_information = "Artist information must be an object.";
  } else if (isPlainObject(source.artist_information)) {
    artistInformation = source.artist_information as ArtistInformation;
  }

  let productCategories: string[] = [];
  if (!Array.isArray(source.product_categories)) {
    errors.product_categories = "Select at least one product category.";
  } else {
    productCategories = source.product_categories.filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0
    );
    if (productCategories.length === 0) {
      errors.product_categories = "Select at least one product category.";
    }
  }

  let documentKeys: string[] = [];
  if (source.document_keys !== undefined && !Array.isArray(source.document_keys)) {
    errors.document_keys = "Document references must be a list.";
  } else if (Array.isArray(source.document_keys)) {
    documentKeys = source.document_keys.filter(
      (item): item is string => typeof item === "string" && item.trim().length > 0
    );
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, value: null };
  }

  return {
    ok: true,
    errors: {},
    value: {
      legal_name: legalName as string,
      display_name: displayName as string,
      contact_email: rawEmail,
      contact_phone: contactPhone,
      business_details: businessDetails,
      artist_information: artistInformation,
      product_categories: productCategories,
      document_keys: documentKeys,
    },
  };
}
