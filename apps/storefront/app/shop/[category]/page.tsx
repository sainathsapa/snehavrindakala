import { getProductPrice, getStockType, medusa } from "@/lib/medusa";
import { ProductCard } from "@/components/product-card";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArtFormBySlug, artFormSlugs } from "@/lib/slugs";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return artFormSlugs.map((form) => ({
    category: form.slug,
  }));
}

export const metadata = async ({ params }: { params: Promise<{ category: string }> }) => {
  const { category } = await params;
  const artForm = getArtFormBySlug(category);
  return {
    title: artForm
      ? `${artForm.name} | SnehaVrinda Kala`
      : "Collection | SnehaVrinda Kala",
    description: artForm
      ? artForm.description
      : "Browse curated collections by art form at SnehaVrinda Kala.",
    alternates: {
      canonical: artForm ? `/shop/${artForm.slug}` : `/shop/${category}`,
    },
    openGraph: {
      title: artForm ? `${artForm.name} | SnehaVrinda Kala` : undefined,
      description: artForm ? artForm.description : undefined,
      type: "website",
    },
  };
};

export default async function ShopCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const artForm = getArtFormBySlug(category);

  if (!artForm) {
    notFound();
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000";

  let products: Awaited<
    ReturnType<typeof medusa.listProducts>
  >["products"] = [];
  try {
    const { products: productsData } = await medusa.listProducts({
      limit: 100,
      q: artForm.query,
    });
    products = productsData;
  } catch (err) {
    console.error("Failed to load products from Medusa", err);
  }

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: `${baseUrl}`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Shop",
        item: `${baseUrl}/shop`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: artForm.name,
        item: `${baseUrl}/shop/${artForm.slug}`,
      },
    ],
  };

  return (
    <main className="py-10 bg-rang-paper">
      <script
        id="schema-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav className="mb-6 text-sm text-muted-ink font-sans">
          <Link
            href="/shop"
            className="hover:text-sindoor transition-colors"
          >
            ← All products
          </Link>
          <span className="mx-2 text-muted-ink">/</span>
          <span className="text-sindoor font-medium">
            {artForm.name}
          </span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-deep-ink mb-4">
          {artForm.name}
        </h1>
        <p className="mb-8 text-lg text-muted-ink font-sans leading-relaxed">
          {artForm.description}
        </p>

        {products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                handle={product.handle}
                title={product.title}
                artist={product.category?.name || "SnehaVrinda Kala"}
                price={getProductPrice(product)}
                stockType={getStockType(product)}
                image={
                  product.thumbnail ||
                  product.images?.[0]?.url ||
                  "/images/product-placeholder.svg"
                }
                isNew={product.is_new}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-lg text-muted-ink font-sans mb-6">
              No products in this collection yet. Check back soon.
            </p>
            <Link
              href="/shop"
              className="px-6 py-3 bg-sindoor text-rang-paper rounded-md font-medium hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 transition-colors"
            >
              Browse all products
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
