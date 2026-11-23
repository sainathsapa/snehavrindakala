/**
 * POST /api/store/partner-applications
 *
 * Public endpoint: a maker submits an application to become a marketplace
 * partner. The application is always created with `review_status = 'pending'`;
 * no value from the request body is allowed to influence that decision.
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { validateApplication } from "@/lib/partner-onboarding/validation";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = validateApplication(body);
  if (!result.ok || !result.value) {
    return NextResponse.json(
      { error: "Validation failed", errors: result.errors },
      { status: 400 }
    );
  }

  const value = result.value;

  try {
    const rows = await query(
      `INSERT INTO partner_onboarding_application
         (legal_name, display_name, contact_email, contact_phone,
          business_details, artist_information, product_categories,
          document_keys, review_status)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, 'pending')
       RETURNING id`,
      [
        value.legal_name,
        value.display_name,
        value.contact_email,
        value.contact_phone,
        JSON.stringify(value.business_details),
        JSON.stringify(value.artist_information),
        JSON.stringify(value.product_categories),
        JSON.stringify(value.document_keys),
      ]
    );

    const id = rows?.[0]?.id;
    if (!id) {
      throw new Error("Insert did not return an application id");
    }

    // The status is a server decision, never an echo of the request body.
    return NextResponse.json({ id, status: "pending" }, { status: 201 });
  } catch (err: any) {
    console.error("Failed to create partner application", err);
    return NextResponse.json(
      { error: "Could not submit application. Please try again later." },
      { status: 500 }
    );
  }
}
