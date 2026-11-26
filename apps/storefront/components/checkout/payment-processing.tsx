"use client";

/**
 * The wait after payment.
 *
 * What used to happen: the buyer paid, the button said something in small grey
 * type, and the page did not visibly change while the server created the order,
 * booked a courier and sent mail. On a slow connection that looks like a broken
 * shop at the worst possible moment — money has left and nothing moves.
 *
 * This is a full-screen veil instead: the work being done is named, in the
 * studio's own terms, and the last stage admits that it is still working rather
 * than silently spinning. Every stage after the first is written as reassurance,
 * never as a claim that it has finished.
 */

import { useEffect, useState } from "react";

const STAGES = [
  { label: "Recording the sale", detail: "The work is yours. We are writing it down." },
  { label: "Sealing the crate", detail: "Acid-free paper, then the corner guards." },
  { label: "Booking the courier", detail: "Asking for a collection at the studio." },
  { label: "Writing your letter", detail: "The invoice goes out with the order details." },
] as const;

export function PaymentProcessing({ reference }: { reference?: string }) {
  const [stage, setStage] = useState(0);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    // Not real progress — the server does not report stages, and inventing a
    // percentage would be a lie that resets on a retry. These are paced
    // reassurances that stop at the last stage until the redirect happens.
    const advance = window.setInterval(() => {
      setStage((current) => (current < STAGES.length - 1 ? current + 1 : current));
    }, 2600);
    const tick = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => {
      window.clearInterval(advance);
      window.clearInterval(tick);
    };
  }, []);

  const current = STAGES[stage];
  const slow = seconds >= 25;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[2147483600] flex flex-col items-center justify-center overflow-hidden bg-rang-paper px-6 text-center"
    >
      {/* A slow ink ring, drawn rather than animated with images. */}
      <svg
        aria-hidden
        viewBox="0 0 200 200"
        className="h-40 w-40 text-sindoor/70"
        fill="none"
        stroke="currentColor"
      >
        <circle cx="100" cy="100" r="86" strokeWidth="0.75" opacity="0.25" />
        <circle cx="100" cy="100" r="62" strokeWidth="0.75" opacity="0.4" />
        <g className="origin-center animate-[spin_9s_linear_infinite]">
          <circle
            cx="100"
            cy="100"
            r="74"
            strokeWidth="1.5"
            strokeDasharray="120 340"
            strokeLinecap="round"
          />
        </g>
        {Array.from({ length: 12 }).map((_, index) => {
          const angle = (index * Math.PI * 2) / 12;
          return (
            <circle
              key={index}
              cx={100 + Math.cos(angle) * 62}
              cy={100 + Math.sin(angle) * 62}
              r="1.6"
              fill="currentColor"
              stroke="none"
              opacity="0.5"
            />
          );
        })}
      </svg>

      <p className="mt-10 font-sans text-[10px] uppercase tracking-[0.3em] text-sindoor">
        Payment received
      </p>

      <h1 className="mt-3 font-serif text-3xl text-deep-ink sm:text-4xl">{current.label}</h1>
      <p className="mt-3 max-w-md font-serif text-[15px] italic leading-relaxed text-muted-ink">
        {current.detail}
      </p>

      <ol className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-sans text-[11px] uppercase tracking-[0.16em]">
        {STAGES.map((item, index) => (
          <li
            key={item.label}
            className={
              index < stage
                ? "text-leaf"
                : index === stage
                  ? "text-deep-ink"
                  : "text-muted-ink/40"
            }
          >
            {index < stage ? "✓ " : ""}
            {item.label}
          </li>
        ))}
      </ol>

      {slow && (
        <p className="mt-10 max-w-md font-sans text-sm leading-relaxed text-muted-ink">
          This is taking longer than usual — the studio is still working, and your payment is
          safe. Please keep this page open. If it does not move in another minute, write to{" "}
          <span className="text-sindoor">hello@snehavrinda.in</span>
          {reference ? (
            <>
              {" "}
              quoting <span className="font-mono text-xs">{reference}</span>
            </>
          ) : null}
          .
        </p>
      )}

      <p className="mt-10 font-sans text-[11px] text-muted-ink/70">
        Do not refresh or pay again. This page will take you to your order.
      </p>
    </div>
  );
}
