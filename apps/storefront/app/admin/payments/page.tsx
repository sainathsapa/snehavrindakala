"use client";

/**
 * The payment log.
 *
 * Every event the Razorpay webhook accepted: captured, failed, authorised, and
 * each refund state, with the amount that was involved. Before this page the
 * studio had an event table and no way to read it, so "did that payment go
 * through?" was answered by opening Razorpay's dashboard and comparing by eye.
 *
 * Nothing on this page moves money. A refund goes through the approval queue,
 * where the admin who asks for it cannot be the one who releases it.
 */

import { useEffect, useState } from "react";

interface PaymentEvent {
  id: string;
  provider: string;
  event_type: string;
  order_id: string | null;
  payment_id: string | null;
  amount: number | string | null;
  currency: string | null;
  status: string;
  attempts: number;
  last_error: string | null;
  received_at: string;
  processed_at: string | null;
}

interface Summary {
  events: number;
  captured: number;
  failed: number;
  refunds: number;
  needs_attention: number;
  captured_minor: number;
  refunded_minor: number;
}

const rupee = (minor: number | string | null) => {
  const value = Number(minor ?? 0);
  if (!Number.isFinite(value) || value === 0) return "—";
  // Razorpay reports paise; the record keeps them, the reader wants rupees.
  return `₹${(value / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

const TONE: Record<string, string> = {
  "payment.captured": "bg-leaf/10 text-leaf",
  "payment.failed": "bg-sindoor/10 text-sindoor",
  "payment.authorized": "bg-haldi/20 text-deep-ink",
};

const toneFor = (type: string) =>
  TONE[type] ?? (type.startsWith("refund.") ? "bg-sand-border/40 text-muted-ink" : "bg-sand-border/30 text-muted-ink");

export default function PaymentsPage() {
  const [events, setEvents] = useState<PaymentEvent[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [mode, setMode] = useState<"test" | "live" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/payments?limit=200", { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Could not load the payment log");
        setEvents(body.events ?? []);
        setSummary(body.summary ?? null);
        setMode(body.provider ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the payment log"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="p-8">
        <p className="font-sans text-sm text-muted-ink">Reading the payment log…</p>
      </main>
    );
  }

  return (
    <main className="p-6 sm:p-8">
      <header className="mb-6">
        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.24em] text-terracotta">
          Money
        </p>
        <h1 className="mt-1 font-serif text-3xl text-deep-ink">Payments</h1>
        <p className="mt-2 max-w-2xl font-sans text-sm text-muted-ink">
          Every payment and refund event Razorpay has sent us, with what it was
          worth. The webhook is the only writer and the provider is the only
          source of truth — this page is the record, not the switchboard.
        </p>
        {mode === "test" && (
          <p className="mt-3 inline-block border border-haldi/50 bg-haldi/10 px-3 py-1.5 font-sans text-xs text-deep-ink">
            Razorpay is in <strong>test mode</strong>. Nothing here is real money.
          </p>
        )}
      </header>

      {error && (
        <div role="alert" className="mb-6 border border-sindoor/30 bg-sindoor/5 p-3 font-sans text-sm text-kumkum">
          {error}
        </div>
      )}

      {summary && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Events", value: String(summary.events) },
            { label: "Captured", value: String(summary.captured) },
            { label: "Failed", value: String(summary.failed) },
            { label: "Refunds", value: String(summary.refunds) },
            { label: "Taken", value: rupee(summary.captured_minor) },
            { label: "Returned", value: rupee(summary.refunded_minor) },
          ].map((card) => (
            <div key={card.label} className="border border-sand-border bg-surface p-3">
              <p className="font-sans text-[10px] uppercase tracking-[0.16em] text-muted-ink">
                {card.label}
              </p>
              <p className="mt-1 font-serif text-xl text-deep-ink">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {events.length === 0 ? (
        <div className="border border-sand-border bg-surface p-8 text-center">
          <p className="font-serif text-lg text-deep-ink">No payment events yet.</p>
          <p className="mx-auto mt-2 max-w-md font-sans text-sm text-muted-ink">
            The first one arrives the moment a buyer pays. If someone has paid and
            this is still empty, the webhook is not reaching the shop — check that{" "}
            <code className="font-mono text-[12px]">RAZORPAY_WEBHOOK_SECRET</code> is
            set and that Razorpay is posting to{" "}
            <code className="font-mono text-[12px]">/api/webhooks/razorpay</code>.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-sand-border">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="bg-sand-border/20 text-left font-sans text-[10px] uppercase tracking-[0.16em] text-muted-ink">
                <th className="px-3 py-2.5">When</th>
                <th className="px-3 py-2.5">Event</th>
                <th className="px-3 py-2.5">Amount</th>
                <th className="px-3 py-2.5">Order</th>
                <th className="px-3 py-2.5">Payment</th>
                <th className="px-3 py-2.5">State</th>
              </tr>
            </thead>
            <tbody className="font-sans text-[13px] text-deep-ink">
              {events.map((event) => (
                <tr key={event.id} className="border-t border-sand-border align-top">
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-ink">
                    {new Date(event.received_at).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-block px-2 py-0.5 text-[11px] ${toneFor(event.event_type)}`}>
                      {event.event_type}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5">{rupee(event.amount)}</td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-muted-ink">
                    {event.order_id ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[11px] text-muted-ink">
                    {event.payment_id ?? "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    {event.status}
                    {event.last_error ? (
                      <span className="mt-1 block text-[11px] text-kumkum">{event.last_error}</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
