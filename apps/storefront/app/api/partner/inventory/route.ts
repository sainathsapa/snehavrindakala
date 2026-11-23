/**
 * Partner inventory API — read-only, tenant scoped.
 *
 * GET requires `inventory:read`. Every row is scoped by `ctx.partnerId`, which
 * comes from the verified session via `requirePartnerPermission`; no partner id
 * is read from the query string, body or headers.
 *
 * PATCH is intentionally OMITTED. Releasing a reservation mutates a live customer
 * hold and the corresponding `variant_stock.reserved` counter. The only release
 * primitive (`releaseReservation` in `lib/inventory.ts`) is not tenant scoped,
 * and a "check ownership, then release" wrapper would be a time-of-check /
 * time-of-use race across two statements. A partner has no legitimate need to
 * mutate a shopper's hold — that belongs to checkout and the cron sweep. This
 * route therefore exposes reads only. (A future safe write would need a single
 * tenant-scoped UPDATE inside the same transaction as the stock counter change.)
 */

import { NextResponse } from "next/server";
import { requirePartnerPermission } from "@/lib/partner/context";
import {
  getStockExceptions,
  listPartnerInventory,
  summariseInventory,
} from "@/lib/partner-portal/inventory";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requirePartnerPermission("inventory:read");
  if (!ctx) {
    return NextResponse.json(
      { error: "Not authorised to read partner inventory" },
      { status: 401 }
    );
  }

  try {
    const [rows, exceptions] = await Promise.all([
      listPartnerInventory(ctx),
      getStockExceptions(ctx),
    ]);
    return NextResponse.json({
      rows,
      exceptions,
      summary: summariseInventory(rows),
    });
  } catch (err) {
    console.error("[partner inventory] failed to load", err);
    return NextResponse.json(
      { error: "Unable to load inventory" },
      { status: 500 }
    );
  }
}
