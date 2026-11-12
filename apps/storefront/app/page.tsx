import Link from "next/link";
import { artFormSlugs } from "@/lib/slugs";

const artFormColors: Record<string, string> = {
  painting: "bg-sindoor/10 border-sindoor/20",
  folk: "bg-peacock/10 border-peacock/20",
  "home-decor": "bg-terracotta/10 border-terracotta/20",
  textile: "bg-gulabi/10 border-gulabi/20",
  paper: "bg-indigo/10 border-indigo/20",
  wearable: "bg-leaf/10 border-leaf/20",
};

const artForms = artFormSlugs.map((form) => ({
  name: form.name,
  description: form.description,
  href: `/shop/${form.slug}`,
  // Art-form SVGs are named after the short slug (painting.svg, folk.svg), not
  // the slugified display name — slugifying "Painting & Drawing" produced
  // "painting-and-drawing.svg", which does not exist, so every category card
  // rendered as a broken image.
  image: `/images/artforms/${form.slug}.svg`,
  color: artFormColors[form.slug] || "border border-sand-border",
}));

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      {/* Hero — full-width brand statement */}
      <section className="py-12 md:py-24 bg-rang-paper">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-sm font-medium text-sindoor tracking-wider uppercase">
                New arrivals &amp; curated collections
              </p>
              <h1 className="mt-2 text-4xl md:text-6xl font-serif font-semibold text-deep-ink text-balance leading-tight">
                A home for art in all its forms
              </h1>
              <p className="mt-6 max-w-xl text-lg text-muted-ink font-sans">
                Ready-to-ship artwork, made-to-order pieces, custom commissions,
                and creative kits—made, curated, personalized, and shared by
                creators.
              </p>
              <div className="mt-10 flex flex-wrap gap-4 sm:gap-6">
                <Link
                  href="/shop"
                  className="px-6 py-3 bg-sindoor text-rang-paper rounded-md font-medium hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 transition-colors inline-flex items-center justify-center"
                >
                  Explore Art
                </Link>
                <Link
                  href="/custom-art"
                  className="px-6 py-3 border border-sindoor text-sindoor rounded-md font-medium hover:bg-sindoor hover:text-rang-paper focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 transition-colors inline-flex items-center justify-center"
                >
                  Request Custom Art
                </Link>
              </div>
            </div>
            <div className="hidden lg:block relative h-72 w-full rounded-2xl overflow-hidden border border-sand-border">
              <img
                src="/images/hero/hero-art.jpg"
                alt="Featured artwork"
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-deep-ink/40" />
            </div>
          </div>
        </div>
      </section>

      {/* Art forms — colourful tiles */}
      <section className="py-12 md:py-20 border-y border-sand-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-baseline justify-between mb-8 sm:mb-10">
            <h2 className="text-3xl md:text-4xl font-serif font-semibold text-deep-ink">
              Shop by art form
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {artForms.map((form) => (
              <Link
                key={form.href}
                href={form.href}
                className={`group flex flex-col overflow-hidden rounded-xl border transition-all hover:shadow-lifted ${form.color}`}
              >
                {/* The art-form SVGs have wildly different aspect ratios (one is
                    1200x200, another 700x700) and carry their own artwork titles,
                    so cropping them to a square both cut the artwork apart and
                    pushed its lettering through the card copy. Contain them in a
                    fixed band instead, and keep the copy on a solid surface. */}
                <div className="relative flex h-40 items-center justify-center overflow-hidden bg-rang-paper">
                  <img
                    src={form.image}
                    alt=""
                    aria-hidden="true"
                    className="h-full w-full object-contain p-4 transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <div className="border-t border-sand-border/60 p-5">
                  <h3 className="font-serif text-lg font-semibold text-deep-ink">
                    {form.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 font-sans text-sm text-muted-ink">
                    {form.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Feature band — colourful */}
      <section className="py-12 md:py-16 bg-sindoor">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-serif font-semibold text-rang-paper mb-4">
              Commission custom art
            </h2>
            <p className="text-lg text-rang-paper/90 max-w-2xl mx-auto mb-8 font-sans">
              Share your idea, and an artist will bring it to life—portraits,
              paintings, décor, and event artwork made to order.
            </p>
            <Link
              href="/custom-art"
              className="px-6 py-3 bg-rang-paper text-sindoor rounded-md font-medium hover:bg-white focus:outline-none focus:ring-2 focus:ring-rang-paper focus:ring-offset-2 transition-colors inline-flex items-center justify-center"
            >
              Request Custom Art
            </Link>
          </div>
        </div>
      </section>

      {/* Commission steps — rang paper */}
      <section className="py-12 md:py-16 bg-rang-paper">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-baseline justify-between mb-8">
            <h2 className="text-3xl font-serif font-semibold text-deep-ink">
              How custom art works
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                n: "1",
                title: "Brief",
                body: "Share your idea, medium, size, budget, and timeline.",
              },
              {
                n: "2",
                title: "Quote",
                body: "Artist reviews feasibility and sends a versioned quote with milestones.",
              },
              {
                n: "3",
                title: "Create & deliver",
                body: "Approve proofs, receive the finished piece, and track delivery.",
              },
            ].map((step) => (
              <div key={step.n} className="p-6 rounded-xl border border-sand-border bg-surface">
                <h3 className="text-lg font-serif font-semibold text-deep-ink mb-2 flex items-center gap-2">
                  <span className="bg-sindoor text-rang-paper rounded-full w-6 h-6 text-xs flex items-center justify-center font-sans">
                    {step.n}
                  </span>
                  {step.title}
                </h3>
                <p className="text-sm text-muted-ink font-sans">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
