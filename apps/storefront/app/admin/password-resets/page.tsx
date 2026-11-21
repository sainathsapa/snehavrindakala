"use client";

/**
 * Password reset requests.
 *
 * There is no reset link to send yet — the shop has no email transport — so the
 * request is recorded and the studio resets the password by hand. This page is
 * the difference between "the customer is waiting" and "nobody will ever know".
 *
 * Deliberately shows every request, including ones for addresses that may not be
 * customers: the endpoint records them without checking, because checking there
 * would tell a stranger which emails are on file.
 */

import { useCallback, useEffect, useState } from "react";

interface ResetRequest {
  id: number;
  email: string;
  requested_at: string;
  handled_at: string | null;
  handled_by: string | null;
}

function when(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PasswordResetsPage() {
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/password-resets", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load requests");
      setRequests(data.requests ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markDone(id: number) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch("/api/admin/password-resets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update the request");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the request.");
    } finally {
      setBusy(null);
    }
  }

  const open = requests.filter((request) => !request.handled_at);
  const handled = requests.filter((request) => request.handled_at);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-2xl font-semibold text-deep-ink">
          Password resets
        </h1>
        <p className="mt-1 font-sans text-sm text-muted-ink">
          People who asked to be let back into their account. Nothing is emailed
          yet, so someone has to set a new password and write to them.
        </p>
      </header>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {loading ? (
        <p className="font-sans text-sm text-muted-ink">Loading…</p>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-sand-border bg-surface p-6">
          <p className="font-sans text-sm text-muted-ink">
            Nobody is waiting. When someone uses “Forgot password”, they appear
            here with the address they gave.
          </p>
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="font-sans text-xs uppercase tracking-wide text-muted-ink">
              Waiting ({open.length})
            </h2>
            {open.length === 0 ? (
              <p className="font-sans text-sm text-muted-ink">
                All caught up — nothing waiting.
              </p>
            ) : (
              <ul className="divide-y divide-sand-border rounded-xl border border-sand-border bg-surface">
                {open.map((request) => (
                  <li
                    key={request.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4"
                  >
                    <div>
                      <p className="font-sans text-sm text-deep-ink">
                        {request.email}
                      </p>
                      <p className="font-sans text-xs text-muted-ink">
                        asked {when(request.requested_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => markDone(request.id)}
                      disabled={busy === request.id}
                      className="rounded-md border border-sand-border px-3 py-1.5 font-sans text-sm text-deep-ink hover:bg-paper disabled:opacity-50"
                    >
                      {busy === request.id ? "Saving…" : "Password reset, written to them"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {handled.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-sans text-xs uppercase tracking-wide text-muted-ink">
                Done ({handled.length})
              </h2>
              <ul className="divide-y divide-sand-border rounded-xl border border-sand-border bg-surface">
                {handled.map((request) => (
                  <li key={request.id} className="flex flex-wrap gap-3 p-4">
                    <span className="font-sans text-sm text-muted-ink">
                      {request.email}
                    </span>
                    <span className="font-sans text-xs text-muted-ink">
                      {request.handled_by ? `by ${request.handled_by}, ` : ""}
                      {when(request.handled_at ?? "")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
