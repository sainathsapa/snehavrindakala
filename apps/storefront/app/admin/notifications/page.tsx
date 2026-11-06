"use client";

import { useState, useEffect } from "react";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  created_at: string;
  read: boolean;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/notifications?limit=20", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: any) => {
        setNotifications(
          (data.notifications || []).map((n: any) => ({
            id: n.id || "",
            title: n.title || "",
            message: n.message || "",
            type: n.type || "",
            created_at: n.created_at || "",
            read: n.read || false,
          }))
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading notifications...</p>
        </div>
      </main>
    );
  }

  const notificationRows =
    notifications.length > 0
      ? notifications.map((n: Notification) => (
          <tr key={n.id} className="hover:bg-rang-paper/50 transition-colors">
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              #{n.id.slice(-8)}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              {n.title}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {n.message}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              {n.type}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {n.read ? "Read" : "Unread"}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {new Date(n.created_at).toLocaleDateString()}
            </td>
          </tr>
        ))
      : (
          <tr>
            <td colSpan={6} className="px-6 py-12 text-center">
              <p className="text-muted-ink font-sans">
                No notifications found.
              </p>
            </td>
          </tr>
        );

  return (
    <main className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
              Notifications
            </h1>
            <p className="text-muted-ink font-sans">
              Manage admin notifications.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <table className="w-full text-left divide-y divide-sand-border">
            <thead>
              <tr className="bg-surface">
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Message
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {notificationRows}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}