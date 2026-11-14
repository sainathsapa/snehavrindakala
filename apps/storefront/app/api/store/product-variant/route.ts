/**
 * GET /api/store/product-variant?handle=...
 *
 * Returns just the purchasable variant id for a product handle, so client
 * surfaces that only hold a snapshot (the wishlist, recently viewed) can add an
 * item to the cart without knowing variant ids. Deliberately minimal: it exposes
 * nothing but an id that is already public on the product page.
 */
import { NextResponse } from "next/server";
import { medusa } from "@/lib/medusa";
import { resolveMedusaHandle } from "@/lib/catalogue";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const handle = searchParams.get("handle");
  if (!handle) {
    return NextResponse.json({ error: "handle is required" }, { status: 400 });
  }

  try {
    const medusaHandle = await resolveMedusaHandle(handle);
    const { product } = await medusa.getProduct(medusaHandle);
    const variantId = product?.variants?.[0]?.id ?? null;
    if (!variantId) {
      return NextResponse.json(
        { error: "No purchasable option for this product" },
        { status: 404 }
      );
    }
    return NextResponse.json({ variantId });
  } catch (err) {
    console.error("product-variant lookup failed", err);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
