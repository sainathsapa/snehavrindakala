import { CommissionForm } from "@/components/commission-form";
import { PageHeader } from "@/components/page-header";
import { BotanicalRule } from "@/components/ornaments";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Request a Piece",
  description:
    "Request an original piece from an Indian artist. Send a brief and receive a quote with milestones, proofs and a delivery date before any work begins.",
  alternates: { canonical: "/custom-art" },
};

const STEPS = [
  {
    n: "01",
    title: "Send your brief",
    body: "Tell us the art form, medium, size, budget, target date, and attach any reference images.",
  },
  {
    n: "02",
    title: "Feasibility review",
    body: "An artist considers completeness, rights, schedule, and availability — and says plainly if it cannot be done.",
  },
  {
    n: "03",
    title: "Receive a quote",
    body: "Scope, deliverables, timeline, revision allowance, deposit and expiry, all in writing.",
  },
  {
    n: "04",
    title: "Approve and begin",
    body: "Accept the quote and pay the deposit through a secure checkout. Work starts after that.",
  },
  {
    n: "05",
    title: "Proofs, then delivery",
    body: "Review private proofs, request in-scope revisions, and receive the finished work.",
  },
];

export default function CustomArtPage() {
  return (
    <main className="bg-rang-paper">
      <PageHeader
        eyebrow="Made to order"
        title="Request a piece"
        intro="Not everything should be bought off a wall. Tell an artist what you have in mind — a portrait, a mural, a textile for a particular room — and they will tell you honestly what is possible."
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Request" }]}
        image="/images/artforms/home-decor.jpg"
      />

      <section className="relative overflow-hidden pb-20 pt-14 lg:pt-20">
        <div className="mx-auto grid max-w-[1400px] gap-14 px-5 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:gap-20 lg:px-12">
          {/* ── Process ───────────────────────────────────────────────────── */}
          <div>
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.26em] text-terracotta">
              The process
            </p>
            <h2 className="mt-3 font-serif text-2xl font-semibold text-deep-ink sm:text-3xl">
              Five stages, nothing hidden
            </h2>
            <BotanicalRule className="mt-6 text-terracotta" />

            <ol className="mt-10 space-y-8">
              {STEPS.map((step) => (
                <li key={step.n} className="flex gap-5">
                  <span className="mt-1 font-serif text-sm font-semibold tracking-[0.14em] text-terracotta">
                    {step.n}
                  </span>
                  <div className="border-l border-sand-border/70 pl-5">
                    <h3 className="font-serif text-lg font-semibold text-deep-ink">
                      {step.title}
                    </h3>
                    <p className="mt-1.5 font-sans text-sm leading-relaxed text-muted-ink">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* ── Form ──────────────────────────────────────────────────────── */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <div className="border border-sand-border/70 bg-surface/70 p-6 sm:p-9">
              <h2 className="font-serif text-2xl font-semibold text-deep-ink">
                Start your request
              </h2>
              <p className="mt-2 font-sans text-sm leading-relaxed text-muted-ink">
                No payment is taken here. You will receive a quote before
                anything is committed.
              </p>
              <div className="mt-7">
                <CommissionForm />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
