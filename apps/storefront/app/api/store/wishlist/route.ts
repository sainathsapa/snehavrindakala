/**
 * GET  /api/store/wishlist  — the signed-in customer's saved works
 * PUT  /api/store/wishlist  — replace them with the list the browser holds
 *
 * A guest gets `signedIn: false` and an empty list, and nothing is read or
 * written on their behalf. The browser keeps its own copy either way; this
 * endpoint exists only so the list can follow a customer to another device.
 */

import { NextResponse } from "next/server";
import { getCurrentCustomer } from "@/lib/auth";
import {
  dedupeByHandle,
  listWishlistFor,
  replaceWishlistFor,
} from "@/lib/wishlist-server";
import type { WishlistEntry } from "@/lib/wishlist-store";

export const dynamic = "force-dynamic";

function sanitise(input: unknown): WishlistEntry[] {
  if (!Array.isArray(input)) return [];
  return dedupeByHandle(
    input
      .filter((e): e is Record<string, unknown> => Boolean(e) && typeof e === "object")
      .filter((e) => typeof e.handle === "string" && typeof e.title === "string")
      .map((e) => ({
        handle: String(e.handle).slice(0, 200),
        title: String(e.title).slice(0, 300),
        image: typeof e.image === "string" ? e.image.slice(0, 500) : undefined,
        price: typeof e.price === "number" && Number.isFinite(e.price) ? e.price : null,
        currency: typeof e.currency === "string" ? e.currency.slice(0, 8) : undefined,
        artist: typeof e.artist === "string" ? e.artist.slice(0, 200) : undefined,
      }))
  ).slice(0, 200);
}

export async function GET() {
  const customer = await getCurrentCustomer().catch(() => null);
  if (!customer?.id) {
    return NextResponse.json({ signedIn: false, entries: [] });
  }

  try {
    const entries = await listWishlistFor(customer.id);
    return NextResponse.json({ signedIn: true, entries });
  } catch (error) {
    console.error("Failed to read the saved works list", error);
    // The browser copy is still authoritative for this visit.
    return NextResponse.json({ signedIn: true, entries: [], degraded: true });
  }
}

export async function PUT(req: Request) {
  const customer = await getCurrentCustomer().catch(() => null);
  if (!customer?.id) {
    return NextResponse.json(
      { signedIn: false, error: "Sign in to save your list across devices." },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);
  const entries = sanitise((body as { entries?: unknown } | null)?.entries);

  try {
    const stored = await replaceWishlistFor(customer.id, entries);
    return NextResponse.json({ signedIn: true, entries: stored });
  } catch (error) {
    console.error("Failed to store the saved works list", error);
    return NextResponse.json(
      { signedIn: true, error: "We could not save your list right now." },
      { status: 500 }
    );
  }
}
