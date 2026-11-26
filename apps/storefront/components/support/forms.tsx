"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Raise a support message from the account area.
 *
 * Posts to /api/account/tickets and then refreshes the server component, so the
 * new thread appears in the list without a full page load.
 */
export function NewTicketForm({ labels }: { labels: Record<string, string> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error || "The message could not be saved.");
        return;
      }
      form.reset();
      router.refresh();
    } catch {
      setError("The message could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-md border border-sand-border bg-white px-3 py-2.5 font-sans text-sm text-deep-ink focus:border-sindoor focus:outline-none focus:ring-1 focus:ring-sindoor";
  const label = "grid gap-1.5 font-sans text-xs uppercase tracking-[0.14em] text-muted-ink";

  return (
    <form onSubmit={onSubmit} className="mt-6 grid gap-4">
      <label className={label}>
        {labels.subject}
        <input name="subject" required minLength={3} maxLength={160} className={field} />
      </label>
      <label className={label}>
        {labels.order}
        <input name="order_ref" maxLength={40} placeholder="SVK-2026-00001" className={field} />
      </label>
      <label className={label}>
        {labels.message}
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={5000}
          rows={5}
          className={`${field} resize-y`}
        />
      </label>

      {error && (
        <p role="alert" className="font-sans text-sm text-terracotta">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-fit rounded-full bg-deep-ink px-6 py-2.5 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-sindoor disabled:opacity-60"
      >
        {busy ? labels.sending : labels.send}
      </button>
    </form>
  );
}

/** Reply inside an existing thread. */
export function ReplyForm({ ticketId, labels }: { ticketId: string; labels: Record<string, string> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/account/tickets/${ticketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload.error || "The reply could not be saved.");
        return;
      }
      form.reset();
      router.refresh();
    } catch {
      setError("The reply could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 grid gap-3">
      <label className="grid gap-1.5 font-sans text-xs uppercase tracking-[0.14em] text-muted-ink">
        {labels.replyLabel}
        <textarea
          name="message"
          required
          minLength={2}
          maxLength={5000}
          rows={3}
          className="w-full resize-y rounded-md border border-sand-border bg-white px-3 py-2.5 font-sans text-sm text-deep-ink focus:border-sindoor focus:outline-none focus:ring-1 focus:ring-sindoor"
        />
      </label>
      {error && (
        <p role="alert" className="font-sans text-sm text-terracotta">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="w-fit rounded-full bg-deep-ink px-5 py-2 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-sindoor disabled:opacity-60"
      >
        {busy ? labels.sending : labels.reply}
      </button>
    </form>
  );
}
