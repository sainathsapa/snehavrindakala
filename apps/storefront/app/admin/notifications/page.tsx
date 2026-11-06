"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Notification {
  id: string;
  user_email: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({
    user_email: "",
    title: "",
    message: "",
    type: "info",
  });

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error("Failed to load notifications", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_email: form.user_email,
          title: form.title,
          message: form.message,
          type: form.type,
        }),
      });
      if (res.ok) {
        setMessage({ ok: true, text: "Notification sent." });
        setForm({ user_email: "", title: "", message: "", type: "info" });
        loadNotifications();
      } else {
        const err = await res.json();
        setMessage({ ok: false, text: err.error || "Failed to send notification." });
      }
    } catch {
      setMessage({ ok: false, text: "Error sending notification." });
    } finally {
      setSending(false);
    }
  }

  async function markRead(id: string) {
    try {
      await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true }),
      });
      loadNotifications();
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading notifications...</p>
        </div>
      </main>
    );
  }

  const unreadCount = notifications.filter((n: any) => !n.read).length;

  return (
    <main className="py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
            Notifications
          </h1>
          <p className="text-muted-ink font-sans">
            Send real-time notifications to users.
          </p>
        </div>

        {message && (
          <p className={`mb-6 rounded-md p-3 text-sm font-sans ${
            message.ok
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}>
            {message.text}
          </p>
        )}

        <div className="mb-6 flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium font-sans ${
            unreadCount > 0 ? "bg-terracotta/10 text-terracotta border border-terracotta/20" : "bg-leaf/10 text-leaf border border-leaf/20"
          }`}>
            {unreadCount} unread
          </span>
        </div>

        <div className="rounded-xl border border-sand-border bg-surface p-6 mb-8">
          <h2 className="text-lg font-serif font-semibold text-deep-ink mb-4">Send Notification</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-sans font-medium text-deep-ink">User Email</label>
                <input name="user_email" type="email" value={form.user_email}
                  onChange={(e) => setForm({ ...form, user_email: e.target.value })}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"/>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-sans font-medium text-deep-ink">Type</label>
                <select name="type" value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans">
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                  <option value="success">Success</option>
                </select>
              </div>
            </div>
            <div className="space-y-2 col-span-full">
              <label className="block text-sm font-sans font-medium text-deep-ink">Title</label>
              <input name="title" type="text" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. New order received" required
                className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"/>
            </div>
            <div className="space-y-2 col-span-full">
              <label className="block text-sm font-sans font-medium text-deep-ink">Message</label>
              <textarea name="message" value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                rows={3} placeholder="Type your notification..." required
                className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"/>
            </div>
            <button type="submit" disabled={sending || !form.title || !form.message}
              className="w-full py-3 bg-sindoor text-rang-paper rounded-md font-medium hover:bg-sindoor/90 transition-colors disabled:opacity-50">
              {sending ? "Sending…" : "Send Notification"}
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <table className="w-full text-left divide-y divide-sand-border">
            <thead>
              <tr className="bg-surface">
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Recipient</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Title</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Message</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {notifications.length > 0 ? (
                notifications.map((n: any) => (
                  <tr key={n.id} className={`hover:bg-rang-paper/50 ${!n.read ? "bg-sindoor/5" : ""}`}>
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">{n.user_email}</td>
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">{n.title}</td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">{n.message}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        n.type === "success" ? "bg-leaf/10 text-leaf border border-leaf/20" :
                        n.type === "error" ? "bg-sindoor/10 text-sindoor border border-sindoor/20" :
                        n.type === "warning" ? "bg-terracotta/10 text-terracotta border border-terracotta/20" :
                        "bg-sindoor/10 text-sindoor border border-sindoor/20"
                      }`}>{n.type}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        !n.read ? "bg-sindoor/10 text-sindoor border border-sindoor/20" : "bg-leaf/10 text-leaf border border-leaf/20"
                      }`}>
                        {!n.read ? "Unread" : "Read"}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">{new Date(n.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={6} className="px-6 py-12 text-center"><p className="text-muted-ink font-sans">No notifications yet.</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}