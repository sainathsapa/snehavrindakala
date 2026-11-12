/**
 * GET /api/admin/notifications
 *
 * Compatibility listing for the admin panel. Delegates to the shared
 * notification store so there is one source of truth — this route previously
 * read a different table than the realtime stream, so the list and the bell
 * could disagree.
 *
 * The realtime stream lives at /api/notifications?stream=1.
 */

import { NextResponse } from "next/server";
import { getAdminIdentity } from "@/app/admin/actions";
import { listNotifications, unreadCount } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const identity = await getAdminIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "20", 10) || 20, 1),
      200
    );
    const audience = searchParams.get("audience") || "admin";

    const [notifications, unread] = await Promise.all([
      listNotifications({ audience, limit }),
      unreadCount(audience),
    ]);

    return NextResponse.json({
      notifications,
      count: notifications.length,
      unread,
    });
  } catch (err) {
    console.error("[admin/notifications] failed", err);
    return NextResponse.json(
      { error: "Could not load notifications" },
      { status: 500 }
    );
  }
}
