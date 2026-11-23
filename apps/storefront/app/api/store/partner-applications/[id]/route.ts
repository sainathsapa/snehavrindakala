/**
 * GET /api/store/partner-applications/[id]
 *
 * Public, read-only status lookup keyed by the opaque application reference
 * returned at submission time. The response is deliberately restricted to the
 * allow-listed public status fields plus a friendly message — it never includes
 * contact details, documents, internal reviewer identity, or any partner/tenant
 * data belonging to someone else.
 */

import { NextResponse } from "next/server";
import {
  getApplicationStatus,
  statusMessage,
} from "@/lib/partner-onboarding/status";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let id: string;
  try {
    ({ id } = await params);
  } catch {
    id = "";
  }

  if (!id || typeof id !== "string" || id.trim().length === 0) {
    return NextResponse.json(
      { error: "Application not found." },
      { status: 404, headers: NO_STORE }
    );
  }

  try {
    const status = await getApplicationStatus(id);

    if (!status) {
      return NextResponse.json(
        { error: "Application not found." },
        { status: 404, headers: NO_STORE }
      );
    }

    return NextResponse.json(
      {
        ...status,
        message: statusMessage(status.review_status, status.review_notes),
      },
      { status: 200, headers: NO_STORE }
    );
  } catch (err) {
    console.error("Failed to look up partner application status", err);
    return NextResponse.json(
      {
        error:
          "Could not check your application status right now. Please try again.",
      },
      { status: 500, headers: NO_STORE }
    );
  }
}
