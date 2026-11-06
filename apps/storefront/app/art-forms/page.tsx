import { artFormSlugs } from "@/lib/slugs";

export default function ArtFormsPage() {
  return (
    <main className="py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-deep-ink mb-8">
          Shop by art form
        </h1>
        <p className="mb-8 text-lg text-muted-ink font-sans">
          Browse curated collections organized by medium and technique. Each
          collection shows the maker, materials, and care details.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {artFormSlugs.map((form) => (
            <section
              key={form.slug}
              className="rounded-xl border border-sand-border bg-surface p-8 hover:shadow-md transition-shadow"
            >
              <h2 className="text-2xl font-serif font-semibold text-deep-ink mb-2">
                {form.name}
              </h2>
              <p className="text-muted-ink font-sans">{form.description}</p>
              <a
                href={`/shop/${form.slug}`}
                className="mt-4 inline-block text-sm font-medium text-sindoor hover:underline"
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
