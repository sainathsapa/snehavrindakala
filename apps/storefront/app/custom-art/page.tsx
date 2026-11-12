import { CommissionForm } from "@/components/commission-form";

export const dynamic = "force-dynamic";

export default async function CustomArtPage() {
  return (
    <main className="py-10">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-deep-ink mb-4">
          Request custom art
        </h1>
        <p className="mb-10 text-lg text-muted-ink font-sans leading-relaxed">
          Commission a bespoke piece from one of our artists. Share your brief,
          upload references, and receive a versioned quote with milestones and
          proofs before production begins.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section className="space-y-6">
            <h2 className="text-2xl font-serif font-semibold text-deep-ink">
              How it works
            </h2>
            <ol className="space-y-4 text-muted-ink font-sans leading-relaxed list-decimal list-inside">
              <li>
                <strong className="text-deep-ink">Submit your brief</strong> — art
                form, medium, size, budget, target date, and reference files.
              </li>
              <li>
                <strong className="text-deep-ink">Feasibility review</strong> — we
                review completeness, rights, schedule, and artist availability.
              </li>
              <li>
                <strong className="text-deep-ink">Receive a quote</strong> — scope,
                deliverables, timeline, revisions, deposit, and expiry.
              </li>
              <li>
                <strong className="text-deep-ink">Approve &amp; pay</strong> — accept
                the quote and pay the deposit through a secure order flow.
              </li>
              <li>
                <strong className="text-deep-ink">Proofs &amp; delivery</strong> —
                review private proofs, request in-scope revisions, then receive
                the finished work.
              </li>
            </ol>
          </section>

          <section className="rounded-xl border border-sand-border bg-surface p-8">
            <h2 className="text-2xl font-serif font-semibold text-deep-ink mb-4">
              Start your request
            </h2>
            <CommissionForm />
          </section>
        </div>
      </div>
    </main>
  );
}
