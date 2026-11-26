/**
 * GET /api/account/orders - Customer lists their orders
 */

import { NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";
import { medusa } from "@/lib/medusa";
import { listAccountOrders } from "@/lib/account-orders";

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

    // Guest orders are not linked to a customer, so they have to be joined by
    // the account's own address — otherwise the one order a new buyer ever
    // placed is the one order the account cannot show.
    const { customer } = await medusa.getCurrentCustomer(token);
    const orders = await listAccountOrders(
      result.orders || [],
      customer?.email || "",
      50
    );

    return NextResponse.json({ orders });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to load orders" },
      { status: 500 }
    );
  }
}
