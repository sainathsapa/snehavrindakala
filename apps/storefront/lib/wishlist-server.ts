/**
 * Server-side wishlist for signed-in customers.
 *
 * The list itself lives in the browser so a guest can save a work without an
 * account — that is a promise the checkout makes and the PDP heart depends on.
 * This table exists for the one thing localStorage cannot do: carry the list to
 * another device, or survive clearing site data.
 *
 * Identity is the Medusa customer id from the session cookie. No customer id,
 * no rows — a guest is never written to the server, so the table cannot be used
 * to profile anonymous visitors.
 *
 * Merge rule: the union of both lists, local order first. Nothing is ever
 * deleted by a merge, so a stale browser tab cannot wipe what was saved on a
 * phone. Explicit removals are the only thing that deletes.
 */

import { query, queryResult } from "@/lib/db";
import type { WishlistEntry } from "@/lib/wishlist-store";

type Row = {
  handle: string;
  title: string;
  image: string;
  price: string | number | null;
  currency: string;
  artist: string;
};

function toEntry(row: Row): WishlistEntry {
  return {
    handle: row.handle,
    title: row.title,
    image: row.image || undefined,
    price: row.price === null ? null : Number(row.price),
    currency: row.currency || undefined,
    artist: row.artist || undefined,
  };
}

export async function listWishlistFor(customerId: string): Promise<WishlistEntry[]> {
  if (!customerId) return [];
  const result = await queryResult<Row>(
    `SELECT handle, title, image, price, currency, artist
       FROM customer_wishlist WHERE customer_id=$1
      ORDER BY created_at DESC, id DESC`,
    [customerId]
  );
  return result.rows.map(toEntry);
}

/**
 * Store exactly the given list for this customer.
 *
 * A replace rather than an append so a removal on one device is a removal, not
 * a row that reappears on the next merge. Entries are validated by the caller
 * (the API route) and re-validated here by construction: only known fields are
 * written, and the handle is the only key.
 */
export async function replaceWishlistFor(
  customerId: string,
  entries: WishlistEntry[]
): Promise<WishlistEntry[]> {
  if (!customerId) return [];

  const unique = dedupeByHandle(entries).slice(0, 200);

  await query("DELETE FROM customer_wishlist WHERE customer_id=$1", [customerId]);

  for (const entry of unique) {
    await query(
      `INSERT INTO customer_wishlist
         (customer_id, handle, title, image, price, currency, artist)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (customer_id, handle) DO NOTHING`,
      [
        customerId,
        entry.handle,
        entry.title,
        entry.image ?? "",
        typeof entry.price === "number" ? entry.price : null,
        entry.currency ?? "",
        entry.artist ?? "",
      ]
    );
  }

  return listWishlistFor(customerId);
}

export function dedupeByHandle(entries: WishlistEntry[]): WishlistEntry[] {
  const seen = new Set<string>();
  const out: WishlistEntry[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry.handle !== "string" || !entry.handle) continue;
    if (seen.has(entry.handle)) continue;
    seen.add(entry.handle);
    out.push(entry);
  }
  return out;
}
