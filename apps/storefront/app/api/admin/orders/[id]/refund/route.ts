/**
 * POST /api/admin/orders/[id]/refund - Refund an order
 * GET /api/admin/orders/[id]/refund - List refunds for an order
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getAdminIdentity, requireAdmin } from "@/app/admin/actions";
import { getSystemAdminToken } from "@/lib/admin";
import {
  createRefundRequest,
  listRefundsForOrder,
  refundApprovalThreshold,
} from "@/lib/refund-approvals";



async function adminFetch(
  backendUrl: string,
  publishableKey: string,
  path: string,
  options: RequestInit = {}
) {
  const token = await getSystemAdminToken();
  const headers = new Headers(options.headers);
  headers.set("x-publishable-api-key", publishableKey);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${backendUrl}${path}`, { ...options, headers });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Who asked matters as much as what was asked for: the same person cannot
  // both request and release a large refund.
  const identity = await getAdminIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await req.json();
    const { amount, reason } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Valid refund amount required" },
        { status: 400 }
      );
    }

    // Fetch the order to get the refundable total
    const BACKEND_URL =
      process.env.MEDUSA_BACKEND_URL ||
      process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
      "http://localhost:9000";
    const PUBLISHABLE_KEY =
      process.env.MEDUSA_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
      "";

    const orderRes = await adminFetch(
      BACKEND_URL,
      PUBLISHABLE_KEY,
      `/admin/orders/${id}?fields=id,total,refundable_total`
    );

    if (!orderRes.ok) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    const orderData = await orderRes.json();
    const order = orderData.order ?? orderData;
    const refundableTotal = order.refundable_total ?? order.total ?? 0;

    // Calculate sum of existing completed/pending refunds
    await query(`
      CREATE TABLE IF NOT EXISTS order_refunds (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        reason TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    const existing = await query(
      // Approved (awaiting release) and completed both still hold money, so
      // both count against the refundable total. Rejected rows do not.
      "SELECT COALESCE(SUM(amount), 0) as total FROM order_refunds WHERE order_id = $1 AND status IN ('pending', 'approved', 'completed')",
      [id]
    );
    const alreadyRefunded = Number(existing[0]?.total ?? 0);

    const remainingRefundable = refundableTotal - alreadyRefunded;

    if (amount > remainingRefundable) {
      return NextResponse.json(
        {
          error: `Refund amount exceeds remaining refundable total of ${(remainingRefundable / 100).toFixed(2)}`,
          refundable_total: refundableTotal,
          already_refunded: alreadyRefunded,
          remaining_refundable: remainingRefundable,
        },
        { status: 400 }
      );
    }

    // One gate for every refund, large or small. Below the threshold it is
    // approved on the spot and says so; at or above it waits for a second
    // admin. Either way the row records who asked.
    const created = await createRefundRequest({
      orderId: id,
      amount,
      reason: reason || "",
      actor: identity.email,
    });

    return NextResponse.json(
      {
        ...created,
        // The storefront cannot issue money yet; saying nothing here is how
        // "refund created" gets read as "money is on its way".
        note: "Recorded. The refund is released from the payments dashboard.",
        threshold: refundApprovalThreshold(),
      },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;

    const refunds = await listRefundsForOrder(id);
    return NextResponse.json({ refunds });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
