"use client";

/**
 * Passing a work on.
 *
 * There is no free Instagram share button: Meta's web intents cover Facebook only
 * and Instagram has none, so the honest route for stories and DMs is a copied link
 * — which the buyer pastes wherever they like, and which carries a proper preview
 * because the product page has Open Graph tags.
 *
 * WhatsApp gets a real intent because that is where these links are actually sent.
 */

import { useState } from "react";

export function ShareRow({
  url,
  title,
  labels,
}: {
  url: string;
  title: string;
  labels: { share: string; whatsapp: string; facebook: string; copy: string; copied: string };
}) {
  const [copied, setCopied] = useState(false);
  const text = `${title} — SnehaVrinda Kala`;

  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-sand-border pt-4">
      <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-ink">
        {labels.share}
      </span>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-sans text-sm text-terracotta underline-offset-4 hover:underline"
      >
        {labels.whatsapp}
      </a>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-sans text-sm text-terracotta underline-offset-4 hover:underline"
      >
        {labels.facebook}
      </a>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            setCopied(false);
          }
        }}
        className="font-sans text-sm text-terracotta underline-offset-4 hover:underline"
      >
        {copied ? labels.copied : labels.copy}
      </button>
    </div>
  );
}
