"use client";

import { useActionState } from "react";
import { Link } from "@/i18n/routing";
import { trackOrder, type TrackResult } from "./actions";

/**
 * Guest order tracking.
 *
 * The form asks for two things because either alone would let the wrong person
 * read someone else's order: the number is guessable, and the email is the part
 * an attacker is most likely to already hold. The pair is checked on the server.
 */
export function TrackForm({
  labels,
}: {
  labels: {
    orderId: string;
    orderIdHint: string;
    email: string;
    emailHint: string;
    submit: string;
    submitting: string;
    found: string;
    status: string;
    payment: string;
    placed: string;
    total: string;
    items: string;
    tracking: string;
    carrier: string;
    trackingNumber: string;
    openTracking: string;
    noShipment: string;
    viewOrder: string;
    again: string;
  };
}) {
  const [state, formAction, pending] = useActionState<TrackResult | null, FormData>(
    trackOrder,
    null
  );

  if (state?.ok && state.order) {
    const o = state.order;
    return (
      <div className="mt-10 border border-sand-border/70 bg-surface/60 p-6 sm:p-8">
        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.28em] text-terracotta">
          {labels.found}
        </p>
        <h2 className="mt-2 font-serif text-2xl font-semibold text-deep-ink">
          {o.displayId ? `#${o.displayId}` : "—"}
        </h2>

        <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <div>
            <dt className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-terracotta">
              {labels.status}
            </dt>
            <dd className="mt-1 font-serif text-base capitalize text-deep-ink">
              {o.status}
            </dd>
          </div>
          <div>
            <dt className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-terracotta">
              {labels.payment}
            </dt>
            <dd className="mt-1 font-serif text-base capitalize text-deep-ink">
              {o.paymentStatus}
            </dd>
          </div>
          {o.createdAt && (
            <div>
              <dt className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-terracotta">
                {labels.placed}
              </dt>
              <dd className="mt-1 font-serif text-base text-deep-ink">
                {new Date(o.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </dd>
            </div>
          )}
          {o.total != null && (
            <div>
              <dt className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-terracotta">
                {labels.total}
              </dt>
              <dd className="mt-1 font-serif text-base text-deep-ink">
                {(o.total / 100).toLocaleString("en-IN", {
                  style: "currency",
                  currency: o.currency || "INR",
                  maximumFractionDigits: 0,
                })}
              </dd>
            </div>
          )}
        </dl>

        {o.items.length > 0 && (
          <div className="mt-6 border-t border-sand-border/50 pt-4">
            <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-terracotta">
              {labels.items}
            </p>
            <ul className="mt-2 space-y-1">
              {o.items.map((item, i) => (
                <li key={i} className="font-serif text-sm text-deep-ink">
                  {item.title}
                  {item.quantity > 1 && (
                    <span className="text-muted-ink"> × {item.quantity}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 border-t border-sand-border/50 pt-4">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-terracotta">
            {labels.tracking}
          </p>
          {o.shipment?.trackingNumber ? (
            <p className="mt-1 font-serif text-sm text-deep-ink">
              {o.shipment.carrier && (
                <span className="text-muted-ink">{o.shipment.carrier} · </span>
              )}
              {o.shipment.trackingNumber}
              {o.shipment.trackingUrl && (
                <>
                  {" — "}
                  <a
                    href={o.shipment.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-terracotta/40 underline-offset-4 hover:text-kumkum"
                  >
                    {labels.openTracking}
                  </a>
                </>
              )}
            </p>
          ) : (
            <p className="mt-1 font-serif text-sm italic text-muted-ink">
              {labels.noShipment}
            </p>
          )}
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-5">
          <Link
            href="/shop"
            className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-kumkum underline decoration-terracotta/40 underline-offset-4"
          >
            {labels.again}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-8 max-w-xl space-y-5" noValidate>
      {state?.error && (
        <div
          role="alert"
          className="border border-kumkum/30 bg-kumkum/5 p-3 font-sans text-sm text-kumkum"
        >
          {state.error}
        </div>
      )}

      <div>
        <label
          htmlFor="orderId"
          className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-terracotta"
        >
          {labels.orderId}
        </label>
        <input
          id="orderId"
          name="orderId"
          required
          autoComplete="off"
          placeholder={labels.orderIdHint}
          className="mt-2 w-full border border-sand-border bg-surface px-3 py-2.5 font-serif text-base text-deep-ink outline-none focus:border-sindoor focus:ring-1 focus:ring-sindoor/40"
        />
      </div>

      <div>
        <label
          htmlFor="email"
          className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-terracotta"
        >
          {labels.email}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder={labels.emailHint}
          className="mt-2 w-full border border-sand-border bg-surface px-3 py-2.5 font-serif text-base text-deep-ink outline-none focus:border-sindoor focus:ring-1 focus:ring-sindoor/40"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="btn-primary disabled:opacity-60"
      >
        {pending ? labels.submitting : labels.submit}
      </button>
    </form>
  );
}
