/**
 * Which works are already sold.
 *
 * Every piece in this shop is one of one, so a work that has been bought cannot
 * be bought again — but nothing enforced that. Nothing in the catalogue was
 * marked sold after an order: stock levels are empty for every variant, so
 * `inventory_quantity` is null and the product page offered "Add to Cart" on
 * works that had already been paid for. One work has appeared in three order
 * line items.
 *
 * The truth is already in the database. An `order_line_item` carries the product
 * handle and the variant id it was bought from, so "sold" is a query, not a new
 * field somebody has to remember to set. Deriving it means the studio cannot
 * forget to tick a box, and a refund or cancellation that removes the order puts
 * the work back in the shop by itself.
 *
 * Cancelled orders are excluded: the work came back.
 *
 * This is a guard, not a lock. It closes the realistic path — someone adds a
 * work that has since sold, and pays for it — but two people paying at the same
 * second would still both get through, because the check happens before the
 * order exists. Truly preventing that needs an inventory reservation at add time,
 * which is a change to how the whole catalogue is stocked rather than a fix to
 * this hole.
 */

import { cache } from "react";
import { query } from "@/lib/db";

interface SoldRow {
  product_handle: string | null;
  variant_id: string | null;
}

const SOLD_SQL = `
  SELECT DISTINCT oli.product_handle, oli.variant_id
    FROM order_line_item oli
    JOIN order_item oi ON oi.item_id = oli.id AND oi.deleted_at IS NULL
    JOIN "order" o ON o.id = oi.order_id AND o.deleted_at IS NULL
   WHERE oli.deleted_at IS NULL
     AND o.status NOT IN ('canceled')
`;

/**
 * Memoised per request: the product page, the cart and the checkout flow all
 * ask, and the answer cannot change inside one request.
 */
const soldRows = cache(async (): Promise<SoldRow[]> => {
  try {
    return await query<SoldRow>(SOLD_SQL);
  } catch (error) {
    // A shop that cannot read its orders should still sell something rather than
    // fall over; the payment step re-checks, and a failed read is logged.
    console.error("[sold-works] could not read sold works", error);
    return [];
  }
});

export async function soldHandles(): Promise<Set<string>> {
  const rows = await soldRows();
  return new Set(
    rows.map((row) => row.product_handle).filter((handle): handle is string => Boolean(handle))
  );
}

export async function soldVariantIds(): Promise<Set<string>> {
  const rows = await soldRows();
  return new Set(
    rows.map((row) => row.variant_id).filter((id): id is string => Boolean(id))
  );
}

/** Pure, so the rule can be tested without a database. */
export function isSold(
  sold: Set<string>,
  value: string | null | undefined
): boolean {
  if (!value) return false;
  return sold.has(value);
}

/**
 * Works that can be made again are not one of one, so having sold one is not a
 * reason to refuse another. `made_to_order` and `custom_only` pieces stay on
 * sale; a `ready_to_ship` piece does not.
 */
export function isUniqueWork(stockType: string | null | undefined): boolean {
  return !stockType || stockType === "ready_to_ship";
}
