/**
 * Resolve an Indian PIN code to its district and state.
 *
 * Checkout used to ask for city, state and PIN as three free-text fields with
 * nothing connecting them, so a buyer could type "Jaipu" and "Rajastan" and the
 * order would still be accepted. India Post publishes an open lookup; using it
 * means the two fields fill themselves from six digits and the courier receives
 * a real district and state rather than whatever was typed.
 *
 * Imported dynamically by a server action, so this file must not be pulled into
 * a client bundle.
 */

export interface PincodeResult {
  pincode: string;
  city: string;
  state: string;
}

interface PostOfficeEntry {
  District?: string | null;
  State?: string | null;
  Pincode?: string | null;
  DeliveryStatus?: string | null;
}

interface PostalResponse {
  Status?: string;
  PostOffice?: PostOfficeEntry[] | null;
}

/**
 * Look up a PIN code.
 *
 * Returns `null` for anything that is not a live six-digit Indian PIN — the
 * caller falls back to letting the buyer type city and state by hand, which
 * matters because the public API is unofficial and may be unavailable.
 */
export async function lookupPincode(
  raw: string
): Promise<PincodeResult | null> {
  const pincode = raw.trim();
  if (!/^[1-9][0-9]{5}$/.test(pincode)) return null;

  try {
    const response = await fetch(
      `https://api.postalpincode.in/pincode/${pincode}`,
      // The buyer is waiting on this field; do not hang the form on a slow
      // upstream. Ten seconds is generous for a 200-byte response.
      { signal: AbortSignal.timeout(10_000), next: { revalidate: 604_800 } }
    );
    if (!response.ok) return null;

    const payload = (await response.json()) as PostalResponse[] | null;
    const entry = payload?.[0];
    if (!entry || entry.Status !== "Success") return null;

    const offices = entry.PostOffice ?? [];
    if (!offices.length) return null;

    // Prefer a delivery office: its district is the one the courier routes to.
    const office =
      offices.find((o) => o.DeliveryStatus === "Delivery") ?? offices[0];

    const city = office.District?.trim();
    const state = office.State?.trim();
    if (!city || !state) return null;

    return { pincode, city, state };
  } catch {
    // Network failure, timeout, or a body that is not JSON. The form still
    // works; the buyer simply types the two fields.
    return null;
  }
}
