/**
 * POST /api/admin/bulk/orders - Bulk update order status
 * POST /api/admin/bulk/products - Bulk update/delete products
 * POST /api/admin/bulk/partners - Bulk enable/disable partners
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/admin/actions";

async function adminFetch(
  backendUrl: string,
  publishableKey: string,
  path: string,
  options: RequestInit = {}
) {
  const headers = new Headers(options.headers);
  headers.set("x-publishable-api-key", publishableKey);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`${backendUrl}${path}`, { ...options, headers });
}

export async function POST(req: Request) {
  await requireAdmin();
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "orders";
    const body = await req.json();
    const { ids, action, data } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No IDs provided" }, { status: 400 });
    }

    const BACKEND_URL =
      process.env.MEDUSA_BACKEND_URL ||
      process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
      "http://localhost:9000";
    const PUBLISHABLE_KEY =
      process.env.MEDUSA_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
      "";

    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const id of ids) {
      try {
        let res: Response;

        if (type === "orders" && action === "update_status") {
          res = await adminFetch(
            BACKEND_URL,
            PUBLISHABLE_KEY,
            `/admin/orders/${id}`,
            {
              method: "POST",
              body: JSON.stringify({ status: data.status }),
            }
          );
        } else if (type === "products" && action === "update_status") {
          res = await adminFetch(
            BACKEND_URL,
            PUBLISHABLE_KEY,
            `/admin/products/${id}`,
            {
              method: "POST",
              body: JSON.stringify({ status: data.status }),
            }
          );
        } else if (type === "products" && action === "delete") {
          res = await adminFetch(
            BACKEND_URL,
            PUBLISHABLE_KEY,
            `/admin/products/${id}`,
            { method: "DELETE" }
          );
        } else if (type === "partners" && action === "update_status") {
          res = await adminFetch(
            BACKEND_URL,
            PUBLISHABLE_KEY,
            `/admin/artists/${id}/toggle-status`,
            {
              method: "PATCH",
              body: JSON.stringify({ enabled: data.enabled }),
            }
          );
        } else {
          results.push({ id, success: false, error: "Unsupported action" });
          continue;
        }

        if (res.ok) {
          results.push({ id, success: true });
        } else {
          const errText = await res.text();
          results.push({ id, success: false, error: errText });
        }
      } catch (err: any) {
        results.push({ id, success: false, error: err.message });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    return NextResponse.json({
      success: true,
      total: results.length,
      succeeded: successCount,
      failed: results.length - successCount,
      results,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
