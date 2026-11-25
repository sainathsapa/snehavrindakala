/**
 * The house's own particulars, in one place.
 *
 * It lives here rather than in `lib/site-content.ts` because that module talks to
 * the database: importing it from a client component (the footer) pulled `pg`
 * into the browser bundle and the whole site returned 500 with
 * "Module not found: Can't resolve 'fs'". A mailto link is not worth a database
 * driver in the browser.
 *
 * The postal address is written once and read by the footer, the structured
 * data and the invoice, so a move changes one file instead of three that
 * disagree. It is the owner's registered address: Delhivery/Shiprocket labels
 * and GST invoices are checked against it.
 */

export const STUDIO_EMAIL = "hello@snehavrinda.in";

/** The trading name on the lintel and in correspondence. */
export const STUDIO_NAME = "Snehavrinda Arts Works";

/**
 * The address, line by line, exactly as it is written on a courier label.
 * Kept as separate lines because a postal address collapses badly when joined
 * with commas and the label format expects the break after the street.
 */
export const STUDIO_ADDRESS_LINES: readonly string[] = [
  "Napasar Road, Near Ramdev Mandir",
  "Ward No. 16, Deshnok, Nokha",
  "Bikaner, Rajasthan – 334801, India",
];

/** The same address as one line, for places that have no room for four. */
export const STUDIO_ADDRESS = STUDIO_ADDRESS_LINES.join(", ");

/** Structured parts, for schema.org PostalAddress. */
export const STUDIO_ADDRESS_PARTS = {
  streetAddress: "Napasar Road, Near Ramdev Mandir, Ward No. 16",
  addressLocality: "Deshnok, Nokha",
  addressRegion: "Rajasthan",
  postalCode: "334801",
  addressCountry: "IN",
} as const;

/** Short place label for the footer byline: town · district · state. */
export const STUDIO_PLACE = "Deshnok · Bikaner · Rajasthan";
