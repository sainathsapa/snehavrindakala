/**
 * POST /api/store/checkout/gift — remember a gift note on the cart.
 *
 * Kept on the cart rather than in React state so it survives a refresh, a
 * second tab, or closing the browser at the payment step. The completion route
 * copies it onto the order.
 */

import { NextResponse } from "next/server";
import { medusa } from "@/lib/medusa";
import { cleanGiftNote, parseGiftWrap } from "@/lib/gift";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const cartId = typeof body.cart_id === "string" ? body.cart_id : "";
  if (!cartId) {
    return NextResponse.json({ error: "Missing cart" }, { status: 400 });
  }

  const note = cleanGiftNote(body.note);
  const wrap = parseGiftWrap(body.wrap);

  try {
    const cart = await medusa.updateCart(cartId, {
      metadata: { gift_note: note, gift_wrap: wrap ? "true" : "" },
    });
    return NextResponse.json({
      ok: true,
      note: (cart.metadata?.gift_note as string) ?? note,
      wrap,
    });
  } catch (error) {
    console.error("Could not save the gift note on the cart", error);
    return NextResponse.json(
      { ok: false, error: "The note could not be saved. You can add it to the order notes instead." },
      { status: 500 }
    );
  }
}
