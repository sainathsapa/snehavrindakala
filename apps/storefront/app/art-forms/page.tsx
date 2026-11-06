const artForms = [
  {
    name: "Painting & Drawing",
    description:
      "Original paintings, sketches, portraits, prints, and illustration across mediums.",
    href: "/shop?q=Painting",
  },
  {
    name: "Traditional & Folk Art",
    description:
      "Region- and technique-led work with careful cultural attribution and provenance.",
    href: "/shop?q=Folk",
  },
  {
    name: "Home & Decorative Art",
    description:
      "Wall décor, sculpture, ceramics, lamps, and decorative objects for the home.",
    href: "/shop?q=Home%20%26%20Decorative",
  },
  {
    name: "Textile & Fibre Art",
    description:
      "Embroidery, weaving, crochet, macramé, and textile décor in natural fibres.",
    href: "/shop?q=Textile",
  },
  {
    name: "Paper, Stationery & Books",
    description:
      "Paper art, handmade cards, journals, calligraphy, and creative stationery.",
    href: "/shop?q=Paper",
  },
  {
    name: "Wearable Art",
    description:
      "Art jewellery, accessories, painted apparel, and wearable craft pieces.",
    href: "/shop?q=Wearable",
  },
];

export default function ArtFormsPage() {
  return (
    <main className="py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-ink mb-8">
          Shop by art form
        </h1>
        <p className="mb-8 text-lg text-muted font-sans">
          Browse curated collections organized by medium and technique. Each
          collection shows the maker, materials, and care details.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {artForms.map((form) => (
            <section
              key={form.href}
              className="rounded-xl border border-border bg-surface p-8 hover:shadow-md transition-shadow"
            >
              <h2 className="text-2xl font-serif font-semibold text-ink mb-2">
                {form.name}
              </h2>
              <p className="text-muted font-sans">{form.description}</p>
              <a
                href={form.href}
                className="mt-4 inline-block text-sm font-medium text-terracotta hover:underline"
              >
                Explore {form.name} →
              </a>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
