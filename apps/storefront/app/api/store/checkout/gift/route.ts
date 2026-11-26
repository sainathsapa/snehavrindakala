/**
 * POST /api/store/checkout/gift — remember a gift note on the cart.
 *
 * Kept on the cart rather than in React state so it survives a refresh, a
 * second tab, or closing the browser at the payment step. The completion route
 * copies it onto the order.
 */

import { NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { medusa } from "@/lib/medusa";
import { cleanGiftNote, parseGiftWrap } from "@/lib/gift";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Public endpoint: bound it per IP so one caller cannot use it as a free
  // proxy for our own costs (courier quotes, payment orders, file uploads).
  const limit = await checkRateLimit({
    route: "checkout-gift",
    ip: clientIp(req.headers),
    limit: 20,
    windowSeconds: 60,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

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
