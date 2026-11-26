/**
 * POST /api/store/shipping/rates - Get available shipping rates for a delivery address
 */

import { NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { getShippingRates } from "@/lib/shipping/shiprocket";

export async function POST(req: Request) {
  // Public endpoint: bound it per IP so one caller cannot use it as a free
  // proxy for our own costs (courier quotes, payment orders, file uploads).
  const limit = await checkRateLimit({
    route: "shipping-rates",
    ip: clientIp(req.headers),
    limit: 30,
    windowSeconds: 60,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  try {
    const body = await req.json();
    const {
      pickup_postcode,
      delivery_postcode,
      weight,
      cod,
    } = body;

    if (!delivery_postcode) {
      return NextResponse.json(
        { error: "Delivery postcode required" },
        { status: 400 }
      );
    }

    const rates = await getShippingRates({
      pickup_postcode: pickup_postcode || "560001",
      delivery_postcode,
      weight: weight || 1,
      cod: cod ?? true,
    });

    return NextResponse.json({ rates });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch shipping rates" },
      { status: 500 }
    );
  }
}
