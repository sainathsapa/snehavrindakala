/**
 * Commission status — the page a customer returns to.
 *
 * The previous version showed a static "what happens next" paragraph and a
 * broken inline condition that rendered the tracker as an expression string.
 * This turns the 15-status state machine into a customer-readable timeline.
 */

import { medusa } from "@/lib/medusa";
import { Link } from "@/i18n/routing";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Commission status",
  robots: { index: false, follow: false },
};

/** The happy path, in order, as the customer experiences it. */
const JOURNEY = [
  { key: "received", label: "Request received", hint: "We have your brief." },
  {
    key: "review",
    label: "Under review",
    hint: "We are checking feasibility, schedule and artist capacity.",
  },
  {
    key: "quote",
    label: "Quote sent",
    hint: "You receive a quote with scope, timeline and milestones.",
  },
  {
    key: "payment",
    label: "Deposit paid",
    hint: "Once the deposit is in, your slot is locked.",
  },
  {
    key: "production",
    label: "In production",
    hint: "Your piece is being made.",
  },
  {
    key: "proof",
    label: "Proof approved",
    hint: "You review and approve the final proof.",
  },
  {
    key: "shipped",
    label: "Shipped",
    hint: "On its way to you, with tracking.",
  },
  {
    key: "completed",
    label: "Completed",
    hint: "Delivered. Thank you for commissioning.",
  },
] as const;

/** Which journey step each backend status has reached. */
const STATUS_STEP: Record<string, number> = {
  New: 0,
  "Needs clarification": 1,
  "Feasibility review": 1,
  "Awaiting artist/capacity": 1,
  "Quote drafted": 1,
  "Quote sent": 2,
  "Awaiting payment": 2,
  Accepted: 3,
  "In production": 4,
  "Proof review": 5,
  Approved: 5,
  "Ready to dispatch": 6,
  Shipped: 6,
  Completed: 7,
};

const STATUS_LABEL: Record<string, string> = {
  New: "New request",
  "Needs clarification": "We need a little more detail",
  "Feasibility review": "Feasibility review",
  "Awaiting artist/capacity": "Matching an artist",
  "Quote drafted": "Preparing your quote",
  "Quote sent": "Quote sent",
  "Awaiting payment": "Awaiting your deposit",
  Accepted: "Quote accepted",
  "In production": "In production",
  "Proof review": "Awaiting your proof review",
  Approved: "Proof approved",
  "Ready to dispatch": "Ready to dispatch",
  Shipped: "Shipped",
  Completed: "Completed",
  Declined: "Declined",
  Cancelled: "Cancelled",
  "On hold": "On hold",
  Expired: "Quote expired",
  "Refund pending": "Refund processing",
  Refunded: "Refunded",
  Disputed: "Disputed",
};

/** Statuses where the journey stops and we show a plain explanation. */
const TERMINAL: Record<string, { tone: string; message: string }> = {
  Declined: {
    tone: "border-sand-border bg-rang-paper text-muted-ink",
    message:
      "We are not able to take this one on. Reply to our email and we will suggest alternatives or an artist who might.",
  },
  Cancelled: {
    tone: "border-sand-border bg-rang-paper text-muted-ink",
    message: "This commission was cancelled. Nothing further is owed.",
  },
  Expired: {
    tone: "border-sand-border bg-rang-paper text-muted-ink",
    message:
      "The quote expired before it was accepted. Ask us and we will re-quote.",
  },
  "On hold": {
    tone: "border-sand-border bg-rang-paper text-muted-ink",
    message: "Work is paused. We will email you to unblock it.",
  },
  "Refund pending": {
    tone: "border-sand-border bg-rang-paper text-muted-ink",
    message: "Your refund is being processed and will land in 5–7 working days.",
  },
  Refunded: {
    tone: "border-sand-border bg-rang-paper text-muted-ink",
    message: "This commission has been refunded in full.",
  },
  Disputed: {
    tone: "border-sand-border bg-rang-paper text-muted-ink",
    message: "This commission is under dispute. Our team will be in touch.",
  },
};

const contactEmail =
  process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hello@snehavrinda.in";

export default async function CommissionStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ referenceId: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { referenceId } = await params;
  const { new: isNew } = await searchParams;

  let commission: any = null;
  try {
    const { commission_request } = await medusa.getCommissionRequest(
      referenceId
    );
    commission = commission_request;
  } catch {
    notFound();
  }

  if (!commission) notFound();

  const status = commission.status as string;
  const currentStep = STATUS_STEP[status];
  const terminal = TERMINAL[status];

  return (
    <main className="py-10">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <nav className="mb-6 text-sm font-sans">
          <Link
            href="/"
            className="text-muted-ink hover:text-sindoor transition-colors"
          >
            ← Back home
          </Link>
        </nav>

        {isNew && (
          <div
            role="status"
            className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900 font-sans"
          >
            <strong className="font-semibold">Request received.</strong> Keep
            this page — the reference below is how you and our team track it.
          </div>
        )}

        <header className="mb-8">
          <p className="text-sm font-medium text-sindoor uppercase tracking-wider">
            Commission
          </p>
          <h1 className="mt-1 text-3xl md:text-4xl font-serif font-semibold text-deep-ink">
            {commission.art_form}
          </h1>
          <p className="mt-2 font-sans text-muted-ink">
            Reference{" "}
            <code className="rounded bg-rang-paper px-1.5 py-0.5 text-sm text-deep-ink">
              {commission.reference_id}
            </code>
          </p>
        </header>

        {/* Current status */}
        <section
          className={`rounded-xl border p-6 ${
            terminal
              ? terminal.tone
              : "border-sindoor/30 bg-sindoor/5 text-deep-ink"
          }`}
        >
          <p className="text-xs font-medium uppercase tracking-wider opacity-70">
            Now
          </p>
          <p className="mt-1 text-xl font-serif font-semibold">
            {STATUS_LABEL[status] || status}
          </p>
          {terminal ? (
            <p className="mt-2 text-sm font-sans">{terminal.message}</p>
          ) : currentStep != null ? (
            <p className="mt-2 text-sm font-sans">{JOURNEY[currentStep].hint}</p>
          ) : null}
        </section>

        {/* Timeline */}
        {!terminal && currentStep != null && (
          <section className="mt-8" aria-labelledby="timeline-heading">
            <h2
              id="timeline-heading"
              className="text-lg font-serif font-semibold text-deep-ink mb-4"
            >
              Progress
            </h2>
            <ol className="relative border-l border-sand-border ml-2">
              {JOURNEY.map((step, index) => {
                const done = index < currentStep;
                const active = index === currentStep;
                return (
                  <li key={step.key} className="mb-6 ml-6 last:mb-0">
                    <span
                      className={`absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                        done
                          ? "border-sindoor bg-sindoor"
                          : active
                          ? "border-sindoor bg-surface ring-4 ring-sindoor/15"
                          : "border-sand-border bg-surface"
                      }`}
                      aria-hidden="true"
                    >
                      {done && (
                        <svg
                          className="h-2.5 w-2.5 text-rang-paper"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </span>
                    <p
                      className={`text-sm font-sans ${
                        active
                          ? "font-semibold text-deep-ink"
                          : done
                          ? "text-deep-ink"
                          : "text-muted-ink"
                      }`}
                    >
                      {step.label}
                      {active && (
                        <span className="ml-2 text-xs font-normal text-sindoor">
                          you are here
                        </span>
                      )}
                    </p>
                    {(active || done) && (
                      <p className="mt-0.5 text-xs text-muted-ink font-sans">
                        {step.hint}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {/* The brief */}
        <section className="mt-8 rounded-xl border border-sand-border bg-surface p-6">
          <h2 className="text-lg font-serif font-semibold text-deep-ink mb-3">
            Your brief
          </h2>
          <p className="text-sm text-muted-ink font-sans leading-relaxed whitespace-pre-line">
            {commission.brief}
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm font-sans">
            {commission.target_date && (
              <div>
                <dt className="text-xs font-medium text-sindoor uppercase">
                  Needed by
                </dt>
                <dd className="text-deep-ink">
                  {new Date(commission.target_date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </dd>
              </div>
            )}
            {commission.delivery_pin && (
              <div>
                <dt className="text-xs font-medium text-sindoor uppercase">
                  Delivery PIN
                </dt>
                <dd className="text-deep-ink">{commission.delivery_pin}</dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium text-sindoor uppercase">
                Requested
              </dt>
              <dd className="text-deep-ink">
                {commission.created_at
                  ? new Date(commission.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "—"}
              </dd>
            </div>
          </dl>
        </section>

        {/* Help */}
        <section className="mt-8 rounded-xl border border-sand-border bg-rang-paper p-6">
          <h2 className="text-lg font-serif font-semibold text-deep-ink mb-2">
            Questions?
          </h2>
          <p className="text-sm text-muted-ink font-sans">
            Quote your reference{" "}
            <strong className="text-deep-ink">{commission.reference_id}</strong>{" "}
            and write to{" "}
            <a
              href={`mailto:${contactEmail}?subject=Commission ${encodeURIComponent(
                commission.reference_id
              )}`}
              className="text-sindoor underline"
            >
              {contactEmail}
            </a>
            . We usually reply within one working day.
          </p>
          <p className="mt-3 text-xs text-muted-ink font-sans">
            Save this page’s link. Anyone with the reference can view the status —
            so please do not share it publicly.
          </p>
        </section>
      </div>
    </main>
  );
}
