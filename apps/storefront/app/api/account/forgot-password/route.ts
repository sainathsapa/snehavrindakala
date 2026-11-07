/**
 * POST /api/account/forgot-password - Send a password reset link (placeholder)
 */

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    // Placeholder: In production, integrate with SES/SMTP to send a reset link.
    // For now, always return success to avoid email enumeration.
    return NextResponse.json({ ok: true, message: "Reset link sent if account exists" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
