/**
 * GET  /api/notifications       — Server-Sent Events stream
 * POST /api/notifications       — create a notification (admin only)
 *
 * Rewritten. The previous version ignored the result of requireAdmin() (so it
 * was effectively public), inserted into a column the table did not have (so
 * every create failed), and fanned out through an in-process Map (so realtime
 * only worked on a single instance).
 *
 * Delivery is now LISTEN/NOTIFY through Postgres, which works behind a load
 * balancer with any number of instances.
 */

import { NextResponse } from "next/server";
import { getAdminIdentity } from "@/app/admin/actions";
import {
  createNotification,
  listNotifications,
  subscribe,
  unreadCount,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";
// Streaming responses must not be buffered or run on the edge runtime.
export const runtime = "nodejs";

const HEARTBEAT_MS = 25_000;

export async function GET(req: Request) {
  const identity = await getAdminIdentity();
  if (!identity) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const wantsStream = url.searchParams.get("stream") === "1";
  const audience = url.searchParams.get("audience") || "admin";

  // Plain JSON listing for the bell, diffing and one-off loads.
  if (!wantsStream) {
    try {
      const [notifications, unread] = await Promise.all([
        listNotifications({ audience, limit: 50 }),
        unreadCount(audience),
      ]);
      return NextResponse.json({ notifications, unread });
    } catch (err) {
      console.error("[notifications] list failed", err);
      return NextResponse.json(
        { error: "Could not load notifications" },
        { status: 500 }
      );
    }
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          // The client went away between the check and the write.
          closed = true;
        }
      };

      const close = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe?.();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };

      // Acknowledge immediately so the browser fires `onopen` and the client
      // can show a live state instead of appearing stuck.
      send("ready", { audience });

      try {
        const [notifications, unread] = await Promise.all([
          listNotifications({ audience, limit: 50 }),
          unreadCount(audience),
        ]);
        send("init", { notifications, unread });
      } catch (err) {
        console.error("[notifications] initial load failed", err);
        send("error", { message: "Could not load notifications" });
      }

      unsubscribe = await subscribe((notification) => {
        // `*` is broadcast to every audience.
        if (
          notification.audience !== audience &&
          notification.audience !== "*"
        ) {
          return;
        }
        send("notification", notification);
      });

      // Keeps proxies from closing an idle connection, and detects a dead
      // client so the subscription does not leak.
      heartbeat = setInterval(() => {
        if (req.signal.aborted) {
          close();
          return;
        }
        send("ping", { t: Date.now() });
      }, HEARTBEAT_MS);

      req.signal.addEventListener("abort", close);
    },

    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe?.();
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable proxy buffering (nginx) so events arrive immediately.
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(req: Request) {
  const identity = await getAdminIdentity();
  if (!identity) {
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
    console.error("[notifications] create failed", err);
    return NextResponse.json(
      { error: "Could not create notification" },
      { status: 500 }
    );
  }
}
