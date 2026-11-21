"use client";

/**
 * Refunds waiting for a second signature.
 *
 * The rule lives on the server (`lib/refund-approvals.ts`): the admin who asked
 * for the money cannot be the one who releases it. This page shows the queue and
 * greys out the buttons on your own requests, but it is only a courtesy — the
 * POST endpoint refuses the same action with a 403.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface PendingRefund {
  id: string;
  order_id: string;
  amount: number;
  reason: string | null;
  requested_by: string | null;
  created_at: string;
}

const money = (minor: number) =>
  `₹${(minor / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export default function RefundApprovalsPage() {
  const [refunds, setRefunds] = useState<PendingRefund[]>([]);
  const [viewer, setViewer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/refunds", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load refunds");
      setRefunds(data.refunds ?? []);
      setViewer(data.viewer ?? null);
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "Could not load refunds.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function decide(refundId: string, decision: "approve" | "reject") {
    setBusy(refundId);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refund_id: refundId,
          decision,
          note: notes[refundId] ?? "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "The decision was not recorded.");
      setMessage({ ok: true, text: data.note || "Recorded." });
      setRefunds((current) => current.filter((refund) => refund.id !== refundId));
    } catch (error) {
      setMessage({
        ok: false,
        text: error instanceof Error ? error.message : "The decision was not recorded.",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-deep-ink">
            Refund approvals
          </h1>
          <p className="mt-2 font-sans text-sm text-muted-ink">
            Refunds at or above the threshold need a second person. Approving here
            records the decision; the money is still released from the payments
            dashboard.
          </p>
        </header>

        {message && (
          <p
            role="status"
            className={`mb-6 rounded-md border p-3 font-sans text-sm ${
              message.ok
                ? "border-leaf/20 bg-leaf/5 text-leaf"
                : "border-sindoor/20 bg-sindoor/5 text-sindoor"
            }`}
          >
            {message.text}
          </p>
        )}

        {loading ? (
          <p className="font-sans text-sm text-muted-ink">Loading…</p>
        ) : refunds.length === 0 ? (
          <div className="rounded-xl border border-sand-border bg-surface p-8 text-center">
            <p className="font-sans text-sm text-deep-ink">Nothing is waiting.</p>
            <p className="mt-1 font-sans text-xs text-muted-ink">
              Large refunds appear here as soon as an admin requests one.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {refunds.map((refund) => {
              const mine =
                viewer && refund.requested_by
                  ? viewer.toLowerCase() === refund.requested_by.toLowerCase()
                  : false;
              return (
                <li
                  key={refund.id}
                  className="rounded-xl border border-sand-border bg-surface p-6"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-serif text-xl font-semibold text-deep-ink">
                      {money(refund.amount)}
                    </p>
                    <p className="font-mono text-xs text-muted-ink">{refund.id}</p>
                  </div>

                  <dl className="mt-3 grid gap-1 font-sans text-sm">
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-muted-ink">Order</dt>
                      <dd>
                        <Link
                          href={`/admin/orders/${refund.order_id}`}
                          className="text-sindoor hover:underline"
                        >
                          {refund.order_id}
                        </Link>
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-muted-ink">Reason</dt>
                      <dd className="text-deep-ink">{refund.reason || "—"}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-muted-ink">Requested</dt>
                      <dd className="text-deep-ink">
                        {refund.requested_by || "unknown admin"} ·{" "}
                        {new Date(refund.created_at).toLocaleString("en-IN")}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                    <input
                      type="text"
                      value={notes[refund.id] ?? ""}
                      onChange={(event) =>
                        setNotes({ ...notes, [refund.id]: event.target.value })
                      }
                      placeholder="Note (optional, kept with the record)"
                      className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 font-sans text-sm"
                    />
                    <button
                      type="button"
                      disabled={busy === refund.id || Boolean(mine)}
                      onClick={() => decide(refund.id, "approve")}
                      className="rounded-md bg-sindoor px-4 py-2 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-sindoor/90 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy === refund.id || Boolean(mine)}
                      onClick={() => decide(refund.id, "reject")}
                      className="rounded-md border border-sand-border px-4 py-2 font-sans text-sm font-medium text-deep-ink transition-colors hover:border-sindoor hover:text-sindoor disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>

                  {mine && (
                    <p className="mt-2 font-sans text-xs text-muted-ink">
                      You asked for this refund, so someone else has to approve it.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
