/**
 * /api/partner/products — tenant-scoped product submissions.
 *
 * GET  list the authenticated partner's submissions
 * POST create a draft submission
 *
 * Tenant identity is resolved server-side by `requirePartnerPermission`. A
 * `partner_id` (or `partnerId`) supplied by the client is rejected outright —
 * ownership is never accepted from a request body.
 */

import { NextResponse } from "next/server";
import { requirePartnerPermission } from "@/lib/partner/context";
import {
  createSubmission,
  listProducts,
  ProductValidationError,
  type ProductSubmissionInput,
} from "@/lib/partner-portal/products";

export async function GET() {
  const ctx = await requirePartnerPermission("products:read");
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const products = await listProducts(ctx);
    return NextResponse.json({ products });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unable to list products" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const ctx = await requirePartnerPermission("products:write");
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Submission must be an object" }, { status: 400 });
  }
  const raw = body as Record<string, unknown>;
  if ("partner_id" in raw || "partnerId" in raw) {
    return NextResponse.json(
      { error: "partner_id cannot be supplied by the client; it comes from the session" },
      { status: 400 }
    );
  }

  // Whitelist only submission fields; nothing else from the body is forwarded.
  const input: ProductSubmissionInput = {
    ...(typeof raw.title === "string" ? { title: raw.title } : {}),
    ...(typeof raw.description === "string" ? { description: raw.description } : {}),
    ...(raw.productId !== undefined ? { productId: raw.productId as string } : {}),
    ...(raw.attributes !== undefined ? { attributes: raw.attributes as any } : {}),
    ...(raw.variants !== undefined ? { variants: raw.variants as any } : {}),
    ...(raw.pricing !== undefined ? { pricing: raw.pricing as any } : {}),
    ...(raw.images !== undefined ? { images: raw.images as any } : {}),
  };

  try {
    const product = await createSubmission(ctx, input);
    return NextResponse.json({ product }, { status: 201 });
  } catch (err: any) {
    if (err instanceof ProductValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: err?.message ?? "Unable to create submission" }, { status: 500 });
  }
}
