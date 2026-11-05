import Link from "next/link";
import { Button } from "@snehavrinda-kala/ui";

const artForms = [
  {
    name: "Painting & Drawing",
    description: "Original paintings, sketches, portraits, prints, illustration.",
    href: "/collections/painting-drawing",
    image: "/images/artforms/painting.jpg",
  },
  {
    name: "Traditional & Folk Art",
    description: "Region- and technique-led work with careful cultural attribution.",
    href: "/collections/traditional-folk-art",
    image: "/images/artforms/folk.jpg",
  },
  {
    name: "Home & Decorative Art",
    description: "Wall décor, sculpture, ceramics, lamps, decorative objects.",
    href: "/collections/home-decor",
    image: "/images/artforms/decor.jpg",
  },
  {
    name: "Textile & Fibre Art",
    description: "Embroidery, weaving, crochet, macramé, textile décor.",
    href: "/collections/textile-fibre",
    image: "/images/artforms/textile.jpg",
  },
  {
    name: "Paper, Stationery & Books",
    description: "Paper art, cards, journals, calligraphy, creative stationery.",
    href: "/collections/paper-stationery",
    image: "/images/artforms/stationery.jpg",
  },
  {
    name: "Wearable Art",
    description: "Art jewellery, accessories, painted apparel, wearable craft.",
    href: "/collections/wearable-art",
    image: "/images/artforms/wearable.jpg",
  },
];

export default function Home() {
  return (
    <main>
      <section className="py-12 md:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-sm font-medium text-terracotta tracking-wider uppercase">
            New arrivals &amp; curated collections
          </p>
          <h1 className="mt-2 text-4xl md:text-6xl font-serif font-semibold text-ink text-balance leading-tight">
            A home for art in all its forms
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted font-sans">
            Ready-to-ship artwork, made-to-order pieces, custom commissions, and
            creative kits—made, curated, personalized, and shared by creators.
          </p>
          <div className="mt-10 flex flex-wrap gap-4 sm:gap-6">
            <Link
              href="/shop"
              className="ButtonRoot px-6 py-3 bg-terracotta text-white rounded-md font-medium hover:bg-terracotta/90 focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 transition-colors"
            >
              Explore Art
            </Link>
            <Link
              href="/custom-art"
              className="ButtonRoot px-6 py-3 bg-surface text-ink border border-border rounded-md font-medium hover:bg-paper focus:outline-none focus:ring-2 focus:ring-indigo focus:ring-offset-2 transition-colors"
            >
              Request Custom Art
            </Link>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-20 border-y border-border">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-baseline justify-between mb-8 sm:mb-10">
            <h2 className="text-3xl md:text-4xl font-serif font-semibold text-ink">
              Shop by art form
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {artForms.map((form) => (
              <Link
                key={form.href}
                href={form.href}
                className="group block relative aspect-square rounded-xl overflow-hidden border border-border bg-surface transition-all hover:border-terracotta hover:shadow-md"
              >
                <img
                  src={form.image}
                  alt={form.name}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                  decoration="decorative"
                />
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition-colors" />
                <div className="absolute inset-0 flex items-end p-6">
                  <div>
                    <h3 className="text-xl font-serif font-semibold text-ink">
                      {form.name}
                    </h3>
                    <p className="mt-1 text-sm text-muted font-sans line-clamp-2">
                      {form.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16 bg-paper/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-baseline justify-between mb-8">
            <h2 className="text-3xl font-serif font-semibold text-ink">
              Commission custom art
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-xl border border-border bg-surface">
              <h3 className="text-lg font-serif font-semibold text-ink mb-2">
                1. Brief
              </h3>
              <p className="text-sm text-muted font-sans">
                Share your idea, medium, size, budget, and timeline.
              </p>
            </div>
            <div className="p-6 rounded-xl border border-border bg-surface">
              <h3 className="text-lg font-serif font-semibold text-ink mb-2">
                2. Quote
              </h3>
              <p className="text-sm text-muted font-sans">
                Artist reviews feasibility and sends a versioned quote with
                milestones.
              </p>
            </div>
            <div className="p-6 rounded-xl border border-border bg-surface">
              <h3 className="text-lg font-serif font-semibold text-ink mb-2">
                3. Create &amp; deliver
              </h3>
              <p className="text-sm text-muted font-sans">
                Approve proofs, receive the finished piece, and track delivery.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
