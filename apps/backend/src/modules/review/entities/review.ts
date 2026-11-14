/**
 * Product review (DML).
 *
 * `created_at` / `updated_at` are implicitly defined on every DML model, so
 * they are intentionally not declared here — declaring them throws at module
 * load. The migration still creates the columns; MikroORM manages them.
 */
import { model } from "@medusajs/utils";

export type ReviewStatus = "pending" | "approved" | "rejected";

export const Review = model.define("product_review", {
  id: model.text().primaryKey(),
  product_id: model.text(),
  variant_id: model.text().nullable(),
  customer_id: model.text().nullable(),
  /** Display name shown publicly. Comes from the account, not free text. */
  author_name: model.text().nullable(),
  rating: model.number(),
  title: model.text().nullable(),
  body: model.text(),
  /** True when the backend confirmed a completed purchase of this product. */
  verified: model.boolean().default(false),
  /** The order id used to confirm the purchase, for staff reference. */
  verification_order_id: model.text().nullable(),
  /** Private photo storage keys, up to 3. Never served publicly. */
  photos: model.json().nullable(),
  status: model.text().default("pending"),
  admin_note: model.text().nullable(),
});