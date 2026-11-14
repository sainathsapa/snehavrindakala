import { CommissionForm } from "@/components/commission-form";
import { PageHeader } from "@/components/page-header";
import { BotanicalRule } from "@/components/ornaments";
import { JaaliField, PaperGrain, ButiField } from "@/components/grounds";
import Link from "next/link";

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
    title: "Share your idea",
    body: "A sentence is enough to begin. Tell us what you have in mind, and attach a reference if you have one — a photograph, a room, a colour.",
  },
  {
    n: "02",
    title: "Tell us the story",
    body: "Who is it for? Is it a wedding, a memory, a room that needs something? The story is what the artist actually works from.",
  },
  {
    n: "03",
    title: "We discuss your vision",
    body: "An artist considers feasibility, rights, schedule and availability — and says plainly if it cannot be done, and why.",
  },
  {
    n: "04",
    title: "Receive a real quote",
    body: "Scope, deliverables, timeline, revision allowance, deposit and expiry, all in writing. Nothing is hidden in a range.",
  },
  {
    n: "05",
    title: "The creation begins",
    body: "Accept the quote and pay the deposit. Work starts after that, and you get proofs at each stage.",
  },
  {
    n: "06",
    title: "Your artwork becomes real",
    body: "Approve the final proof, and the finished work is packed and sent to you with its maker's name on it.",
  },
];

export default function CustomArtPage() {
  return (
    <main className="bg-rang-paper">
      <PageHeader
        eyebrow="Made to order"
        title="Let&rsquo;s create something together"
        intro="Not everything should be bought off a wall. Tell an artist what you have in mind — a portrait, a mural, a textile for a particular room — and they will tell you honestly what is possible."
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Request" }]}
        image="/images/artforms/home-decor.jpg"
      />

      {/* ── Why commission ─────────────────────────────────────────────────
          The brief is explicit that Request must not open as 'contact us' or
          'fill this form'. Before any fields, this sets out what a commission
          actually is and who it is for — three cases, stated plainly, so the
          form below reads as a reply rather than a data entry task. */}
      <section className="relative overflow-hidden border-b border-sand-border/60 py-14 lg:py-20">
        <ButiField style={{ opacity: 0.4 }} />
        <PaperGrain />
        <div className="relative mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
            <div>
              <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.3em] text-terracotta">
                What a commission is
              </p>
              <h2 className="mt-3 font-serif text-[32px] font-semibold leading-[1.08] tracking-[-0.01em] text-deep-ink sm:text-[40px]">
                The work comes after the conversation
              </h2>
              <p className="mt-4 max-w-md font-serif text-lg italic leading-relaxed text-muted-ink">
                A commission is not a product with a longer lead time. It is a
                brief, a maker, and a set of decisions taken together.
              </p>
            </div>

            <dl className="grid gap-6 sm:grid-cols-3">
              {[
                {
                  t: "For a memory",
                  d: "A house you grew up in, a person who taught you something, a moment you want on a wall.",
                },
                {
                  t: "For an occasion",
                  d: "A wedding, a birth, a milestone — artwork made around the event rather than before it.",
                },
                {
                  t: "For a space",
                  d: "A room with a particular wall, a particular light, and nothing that quite belongs on it yet.",
                },
              ].map((item) => (
                <div key={item.t} className="border-t border-sand-border/70 pt-4">
                  <dt className="font-serif text-lg font-semibold text-deep-ink">
                    {item.t}
                  </dt>
                  <dd className="mt-1.5 font-sans text-[13px] leading-relaxed text-muted-ink">
                    {item.d}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden pb-20 pt-14 lg:pt-20">
        <JaaliField style={{ opacity: 0.45 }} />
        <PaperGrain />
        <div className="relative mx-auto grid max-w-[1400px] gap-14 px-5 sm:px-8 lg:grid-cols-[1fr_1.1fr] lg:gap-20 lg:px-12">
          {/* ── Process ───────────────────────────────────────────────────── */}
          <div>
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.26em] text-terracotta">
              The journey
            </p>
            <h2 className="mt-3 font-serif text-2xl font-semibold text-deep-ink sm:text-3xl">
              Six stages, nothing hidden
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
                Tell us about your vision
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

      {/* ── While you decide ───────────────────────────────────────────────
          A form is a commitment; not everyone arriving is ready. These are the
          honest alternatives, so a visitor who is not ready to write a brief
          still has somewhere to go. */}
      <section className="relative overflow-hidden border-t border-sand-border/60 bg-surface/50">
        <div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
          <p className="py-10 text-center font-sans text-[10px] font-semibold uppercase tracking-[0.32em] text-terracotta">
            While you decide
          </p>
          <div className="grid border-t border-sand-border/60 sm:grid-cols-3">
            {[
              {
                href: "/art-forms",
                eyebrow: "Read first",
                title: "Which tradition suits your idea",
              },
              {
                href: "/shop",
                eyebrow: "See the standard",
                title: "What the finished work looks like",
              },
              {
                href: "/about",
                eyebrow: "Meet the makers",
                title: "Who would actually make it",
              },
            ].map((door, i) => (
              <Link
                key={door.href}
                href={door.href}
                className={`group flex flex-col justify-between gap-8 px-1 py-9 transition-colors hover:bg-surface sm:px-7 ${
                  i > 0 ? "border-t border-sand-border/60 sm:border-l sm:border-t-0" : ""
                }`}
              >
                <div>
                  <p className="font-sans text-[9px] font-semibold uppercase tracking-[0.28em] text-muted-ink/70">
                    {door.eyebrow}
                  </p>
                  <h3 className="mt-2 font-serif text-lg font-semibold leading-snug text-deep-ink transition-colors group-hover:text-kumkum">
                    {door.title}
                  </h3>
                </div>
                <span
                  aria-hidden="true"
                  className="text-lg text-terracotta transition-transform duration-300 group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
