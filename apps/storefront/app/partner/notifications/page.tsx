import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePartnerContext } from "@/lib/partner/context";
import {
  listPartnerNotifications,
  type PartnerNotification,
} from "@/lib/partner-portal/notifications";

export const metadata = {
  title: "Notifications — Partner portal — SnehaVrinda Kala",
};

export const dynamic = "force-dynamic";

function formatTime(time: string): string {
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return time;
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

export default async function PartnerNotificationsPage() {
  const ctx = await requirePartnerContext();
  if (!ctx) redirect("/partner/login");

  let notifications: PartnerNotification[] = [];
  let loadError = false;
  try {
    notifications = await listPartnerNotifications(ctx);
  } catch (err) {
    console.error("[partner notifications] page load failed", err);
    loadError = true;
  }

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 font-sans sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-sindoor">
            Partner portal
          </p>
          <h1 className="mt-2 text-3xl font-serif font-semibold text-deep-ink">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-muted-ink">
            Updates about your orders, shipments, catalogue and payments.
          </p>
        </div>
        {unread > 0 && (
          <span className="rounded-full bg-sindoor px-3 py-1 text-xs font-medium text-surface">
            {unread} unread
          </span>
        )}
      </div>

      {loadError && (
        <p className="mb-5 rounded-lg border border-sand-border bg-surface p-4 text-sm text-sindoor">
          Notifications could not be loaded right now. Please try again shortly.
        </p>
      )}

      {notifications.length === 0 ? (
        <div className="rounded-xl border border-sand-border bg-surface p-10 text-center shadow-sm">
          <h2 className="text-lg font-serif font-semibold text-deep-ink">
            You&apos;re all caught up
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-ink">
            There are no notifications for your account yet. Order and fulfilment
            updates will appear here as they happen.
          </p>
          <Link
            href="/partner/orders"
            className="mt-6 inline-block rounded-lg bg-deep-ink px-4 py-2 text-sm font-medium text-surface hover:opacity-90"
          >
            View your orders
          </Link>
        </div>
      ) : (
        <ul className="space-y-3" aria-label="Partner notifications">
          {notifications.map((n) => (
            <li key={n.id}>
              <Link
                href={n.href}
                className={`block rounded-xl border p-5 shadow-sm transition-colors hover:border-sindoor ${
                  n.read
                    ? "border-sand-border bg-surface"
                    : "border-sindoor/40 bg-surface"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={`mt-2 h-2 w-2 shrink-0 rounded-full ${
                      n.read ? "bg-sand-border" : "bg-sindoor"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2
                        className={`font-serif text-lg ${
                          n.read ? "font-medium text-muted-ink" : "font-semibold text-deep-ink"
                        }`}
                      >
                        {n.title}
                      </h2>
                      <time
                        dateTime={n.time}
                        className="text-xs text-muted-ink"
                      >
                        {formatTime(n.time)}
                      </time>
                    </div>
                    <p className="mt-1 text-sm text-muted-ink">{n.body}</p>
                    <div className="mt-3 flex items-center gap-4">
                      <span
                        className={`text-xs font-medium ${
                          n.read ? "text-muted-ink" : "text-sindoor"
                        }`}
                      >
                        {n.read ? "Read" : "Unread"}
                      </span>
                      <span className="text-xs text-sindoor hover:underline">
                        Open section →
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
