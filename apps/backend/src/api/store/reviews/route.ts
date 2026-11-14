/**
 * Store reviews API.
 *
 * GET  /store/reviews?product_id=...  → approved reviews + rating summary.
 * POST /store/reviews                 → submit a review.
 *
 * Trust model, matching the commissions convention in this codebase: the
 * storefront holds the customer session and passes `customer_id` (it calls
 * Medusa's own `/store/customers/me` with the token, so the reverse route here
 * never sees the session itself). The backend still enforces the parts it can:
 *  - one review per customer per product (unique guard + explicit check),
 *  - real purchase verification against the order module, failing *closed*
 *    (no proof → no verified badge),
 *  - every review starts as "pending" and is only served publicly once a staff
 *    member approves it. A fabricated review therefore never surfaces.
 */

import type { MedusaRequest, MedusaResponse } from "@medusajs/types";

const VALID_ORDER_STATES = new Set([
  "completed",
  "fulfilled",
  "shipped",
  "delivered",
]);

async function GET(req: MedusaRequest, res: MedusaResponse) {
  const reviewService = req.scope.resolve("review") as any;
  const product_id =
    typeof req.query?.product_id === "string" ? req.query.product_id : "";
  if (!product_id) {
    return res.status(400).json({ error: "product_id is required" });
  }

  const [reviews, summary] = await Promise.all([
    reviewService.listPublic(product_id, 20),
    reviewService.summary(product_id),
  ]);
  return res.status(200).json({ reviews, summary });
}

/**
 * Confirm the customer bought this product, from real order data.
 *
 * Lists the customer's orders through the Medusa order module and looks for a
 * paid order whose line items match the product (or variant). Any failure —
 * module not wired, lookup error, no matching order — fails closed and simply
 * leaves the review unverified.
 */
async function confirmPurchase(
  orderModuleService: any,
  customerId: string,
  product_id: string,
  variant_id?: string
): Promise<{ verified: boolean; order_id?: string }> {
  try {
    const result = (await orderModuleService?.listOrders?.(
      { customer_id: [customerId] },
      { relations: ["items"], take: 50 }
    )) ?? { orders: [] };
    const orders: any[] = result.orders ?? [];

    for (const order of orders) {
      const paid =
        order?.payment_status === "captured" ||
        order?.payment_status === "paid" ||
        VALID_ORDER_STATES.has(order?.status);
      if (!paid) continue;

      const items: any[] = order?.items ?? [];
      const matched = items.some(
        (item) =>
          (product_id && item?.product_id === product_id) ||
          (variant_id && item?.variant_id === variant_id)
      );
      if (matched) return { verified: true, order_id: order.id };
    }
    return { verified: false };
  } catch (err) {
    console.error("[review] purchase verification failed", err);
    return { verified: false };
  }
}

async function POST(req: MedusaRequest, res: MedusaResponse) {
  const reviewService = req.scope.resolve("review") as any;
  const orderModuleService = req.scope.resolve("order");

  const body = (req.body as any) ?? {};
  const {
    product_id,
    variant_id,
    customer_id,
    author_name,
    rating,
    title,
    body: reviewBody,
    photos,
  } = body;

  if (!product_id) {
    return res.status(400).json({ error: "product_id is required" });
  }
  if (!customer_id) {
    return res.status(403).json({
      error: "Please sign in with the account you used to purchase.",
    });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Rating must be between 1 and 5" });
  }
  if (!reviewBody || String(reviewBody).trim().length < 5) {
    return res.status(400).json({ error: "Please write a sentence or two." });
  }
  if (String(reviewBody).length > 4000) {
    return res.status(400).json({ error: "Review is too long (4000 chars max)." });
  }

  const already = await reviewService.hasReviewed(product_id, customer_id);
  if (already) {
    return res
      .status(409)
      .json({ error: "You have already reviewed this piece." });
  }

  const purchase = await confirmPurchase(
    orderModuleService,
    customer_id,
    product_id,
    variant_id
  );

  const review = await reviewService.create({
    product_id,
    variant_id: variant_id || undefined,
    customer_id,
    // From the account record, passed by the storefront — never a free-text
    // client field.
    author_name: typeof author_name === "string" ? author_name.slice(0, 60) : null,
    rating: Number(rating),
    title: title ? String(title).slice(0, 120) : undefined,
    body: String(reviewBody).trim(),
    verified: purchase.verified,
    verification_order_id: purchase.order_id,
    photos: Array.isArray(photos) ? photos.slice(0, 3) : undefined,
  });

  return res.status(201).json({
    review: {
      id: review.id,
      product_id: review.product_id,
      rating: review.rating,
      verified: review.verified,
      status: review.status,
    },
  });
}

export { GET, POST };