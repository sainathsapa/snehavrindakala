/**
 * Partner product submissions — tenant-safe data access + approval workflow.
 *
 * SERVER ONLY. Every query goes through `tenantQuery`, which requires the
 * `{partner}` token and binds `ctx.partnerId` itself. There is deliberately no
 * parameter through which a caller could supply a partner id: the tenant comes
 * from the verified session, never from a request body, query or header.
 *
 * Schema note: `partner_product` has no title/description/variants columns.
 * The submission payload lives in the `attributes` jsonb column (see migration
 * 002). Image *references* (URLs returned by the existing admin upload API)
 * are stored there too — this module never stores or handles file bytes.
 */

import { randomUUID } from "crypto";
import type { PartnerContext } from "@/lib/partner/types";
import { tenantQuery, type QueryExecutor } from "@/lib/partner/repository";

export type SubmissionStatus = "draft" | "submitted" | "approved" | "rejected";

/** The only states a partner is allowed to change. Approval is admin-owned. */
export const EDITABLE_STATUSES: readonly SubmissionStatus[] = ["draft", "rejected"];

export const SUBMISSION_STATUS_LABELS: Record<SubmissionStatus, string> = {
  draft: "Draft",
  submitted: "Submitted for review",
  approved: "Approved",
  rejected: "Changes requested",
};

export interface ProductImageRef {
  url: string;
  alt?: string;
}

/** The shape persisted in `partner_product.attributes`. */
export interface ProductDetails {
  title: string;
  description: string;
  /** Free-form maker attributes (material, dimensions, finish, …). */
  attributes: Record<string, unknown>;
  variants: Array<Record<string, unknown>>;
  pricing: Record<string, unknown>;
  /** URLs from the existing upload API only — never base64/file bytes. */
  images: ProductImageRef[];
}

export interface PartnerProductRow {
  id: string;
  partner_id: string;
  product_id: string;
  submission_status: SubmissionStatus;
  attributes: ProductDetails | Record<string, unknown> | string;
  rejection_reason: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductSubmissionInput {
  /**
   * Optional Medusa product id this submission refers to. When absent the row
   * gets a clearly-marked internal reference (`pending:…`) so no real Medusa id
   * is invented. This value is never used to identify the tenant.
   */
  productId?: string;
  title: string;
  description?: string;
  attributes?: Record<string, unknown>;
  variants?: Array<Record<string, unknown>>;
  pricing?: Record<string, unknown>;
  images?: Array<string | ProductImageRef>;
}

/** A product reference cannot be changed by a partner after creation. */
export type ProductSubmissionPatch = Partial<Omit<ProductSubmissionInput, "productId">>;

/* ── Errors mapped to HTTP statuses by the route handlers ───────────────── */

export class ProductValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductValidationError";
  }
}

export class ProductNotFoundError extends Error {
  constructor(message = "Product submission not found.") {
    super(message);
    this.name = "ProductNotFoundError";
  }
}

export class ProductStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductStateError";
  }
}

/* ── Validation / normalisation ──────────────────────────────────────────── */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function trimmedString(value: unknown, field: string, max: number): string {
  if (typeof value !== "string") {
    throw new ProductValidationError(`${field} must be text.`);
  }
  const out = value.trim();
  if (out.length > max) {
    throw new ProductValidationError(`${field} must be at most ${max} characters.`);
  }
  return out;
}

function optionalString(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return trimmedString(value, field, max);
}

function normalizeImages(value: unknown): ProductImageRef[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 20) {
    throw new ProductValidationError("Images must be a list of at most 20 URLs.");
  }
  return value.map((item, index) => {
    const ref = typeof item === "string" ? { url: item } : item;
    if (!isPlainObject(ref)) {
      throw new ProductValidationError(`Image ${index + 1} must be a URL or an object with a url.`);
    }
    const url = trimmedString(ref.url, `Image ${index + 1} URL`, 2000);
    // Only web URLs or site-relative paths from the existing upload API.
    // `data:`/`javascript:` and other schemes cannot be accepted here.
    if (!(url.startsWith("/") || /^https?:\/\//i.test(url))) {
      throw new ProductValidationError(`Image ${index + 1} must be an http(s) URL or a site path.`);
    }
    const alt = optionalString(ref.alt, `Image ${index + 1} alt text`, 300);
    return alt ? { url, alt } : { url };
  });
}

function normalizeAttributes(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) return {};
  if (!isPlainObject(value)) {
    throw new ProductValidationError("Attributes must be a JSON object.");
  }
  return { ...value };
}

function normalizeVariants(value: unknown): Array<Record<string, unknown>> {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 100) {
    throw new ProductValidationError("Variants must be a list of at most 100 objects.");
  }
  return value.map((item, index) => {
    if (!isPlainObject(item)) {
      throw new ProductValidationError(`Variant ${index + 1} must be a JSON object.`);
    }
    return { ...item };
  });
}

function normalizePricing(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) return {};
  if (!isPlainObject(value)) {
    throw new ProductValidationError("Pricing must be a JSON object.");
  }
  if (value.amount !== undefined && value.amount !== null && value.amount !== "") {
    const amount = Number(value.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new ProductValidationError("Pricing amount must be a non-negative number.");
    }
    return { ...value, amount };
  }
  return { ...value };
}

function normalizeCreate(input: unknown): { productId: string; details: ProductDetails } {
  if (!isPlainObject(input)) {
    throw new ProductValidationError("Submission must be an object.");
  }
  // Whitelist: `partner_id` (or any other tenant/ownership field) in the input
  // is never read, never bound and never written. Tenant comes from ctx only.
  const title = trimmedString(input.title, "Title", 200);
  if (!title) throw new ProductValidationError("Title is required.");

  const productId =
    optionalString(input.productId, "Product reference", 128) ?? `pending:${randomUUID()}`;

  return {
    productId,
    details: {
      title,
      description: optionalString(input.description, "Description", 5000) ?? "",
      attributes: normalizeAttributes(input.attributes),
      variants: normalizeVariants(input.variants),
      pricing: normalizePricing(input.pricing),
      images: normalizeImages(input.images),
    },
  };
}

/** Read the jsonb payload defensively (pg returns objects; tests may use strings). */
export function readProductDetails(
  source: PartnerProductRow | { attributes: unknown } | null | undefined
): ProductDetails {
  const raw = source?.attributes;
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }
  }
  const value = isPlainObject(parsed) ? parsed : {};
  return {
    title: typeof value.title === "string" ? value.title : "Untitled submission",
    description: typeof value.description === "string" ? value.description : "",
    attributes: isPlainObject(value.attributes) ? value.attributes : {},
    variants: Array.isArray(value.variants) ? (value.variants as Array<Record<string, unknown>>) : [],
    pricing: isPlainObject(value.pricing) ? value.pricing : {},
    images: Array.isArray(value.images) ? (value.images as ProductImageRef[]) : [],
  };
}

function applyPatch(
  base: ProductDetails,
  patch: ProductSubmissionPatch
): ProductDetails {
  if (!isPlainObject(patch)) {
    throw new ProductValidationError("Update must be an object.");
  }
  const next: ProductDetails = {
    title: base.title,
    description: base.description,
    attributes: { ...base.attributes },
    variants: [...base.variants],
    pricing: { ...base.pricing },
    images: [...base.images],
  };

  // Again a whitelist: no partner id / ownership field can reach the UPDATE.
  if (patch.title !== undefined) {
    const title = trimmedString(patch.title, "Title", 200);
    if (!title) throw new ProductValidationError("Title is required.");
    next.title = title;
  }
  if (patch.description !== undefined) {
    next.description = optionalString(patch.description, "Description", 5000) ?? "";
  }
  if (patch.attributes !== undefined) {
    next.attributes = { ...next.attributes, ...normalizeAttributes(patch.attributes) };
  }
  if (patch.variants !== undefined) next.variants = normalizeVariants(patch.variants);
  if (patch.pricing !== undefined) {
    next.pricing = { ...next.pricing, ...normalizePricing(patch.pricing) };
  }
  if (patch.images !== undefined) next.images = normalizeImages(patch.images);
  return next;
}

/* ── Tenant-scoped queries ───────────────────────────────────────────────── */

const LIST_SQL =
  "SELECT * FROM partner_product WHERE partner_id = {partner} " +
  "ORDER BY created_at DESC LIMIT 200";

const GET_SQL =
  "SELECT * FROM partner_product WHERE id = $1 AND partner_id = {partner} LIMIT 1";

const INSERT_SQL =
  "INSERT INTO partner_product " +
  "(partner_id, product_id, submission_status, attributes, created_at, updated_at) " +
  "VALUES ({partner}, $1, 'draft', $2::jsonb, now(), now()) RETURNING *";

const UPDATE_SQL =
  "UPDATE partner_product SET attributes = $1::jsonb, updated_at = now() " +
  "WHERE id = $2 AND partner_id = {partner} " +
  "AND submission_status IN ('draft','rejected') RETURNING *";

const SUBMIT_SQL =
  "UPDATE partner_product SET submission_status = 'submitted', submitted_at = now(), " +
  "rejection_reason = NULL, updated_at = now() " +
  "WHERE id = $1 AND partner_id = {partner} " +
  "AND submission_status IN ('draft','rejected') RETURNING *";

function requireId(id: unknown): string {
  if (typeof id !== "string" || !id.trim() || id.length > 128) {
    throw new ProductValidationError("A valid product submission id is required.");
  }
  return id.trim();
}

export function listProducts(
  ctx: PartnerContext,
  ex?: QueryExecutor
): Promise<PartnerProductRow[]> {
  return tenantQuery<PartnerProductRow>(ctx, LIST_SQL, [], ex);
}

export async function getProduct(
  ctx: PartnerContext,
  id: string,
  ex?: QueryExecutor
): Promise<PartnerProductRow | null> {
  const rows = await tenantQuery<PartnerProductRow>(ctx, GET_SQL, [requireId(id)], ex);
  return rows[0] ?? null;
}

/**
 * Create a draft submission. The partner id is bound by `tenantQuery` from ctx;
 * a `partner_id` key in `input` is discarded by the whitelist above.
 */
export async function createSubmission(
  ctx: PartnerContext,
  input: ProductSubmissionInput,
  ex?: QueryExecutor
): Promise<PartnerProductRow> {
  const { productId, details } = normalizeCreate(input);
  const rows = await tenantQuery<PartnerProductRow>(
    ctx,
    INSERT_SQL,
    [productId, JSON.stringify(details)],
    ex
  );
  const row = rows[0];
  if (!row) throw new Error("Product submission insert did not return a row.");
  return row;
}

/** Edit a draft/rejected submission. Approved/submitted rows are immutable here. */
export async function updateSubmission(
  ctx: PartnerContext,
  id: string,
  patch: ProductSubmissionPatch,
  ex?: QueryExecutor
): Promise<PartnerProductRow> {
  const productId = requireId(id);
  const current = await getProduct(ctx, productId, ex);
  if (!current) throw new ProductNotFoundError();
  if (!EDITABLE_STATUSES.includes(current.submission_status)) {
    throw new ProductStateError("Only draft or rejected submissions can be edited.");
  }

  const next = applyPatch(readProductDetails(current), patch);
  const rows = await tenantQuery<PartnerProductRow>(
    ctx,
    UPDATE_SQL,
    [JSON.stringify(next), productId],
    ex
  );
  const row = rows[0];
  if (!row) throw new ProductStateError("This submission is no longer editable.");
  return row;
}

/** Move a draft/rejected submission into the admin review queue. */
export async function submitForApproval(
  ctx: PartnerContext,
  id: string,
  ex?: QueryExecutor
): Promise<PartnerProductRow> {
  const productId = requireId(id);
  const current = await getProduct(ctx, productId, ex);
  if (!current) throw new ProductNotFoundError();
  if (!EDITABLE_STATUSES.includes(current.submission_status)) {
    throw new ProductStateError("Only draft or rejected submissions can be submitted.");
  }

  const rows = await tenantQuery<PartnerProductRow>(ctx, SUBMIT_SQL, [productId], ex);
  const row = rows[0];
  if (!row) throw new ProductStateError("This submission is no longer editable.");
  return row;
}
