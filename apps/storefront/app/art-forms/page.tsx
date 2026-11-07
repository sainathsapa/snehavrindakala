import Link from "next/link";
import { medusa } from "@/lib/medusa";
import { artFormSlugs } from "@/lib/slugs";

export const dynamic = "force-dynamic";

interface ArtFormCard {
  key: string;
  name: string;
  description: string;
  href: string;
}

export default async function ArtFormsPage() {
  let cards: ArtFormCard[] = [];

  try {
    const { product_categories } = await medusa.listProductCategories({
      limit: 100,
    });
    cards = (product_categories || []).map((category: any) => ({
      key: category.id,
      name: category.name,
      description:
        category.description ||
        "Browse handmade works from Indian makers in this collection.",
      href: `/shop/${category.handle}`,
    }));
  } catch (err) {
    console.error("Failed to load product categories from Medusa", err);
  }

  // Fall back to the static art-form taxonomy until the catalogue has
  // categories configured in the admin panel.
  if (cards.length === 0) {
    cards = artFormSlugs.map((form) => ({
      key: form.slug,
      name: form.name,
      description: form.description,
      href: `/shop/${form.slug}`,
    }));
  }

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
          {cards.map((form) => (
            <section
              key={form.key}
              className="rounded-xl border border-sand-border bg-surface p-8 hover:shadow-md transition-shadow"
            >
              <h2 className="text-2xl font-serif font-semibold text-deep-ink mb-2">
                {form.name}
              </h2>
              <p className="text-muted-ink font-sans">{form.description}</p>
              <Link
                href={form.href}
                className="mt-4 inline-block text-sm font-medium text-sindoor hover:underline"
              >
                Explore {form.name} →
              </Link>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
