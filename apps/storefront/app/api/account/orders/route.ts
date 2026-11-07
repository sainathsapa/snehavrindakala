/**
 * GET /api/account/orders - Customer lists their orders
 */

import { NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import { medusa } from "@/lib/medusa";

export async function GET(req: Request) {
  try {
    const token = await getAuthToken();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await medusa.listCustomerOrders(token, {
      limit: 50,
      offset: 0,
    });

    return NextResponse.json({ orders: result.orders || [] });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load orders" },
      { status: 500 }
    );
  }
}
