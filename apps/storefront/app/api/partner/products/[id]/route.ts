/**
 * /api/partner/products/[id] — one tenant-scoped submission.
 *
 * GET   read a submission (a foreign id returns 404, never the row)
 * PATCH edit a draft/rejected submission, or submit it for approval with
 *       `{ "action": "submit" }`
 *
 * The id is checked together with the session's partner id in the repository,
 * so changing the URL id cannot cross tenants.
 */

import { NextResponse } from "next/server";
import { requirePartnerPermission } from "@/lib/partner/context";
import {
  getProduct,
  submitForApproval,
  updateSubmission,
  ProductNotFoundError,
  ProductStateError,
  ProductValidationError,
  type PartnerProductRow,
  type ProductSubmissionPatch,
} from "@/lib/partner-portal/products";

type RouteContext = { params: Promise<{ id: string }> };

async function readBody(req: Request): Promise<Record<string, unknown> | NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
  }
  const raw = body as Record<string, unknown>;
  if ("partner_id" in raw || "partnerId" in raw) {
    return NextResponse.json(
      { error: "partner_id cannot be supplied by the client; it comes from the session" },
      { status: 400 }
    );
  }
  return raw;
}

function errorResponse(err: any) {
  if (err instanceof ProductNotFoundError) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
  if (err instanceof ProductValidationError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  if (err instanceof ProductStateError) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
  return NextResponse.json({ error: err?.message ?? "Unable to update submission" }, { status: 500 });
}

export async function GET(_req: Request, { params }: RouteContext) {
  const ctx = await requirePartnerPermission("products:read");
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const product = await getProduct(ctx, id);
    if (!product) return NextResponse.json({ error: "Product submission not found" }, { status: 404 });
    return NextResponse.json({ product });
  } catch (err: any) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const ctx = await requirePartnerPermission("products:write");
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await readBody(req);
  if (body instanceof NextResponse) return body;

  const { id } = await params;
  try {
    if (body.action !== undefined && body.action !== "submit") {
      return NextResponse.json({ error: "Unknown action; expected 'submit'" }, { status: 400 });
    }

    let product: PartnerProductRow;
    if (body.action === "submit") {
      product = await submitForApproval(ctx, id);
    } else {
      const patch: ProductSubmissionPatch = {
        ...(typeof body.title === "string" ? { title: body.title } : {}),
        ...(typeof body.description === "string" ? { description: body.description } : {}),
        ...(body.attributes !== undefined ? { attributes: body.attributes as any } : {}),
        ...(body.variants !== undefined ? { variants: body.variants as any } : {}),
        ...(body.pricing !== undefined ? { pricing: body.pricing as any } : {}),
        ...(body.images !== undefined ? { images: body.images as any } : {}),
      };
      product = await updateSubmission(ctx, id, patch);
    }
    return NextResponse.json({ product });
  } catch (err: any) {
    return errorResponse(err);
  }
}
