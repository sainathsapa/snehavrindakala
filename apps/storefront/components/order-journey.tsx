/**
 * The order journey, as a buyer sees it.
 *
 * One line, oldest at the top, with the studio's milestones and the courier's
 * scans on the same thread. Each step says who is speaking — a scan is the
 * courier's claim, not ours — because a buyer who is told "delivered" by the
 * shop and "in transit" by the courier will believe neither.
 *
 * Presentational only: the steps arrive already ordered and dated from
 * lib/order-timeline.ts, so this file has no opinion about what happened, only
 * about how it reads.
 */

import type { JourneyStep } from "@/lib/order-timeline";

const DOT: Record<JourneyStep["state"], string> = {
  done: "bg-leaf",
  current: "bg-sindoor ring-4 ring-sindoor/15",
  upcoming: "border border-sand-border bg-rang-paper",
};

const TEXT: Record<JourneyStep["state"], string> = {
  done: "text-deep-ink",
  current: "text-deep-ink font-semibold",
  upcoming: "text-muted-ink",
};

function when(iso: string | null): string | null {
  if (!iso) return null;
  const parsed = new Date(iso.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function OrderJourney({
  steps,
  studioLabel,
  courierLabel,
  fetchedAt,
  updatedLabel,
}: {
  steps: JourneyStep[];
  studioLabel: string;
  courierLabel: string;
  fetchedAt?: string | null;
  updatedLabel?: string;
}) {
  if (steps.length === 0) return null;

  return (
    <div>
      <ol className="relative ml-1 border-l border-sand-border pl-6">
        {steps.map((step, index) => {
          const stamp = when(step.at);
          return (
            <li key={`${step.title}-${index}`} className="relative pb-6 last:pb-0">
              <span
                aria-hidden="true"
                className={`absolute -left-[1.72rem] top-1.5 h-2.5 w-2.5 rounded-full ${DOT[step.state]}`}
              />
              <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-terracotta">
                {step.source === "courier" ? courierLabel : studioLabel}
                {stamp ? <span className="ml-2 font-normal tracking-[0.1em] text-muted-ink">{stamp}</span> : null}
              </p>
              <p className={`mt-0.5 font-serif text-[15px] leading-snug ${TEXT[step.state]}`}>
                {step.title}
              </p>
              {step.detail && (
                <p className="font-sans text-[13px] text-muted-ink">{step.detail}</p>
              )}
            </li>
          );
        })}
      </ol>

      {fetchedAt && updatedLabel && (
        <p className="mt-3 font-sans text-[11px] text-muted-ink/80">
          {updatedLabel} {when(fetchedAt)}
        </p>
      )}
    </div>
  );
}
