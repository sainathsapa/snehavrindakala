"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/routing";
import { Link } from "@/i18n/routing";

/**
 * Thank-you step: a short, visible countdown that then moves the buyer on.
 *
 * A silent redirect off a confirmation page is disorienting — the buyer wants a
 * moment to see that payment worked. So the page says where it is going, gives
 * them a way to stay, and only then navigates. It never redirects on the very
 * first paint, and it keeps working if JavaScript never runs (the links are real
 * links, not buttons).
 */
export function RedirectToOrders({
  href,
  seconds = 8,
  message,
  stayLabel,
  goLabel,
}: {
  href: string;
  seconds?: number;
  message: string;
  stayLabel: string;
  goLabel: string;
}) {
  const router = useRouter();
  const [remaining, setRemaining] = useState(seconds);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    if (remaining <= 0) {
      router.push(href);
      return;
    }
    const timer = setTimeout(() => setRemaining((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining, paused, router, href]);

  return (
    <div className="mb-8 flex flex-col gap-3 rounded-xl border border-sand-border bg-rang-paper/60 p-4 font-sans text-sm text-deep-ink sm:flex-row sm:items-center sm:justify-between">
      <p className="leading-relaxed">
        {message.replace("{seconds}", String(Math.max(remaining, 0)))}
      </p>
      <div className="flex shrink-0 items-center gap-4">
        <Link
          href={href}
          className="font-medium text-sindoor underline-offset-4 hover:underline"
        >
          {goLabel}
        </Link>
        <button
          type="button"
          onClick={() => setPaused((value) => !value)}
          className="rounded-md border border-sand-border px-3 py-1.5 text-xs font-medium text-muted-ink transition-colors hover:text-deep-ink"
        >
          {paused ? "▶" : "❙❙"} {stayLabel}
        </button>
      </div>
    </div>
  );
}
