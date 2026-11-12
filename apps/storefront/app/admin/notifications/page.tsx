"use client";

/**
 * Admin notifications feed.
 *
 * Live over SSE: new orders, commission requests and refunds appear without a
 * refresh. Reads go through the same hook as the header bell, so read state is
 * shared and consistent instead of the two views disagreeing.
 */

import { useRealtimeNotifications } from "@/lib/hooks/use-realtime-notifications";

const TYPE_BADGES: Record<string, { label: string; className: string }> = {
  info: { label: "Info", className: "bg-peacock/10 text-peacock" },
  success: { label: "Done", className: "bg-leaf/10 text-leaf" },
  warning: { label: "Action", className: "bg-marigold/15 text-terracotta" },
  error: { label: "Issue", className: "bg-sindoor/10 text-sindoor" },
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationsPage() {
  const { notifications, unread, connected, markRead, markAllRead } =
    useRealtimeNotifications("admin");

  return (
    <main className="py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl font-bold text-deep-ink">
              Notifications
            </h1>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted-ink font-sans">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  connected ? "bg-leaf" : "bg-sand-border"
                }`}
                aria-hidden="true"
              />
              {connected ? "Live" : "Reconnecting…"}
              {unread > 0 && <span>· {unread} unread</span>}
            </p>
          </div>

          {unread > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="rounded-md border border-sindoor px-4 py-2 text-sm font-medium text-sindoor transition-colors hover:bg-sindoor hover:text-rang-paper"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-sand-border bg-surface">
          {notifications.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="font-sans text-sm text-muted-ink">
                Nothing yet. New orders and commission requests show up here as
                they happen.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-sand-border">
              {notifications.map((notification) => {
                const badge =
                  TYPE_BADGES[notification.type] || TYPE_BADGES.info;

                return (
                  <li
                    key={notification.id}
                    className={`flex items-start gap-4 px-5 py-4 transition-colors ${
                      notification.read ? "" : "bg-rang-paper/60"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={`text-sm ${
                            notification.read
                              ? "font-normal text-muted-ink"
                              : "font-semibold text-deep-ink"
                          }`}
                        >
                          {notification.title}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-ink font-sans">
                        {notification.message}
                      </p>
                      <p className="mt-1 text-xs text-muted-ink">
                        {timeAgo(notification.created_at)}
                      </p>
                    </div>

                    {!notification.read && (
                      <button
                        type="button"
                        onClick={() => markRead(notification.id)}
                        className="shrink-0 text-xs font-medium text-sindoor hover:underline"
                      >
                        Mark read
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
