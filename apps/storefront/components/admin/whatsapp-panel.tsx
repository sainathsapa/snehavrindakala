"use client";

import { useState } from "react";

/**
 * Writing to a buyer on WhatsApp, from the admin, without a Business API.
 *
 * The Cloud API costs money and needs Meta verification, and the studio does not
 * have that budget. It is also not needed: support already has a phone in its
 * hand. A `wa.me` link opens WhatsApp with the recipient and the message already
 * set, from the studio's own number — the reply the buyer sends arrives in the
 * same chat, so the conversation is genuinely two-way. What a web link cannot do
 * is attach a file, so documents travel as links the buyer taps: the order page
 * carries their invoice and their tracking reference, and both open without a
 * password because the reference is inside the URL.
 *
 * Everything here is a draft. Nothing is sent until a person presses send, which
 * is the point: an automated message that names the wrong work is worse than no
 * message at all.
 */

type Template = { id: string; label: string; body: (ctx: Ctx) => string };

type Ctx = {
  firstName: string;
  orderNumber: string;
  orderUrl: string;
  trackRef: string | null;
  trackingUrl: string | null;
  items: string;
};

const TEMPLATES: Template[] = [
  {
    id: "received",
    label: "We have it",
    body: (c) =>
      `Namaste ${c.firstName} — thank you for your order ${c.orderNumber} from SnehaVrinda Kala.\n\n` +
      `What you chose: ${c.items}.\n` +
      `Your order page (invoice here): ${c.orderUrl}` +
      (c.trackRef ? `\nTracking reference: ${c.trackRef}` : ""),
  },
  {
    id: "shipped",
    label: "On its way",
    body: (c) =>
      `Namaste ${c.firstName} — order ${c.orderNumber} has left the studio.\n\n` +
      (c.trackRef ? `Tracking reference: ${c.trackRef}\n` : "") +
      `Follow it here: ${c.orderUrl}` +
      (c.trackingUrl ? `\nCourier tracking: ${c.trackingUrl}` : ""),
  },
  {
    id: "packing",
    label: "Being wrapped",
    body: (c) =>
      `Namaste ${c.firstName} — your ${c.items} is being wrapped at the studio now, by hand.\n\n` +
      `We will write again with the tracking reference for order ${c.orderNumber}.`,
  },
  {
    id: "invoice",
    label: "Invoice and documents",
    body: (c) =>
      `Namaste ${c.firstName} — here is everything for order ${c.orderNumber}.\n\n` +
      `Order page with invoice: ${c.orderUrl}\n` +
      (c.trackRef ? `Tracking reference: ${c.trackRef}\n` : "") +
      `Reply here if anything is unclear.`,
  },
];

export function WhatsAppPanel({
  phone,
  firstName,
  orderNumber,
  orderUrl,
  trackRef,
  trackingUrl,
  items,
}: {
  phone: string | null;
  firstName: string;
  orderNumber: string;
  orderUrl: string;
  trackRef: string | null;
  trackingUrl: string | null;
  items: string;
}) {
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [copied, setCopied] = useState(false);

  // wa.me wants country code, digits only. An Indian number typed as
  // "09876543210" has to become 919876543210 or the link opens a stranger.
  const digits = String(phone || "").replace(/[^\d]/g, "");
  const normalised =
    digits.length === 10 ? `91${digits}` : digits.replace(/^0+/, "");
  const usable = normalised.length >= 10 && normalised.length <= 15;

  const template = TEMPLATES.find((x) => x.id === templateId) ?? TEMPLATES[0];
  const message = template.body({
    firstName: firstName || "there",
    orderNumber,
    orderUrl,
    trackRef,
    trackingUrl,
    items,
  });
  const href = usable
    ? `https://wa.me/${normalised}?text=${encodeURIComponent(message)}`
    : null;

  return (
    <section className="rounded-xl border border-sand-border bg-surface p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-sans font-semibold text-muted-ink uppercase tracking-wider">
          Write to the buyer
        </h3>
        <span className="font-sans text-xs text-muted-ink">
          {usable ? `WhatsApp · ${normalised}` : "No usable phone on this order"}
        </span>
      </div>

      <p className="mt-2 font-sans text-xs text-muted-ink">
        Opens WhatsApp with the message written. Nothing is sent until you press
        send, and the reply comes back to the studio&rsquo;s own chat.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTemplateId(t.id)}
            className={`rounded-full border px-3 py-1.5 font-sans text-xs transition-colors ${
              t.id === templateId
                ? "border-terracotta bg-terracotta text-surface"
                : "border-sand-border text-deep-ink hover:border-terracotta"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <pre className="mt-4 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-sand/40 p-4 font-sans text-xs leading-relaxed text-deep-ink">
        {message}
      </pre>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-terracotta px-4 py-2 font-sans text-sm font-semibold text-surface transition-colors hover:bg-kumkum"
          >
            Open in WhatsApp →
          </a>
        ) : (
          <span className="font-sans text-sm text-muted-ink">
            Add a phone number to this order to write to the buyer.
          </span>
        )}
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(message);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              setCopied(false);
            }
          }}
          className="rounded-full border border-sand-border px-4 py-2 font-sans text-sm font-semibold text-deep-ink transition-colors hover:border-terracotta"
        >
          {copied ? "Copied" : "Copy message"}
        </button>
        {trackingUrl && (
          <a
            href={trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-sans text-xs text-terracotta underline underline-offset-4"
          >
            Courier tracking
          </a>
        )}
      </div>
    </section>
  );
}
