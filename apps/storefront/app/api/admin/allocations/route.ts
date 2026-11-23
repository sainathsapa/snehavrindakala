/**
 * POST /api/admin/allocations — manually assign a customer order's items to
 * partners. One parent order, one fulfilment group per partner.
 * GET  /api/admin/allocations — the unassigned/pending allocation queue.
 *
 * Admin-only: a partner can never call these. Partner ids in the body are an
 * explicit admin decision and are validated against the partner table before
 * any write; they are never treated as an authenticated partner context.
 */

import { NextResponse } from "next/server";
import { requirePermission, getAdminIdentity } from "@/app/admin/actions";
import { findPartnerById } from "@/lib/partner/repository";
import {
  allocateItemsToPartners,
  assertNoDuplicateAllocation,
  getUnassignedItems,
} from "@/lib/fulfilment/allocate";
import {
  createAllocations,
  listAllocationQueue,
  listGroupsForOrder,
  FulfilmentError,
} from "@/lib/fulfilment/store";
import type { FulfilmentLineItem } from "@/lib/fulfilment/types";

function errorResponse(err: unknown) {
  const code = err instanceof FulfilmentError ? err.code : "ERROR";
  const status = code === "INVALID_TRANSITION" ? 409 : 400;
  return NextResponse.json(
    { error: err instanceof Error ? err.message : "Invalid request", code },
    { status }
  );
}

export async function GET(req: Request) {
  if (!(await requirePermission("orders:read"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const orderId = new URL(req.url).searchParams.get("orderId")?.trim();
    const groups = orderId
      ? await listGroupsForOrder(orderId)
      : await listAllocationQueue();
    return NextResponse.json({
      groups,
      // Groups still awaiting a partner to accept are the admin work queue.
      unassigned: groups.filter((g) => g.status === "assigned"),
      count: groups.length,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  if (!(await requirePermission("orders:write"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const customerOrderId =
      typeof body.customerOrderId === "string" ? body.customerOrderId.trim() : "";
    if (!customerOrderId) {
      return NextResponse.json(
        { error: "customerOrderId is required" },
        { status: 400 }
      );
    }

    const rawItems = Array.isArray(body.items) ? body.items : [];
    const items: FulfilmentLineItem[] = [];
    for (const raw of rawItems) {
      if (!raw || typeof raw.item_id !== "string" || !raw.item_id) {
        return NextResponse.json(
          { error: "Every item needs an item_id" },
          { status: 400 }
        );
      }
      const quantity = Number(raw.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        return NextResponse.json(
          { error: `Invalid quantity for item ${raw.item_id}` },
          { status: 400 }
        );
      }
      items.push({
        item_id: raw.item_id,
        product_id:
          typeof raw.product_id === "string" ? raw.product_id : null,
        variant_id:
          typeof raw.variant_id === "string" ? raw.variant_id : null,
        quantity,
        title: typeof raw.title === "string" ? raw.title : undefined,
        order_id: customerOrderId,
      });
    }
    if (items.length === 0) {
      return NextResponse.json({ error: "No items to allocate" }, { status: 400 });
    }

    const map: Record<string, string> = {
      ...(isRecord(body.productPartnerMap) ? body.productPartnerMap : {}),
      ...(isRecord(body.assignments) ? body.assignments : {}),
    };
    const stillUnassigned = getUnassignedItems(items, map);
    if (stillUnassigned.length > 0) {
      return NextResponse.json(
        {
          error: "Some items have no owning partner",
          unassignedProductIds: Array.from(
            new Set(
              stillUnassigned
                .map((i) => i.product_id)
                .filter((p): p is string => Boolean(p))
            )
          ),
        },
        { status: 400 }
      );
    }

    const groups = allocateItemsToPartners(items, map);
    assertNoDuplicateAllocation(groups);
    if (groups.length === 0) {
      return NextResponse.json({ error: "No partners resolved" }, { status: 400 });
    }

    for (const partnerId of Array.from(new Set(groups.map((g) => g.partner_id)))) {
      const partner = await findPartnerById(partnerId);
      if (!partner || partner.account_status !== "active") {
        return NextResponse.json(
          { error: `Unknown or inactive partner: ${partnerId}` },
          { status: 400 }
        );
      }
    }

    const identity = await getAdminIdentity();
    const inserted = await createAllocations(
      customerOrderId,
      groups,
      undefined,
      identity?.email ?? "platform-admin"
    );
    return NextResponse.json(
      { customerOrderId, groups: inserted, created: inserted.length },
      { status: 201 }
    );
  } catch (err) {
    return errorResponse(err);
  }
}

function isRecord(value: unknown): value is Record<string, string> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
