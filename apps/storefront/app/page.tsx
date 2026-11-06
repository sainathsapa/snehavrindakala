import Link from "next/link";
import { artFormSlugs, slugify } from "@/lib/slugs";

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
  image: `/images/artforms/${slugify(form.name)}.svg`,
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
                className={`group block relative aspect-square rounded-xl overflow-hidden border transition-all hover:shadow-lifted ${form.color}`}
              >
                <img
                  src={form.image}
                  alt={form.name}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-deep-ink/20 group-hover:bg-deep-ink/0 transition-colors" />
                <div className="absolute inset-0 flex items-end p-6">
                  <div>
                    <h3 className="text-xl font-serif font-semibold text-deep-ink">
                      {form.name}
                    </h3>
                    <p className="mt-1 text-sm text-muted-ink font-sans line-clamp-2">
                      {form.description}
                    </p>
                  </div>
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
