/**
 * POST /api/store/tax/calculate — GST breakdown for a cart amount.
 *
 * Single source of truth is `lib/tax.ts`: prices are GST-inclusive and the
 * home state comes from `SELLER_HOME_STATE`. The previous implementation
 * hard-coded "MH" as the home state and treated the amount as both paise and
 * rupees, which produced a wrong IGST split on every out-of-state order.
 */

import { NextResponse } from "next/server";
import { getGstRate } from "@/lib/tax-server";
import { calculateTax } from "@/lib/tax";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const amount = Number(body.amount);

    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json(
        { error: "A valid amount (in paise) is required" },
        { status: 400 }
      );
    }

    const breakdown = calculateTax(amount, body.state, {
      gstRate: getGstRate(),
      homeState: process.env.SELLER_HOME_STATE,
    });

    return NextResponse.json({
      ...breakdown,
      tax_rate: breakdown.gst_rate,
      tax_included: true,
      customer_gst: body.customer_gst || null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tax calculation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
