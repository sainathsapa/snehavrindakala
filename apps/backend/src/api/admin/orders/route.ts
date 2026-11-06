/**
 * GET /admin/orders
 *
 * Admin order work queue (build plan Section 9.2). Lists orders with their
 * payment/fulfilment/exception state so operations can action them.
 *
 * Integration boundary: resolves the Medusa order module service from the
 * container. Returns 501 documenting what is required until the order service
 * is wired.
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/types";

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const scope = req.scope;
  const orderModuleService = scope.resolve("orderModuleService") as any;

  if (!orderModuleService) {
    res.status(501).json({
      error: "Admin order queue not wired. Resolve orderModuleService in the Medusa container.",
    });
    return;
  }

  try {
    const { offset = 0, limit = 50 } = (req.query as unknown) as {
      offset?: string;
      limit?: string;
    };
    let orders: any;
    if (typeof orderModuleService.listOrders === "function") {
      orders = await orderModuleService.listOrders({
        offset: Number(offset),
        limit: Number(limit),
      });
    } else if (typeof orderModuleService.retrieveOrders === "function") {
      orders = await orderModuleService.retrieveOrders({
        offset: Number(offset),
        limit: Number(limit),
      });
    } else {
      res.status(501).json({
        error: "Order module service exposes no listOrders/retrieveOrders method.",
      });
      return;
    }

    res.status(200).json({
      orders: orders?.orders ?? orders ?? [],
      count: orders?.count ?? (Array.isArray(orders) ? orders.length : 0),
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to load orders.",
    });
  }
  return;
}
