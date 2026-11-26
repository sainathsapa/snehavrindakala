/**
 * The order reference a buyer types into /track.
 *
 * There used to be none: the confirmation email printed `display_id`, which is a
 * counter — 1, 2, 3 — and /track wanted either the internal `order_01J…` id or an
 * AWB that does not exist until the parcel ships. So the one number the buyer
 * actually had in front of them was the one the form rejected.
 *
 * The fix is not to start accepting counters. A sequential id plus an email
 * address is a weak credential: the email is the thing an attacker is most
 * likely to already have, and once they have it they can walk 1, 2, 3 … through
 * every order the shop has ever taken. So each order gets an opaque reference
 * instead — 12 characters of Crockford's base32, 60 bits, derived from
 * crypto.randomBytes and never from the order id. Nothing about it can be
 * computed from the order, and it cannot be enumerated.
 *
 * Crockford's alphabet drops I, L, O and U because they are what people mistype
 * when copying from a printed slip, and the normaliser accepts the obvious
 * substitutions (O→0, I/L→1) so a mistyped reference still resolves.
 *
 * The reference is a capability: whoever holds it can see that order's
 * non-sensitive summary. It is still paired with the email address at the form,
 * so a reference that leaks on its own does not open a stranger's order.
 */

import crypto from "crypto";
import { query } from "@/lib/db";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const LENGTH = 12;

/** SV-7Q4K-2M9D-RX3P: four groups of three, readable over the phone. */
export function formatOrderRef(raw: string): string {
  const clean = raw.toUpperCase();
  return `SV-${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6, 9)}-${clean.slice(9, 12)}`;
}

export function makeOrderRef(): string {
  const bytes = crypto.randomBytes(LENGTH);
  let out = "";
  for (let i = 0; i < LENGTH; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/**
 * Strip formatting and undo the mistypes the alphabet was chosen to survive.
 * Returns "" for anything that cannot be a reference, so callers can treat it as
 * "not a reference" rather than query the database with junk.
 */
export function normalizeOrderRef(input: string): string {
  const cleaned = String(input || "")
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, "")
    .replace(/^SV/, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (cleaned.length !== LENGTH) return "";
  for (const char of cleaned) {
    if (!ALPHABET.includes(char)) return "";
  }
  return cleaned;
}

/**
 * The reference for an order, created on first ask.
 *
 * Get-or-insert rather than insert: the confirmation email, the order page and
 * any later "track my order" click all ask for the same reference, and an order
 * must not end up with two. ON CONFLICT DO NOTHING plus a re-read makes a
 * concurrent double-ask harmless.
 */
export async function publicRefForOrder(orderId: string): Promise<string> {
  const existing = await query<{ ref: string }>(
    `SELECT ref FROM order_public_ref WHERE order_id = $1`,
    [orderId]
  );
  if (existing[0]?.ref) return existing[0].ref;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = makeOrderRef();
    const inserted = await query<{ ref: string }>(
      `INSERT INTO order_public_ref (order_id, ref)
       VALUES ($1, $2)
       ON CONFLICT (order_id) DO NOTHING
       RETURNING ref`,
      [orderId, candidate]
    );
    if (inserted[0]?.ref) return inserted[0].ref;

    // Either the order already had one (another request won the race) or the
    // candidate collided. Both are resolved by reading back what is stored.
    const again = await query<{ ref: string }>(
      `SELECT ref FROM order_public_ref WHERE order_id = $1`,
      [orderId]
    );
    if (again[0]?.ref) return again[0].ref;
  }

  throw new Error("Could not allocate an order reference");
}

/** Resolve a typed reference back to an order id, or null. */
export async function orderIdForRef(input: string): Promise<string | null> {
  const ref = normalizeOrderRef(input);
  if (!ref) return null;
  const rows = await query<{ order_id: string }>(
    `SELECT order_id FROM order_public_ref WHERE ref = $1`,
    [ref]
  );
  return rows[0]?.order_id ?? null;
}

/** The display reference for an order, or null if it somehow has none. */
export async function orderRefIfAny(orderId: string): Promise<string | null> {
  try {
    const rows = await query<{ ref: string }>(
      `SELECT ref FROM order_public_ref WHERE order_id = $1`,
      [orderId]
    );
    return rows[0]?.ref ?? null;
  } catch {
    return null;
  }
}
