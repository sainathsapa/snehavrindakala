"use client";

/**
 * Notification bell for the admin header.
 *
 * Shows the unread count live and drops a panel of recent notifications,
 * updated in realtime over SSE.
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/routing";
import { useRealtimeNotifications } from "@/lib/hooks/use-realtime-notifications";
import type { AppNotification } from "@/lib/hooks/use-realtime-notifications";

const TYPE_STYLES: Record<string, string> = {
  info: "border-l-4 border-l-peacock/60",
  success: "border-l-4 border-l-leaf/60",
  warning: "border-l-4 border-l-marigold/70",
  error: "border-l-4 border-l-sindoor/70",
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function Row({
  notification,
  onRead,
}: {
  notification: AppNotification;
  onRead: (id: string) => void;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p
          className={`text-sm ${
            notification.read
              ? "font-normal text-muted-ink"
              : "font-semibold text-deep-ink"
          }`}
        >
          {notification.title}
        </p>
        <span className="shrink-0 text-[11px] text-muted-ink">
          {timeAgo(notification.created_at)}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-muted-ink line-clamp-2">
        {notification.message}
      </p>
    </>
  );

  const classes = `block w-full px-4 py-3 text-left transition-colors hover:bg-rang-paper ${
    TYPE_STYLES[notification.type] || TYPE_STYLES.info
  } ${notification.read ? "opacity-70" : ""}`;

  if (notification.link) {
    return (
      <Link
        href={notification.link}
        className={classes}
        onClick={() => onRead(notification.id)}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      onClick={() => onRead(notification.id)}
    >
      {content}
    </button>
  );
}

export function NotificationBell({ audience = "admin" }: { audience?: string }) {
  const { notifications, unread, connected, markRead, markAllRead } =
    useRealtimeNotifications(audience);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape — standard expectation for a popover.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={
          unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="true"
        className="relative rounded-md p-2 text-muted-ink hover:bg-rang-paper hover:text-terracotta transition-colors focus:outline-none focus:ring-2 focus:ring-sindoor"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-sindoor px-1 text-[10px] font-semibold leading-[18px] text-rang-paper">
            {unread > 99 ? "99+" : unread}
          </span>
        )}

        {/* Live indicator: green when the stream is up, grey when reconnecting. */}
        <span
          className={`absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full ${
            connected ? "bg-leaf" : "bg-sand-border"
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-sand-border bg-surface shadow-xl sm:w-96">
          <div className="flex items-center justify-between border-b border-sand-border px-4 py-3">
            <p className="text-sm font-semibold text-deep-ink">
              Notifications
              {unread > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-ink">
                  {unread} unread
                </span>
              )}
            </p>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-medium text-sindoor hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-ink">
                Nothing yet. New orders and commission requests show up here.
              </p>
            ) : (
              notifications.map((notification) => (
                <Row
                  key={notification.id}
                  notification={notification}
                  onRead={markRead}
                />
              ))
            )}
          </div>

          <div className="border-t border-sand-border px-4 py-2 text-center">
            <Link
              href="/admin/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-sindoor hover:underline"
            >
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
