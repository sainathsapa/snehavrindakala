/**
 * Admin inventory: owner-controlled stock initialisation and reconciliation.
 *
 * No stock count is ever invented. A variant becomes "tracked" only when an
 * authorised admin explicitly supplies on_hand here. GET lists the current
 * state; POST initialises or corrects it; DELETE releases stale holds.
 */

import { NextResponse } from "next/server";
import {
  getAdminIdentity,
  requirePermission,
} from "@/app/admin/actions";
import { recordAdminAction } from "@/lib/audit";
import {
  getStock,
  initialiseStock,
  queryInventory,
  releaseExpiredReservations,
} from "@/lib/inventory";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await requirePermission("inventory:read"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const variantId = searchParams.get("variant_id");
    if (variantId) {
      return NextResponse.json({ stock: await getStock(variantId) });
    }
    return NextResponse.json({ stock: await queryInventory() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!(await requirePermission("inventory:write"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const variantId = String(body.variant_id || "").trim();
    const onHand = Number(body.on_hand);
    if (!variantId || !Number.isInteger(onHand) || onHand < 0) {
      return NextResponse.json(
        { error: "variant_id and a non-negative integer on_hand are required" },
        { status: 400 }
      );
    }
    const stock = await initialiseStock(variantId, onHand);
    const actor = await getAdminIdentity();
    if (actor) {
      await recordAdminAction({
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "inventory.initialise",
        entityType: "variant_stock",
        entityId: variantId,
        newValues: { on_hand: onHand },
      });
    }
    return NextResponse.json({ stock }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE() {
  if (!(await requirePermission("inventory:write"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  try {
    const released = await releaseExpiredReservations();
    return NextResponse.json({ released });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
