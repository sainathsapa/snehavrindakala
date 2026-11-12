/**
 * GET /api/store/cart-count — number of units in the current cart.
 *
 * Returns 0 rather than an error when there is no cart yet, so the header badge
 * can render unconditionally.
 */

import { NextResponse } from "next/server";
import { getCart } from "@/lib/cart";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cart = await getCart();
    const count = (cart?.items ?? []).reduce(
      (sum, item) => sum + (item.quantity || 0),
      0
    );
    return NextResponse.json({ count });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
