/**
 * POST /api/internal/notifications
 *
 * Service-to-service endpoint the Medusa backend uses to push realtime
 * notifications to admins. Authenticated with a shared secret, not a user
 * session, because the caller is a backend process.
 *
 * Kept separate from /api/notifications (which requires an admin session) so
 * that route never has to accept a lesser credential.
 */

import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function authorized(header: string | null): boolean {
  const expected = process.env.INTERNAL_NOTIFY_SECRET;
  if (!expected || !header) return false;

  const given = Buffer.from(header);
  const want = Buffer.from(expected);
  if (given.length !== want.length) return false;
  return timingSafeEqual(given, want);
}

export async function POST(req: Request) {
  if (!authorized(req.headers.get("x-internal-secret"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const title = String(body.title || "").trim();
    const message = String(body.message || "").trim();

    if (!title || !message) {
      return NextResponse.json(
        { error: "Title and message are required" },
        { status: 400 }
      );
    }

    const notification = await createNotification({
      audience: body.audience || "admin",
      title,
      message,
      type: body.type || "info",
      link: body.link || null,
    });

    return NextResponse.json({ notification }, { status: 201 });
  } catch (err) {
    console.error("[internal/notifications] failed", err);
    return NextResponse.json({ error: "Could not create" }, { status: 500 });
  }
}
