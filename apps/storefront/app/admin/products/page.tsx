import { requireAdmin, listProducts, createProduct, deleteProduct, updateProduct } from "../actions";
import { hasPermission } from "@/lib/rbac";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Products | SnehaVrinda Kala Admin",
  robots: { index: false, follow: false },
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireAdmin();
  const { q, page } = await searchParams;
  const userRole = "super_admin";

  if (!hasPermission(userRole as any, "products:read")) {
    redirect("/admin?error=unauthorized");
  }

  let products: any[] = [];
  let count = 0;
  try {
    const res = await listProducts({
      limit: 20,
      offset: ((parseInt(page || "1") - 1) * 20) || 0,
      q: q || undefined,
    });
    products = res.products;
    count = res.count;
  } catch (err) {
    console.error("Failed to load products", err);
  }

  const handleDelete = async (formData: FormData) => {
    "use server";
    const id = formData.get("id") as string;
    await deleteProduct(id);
    redirect("/admin/products?deleted=1");
  };

  return (
    <main className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
              Products
            </h1>
            <p className="text-muted-ink font-sans">
              Manage your product catalogue.
            </p>
          </div>
          {hasPermission(userRole as any, "products:write") && (
            <Link
              href="/admin/products/new"
              className="px-4 py-2 bg-sindoor text-rang-paper rounded-md font-medium hover:bg-sindoor/90 transition-colors"
            >
              + Add Product
            </Link>
          )}
        </div>

        {typeof window === "undefined" && false}

        {/* Search */}
        <div className="mb-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target as HTMLFormElement);
              const q = formData.get("q") as string;
              const params = new URLSearchParams(window.location.search);
              if (q) params.set("q", q);
              else params.delete("q");
              window.location.search = params.toString();
            }}
            className="flex gap-2"
          >
            <input
              name="q"
              type="text"
              placeholder="Search products…"
              defaultValue={q || ""}
              className="flex-1 px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-sindoor text-rang-paper rounded-md font-medium hover:bg-sindoor/90 transition-colors"
            >
              Search
            </button>
          </form>
        </div>

        {/* Products grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.length > 0 ? (
            products.map((product: any) => (
              <ProductCard
                key={product.id}
                product={product}
                canWrite={hasPermission(userRole as any, "products:write")}
                canDelete={hasPermission(userRole as any, "products:delete")}
                onDelete={handleDelete}
              />
            ))
          ) : (
            <div className="col-span-full py-20 text-center">
              <p className="text-muted-ink font-sans">
                No products found.{" "}
                {hasPermission(userRole as any, "products:write") && (
                  <>
                    Add your first{" "}
                    <Link
                      href="/admin/products/new"
                      className="text-sindoor font-medium hover:underline"
                    >
                      product
                    </Link>
                    .
                  </>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {count > 20 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-muted-ink font-sans">
              Showing {products.length} of {count} products
            </p>
            <div className="flex gap-2">
              {Array.from({ length: Math.ceil(count / 20) }).map((_, i) => (
                <Link
                  key={i}
                  href={`/admin/products?page=${i + 1}${q ? `&q=${q}` : ""}`}
                  className={`px-3 py-1 rounded-md text-sm font-sans ${
                    parseInt(page || "1") === i + 1
                      ? "bg-sindoor text-rang-paper"
                      : "text-muted-ink hover:bg-rang-paper/50"
                  }`}
                >
                  {i + 1}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function ProductCard({
  product,
  canWrite,
  canDelete,
  onDelete,
}: {
  product: any;
  canWrite: boolean;
  canDelete: boolean;
  onDelete: (formData: FormData) => Promise<void>;
}) {
  return (
    <article className="group rounded-xl border border-sand-border bg-surface overflow-hidden hover:shadow-md transition-colors">
      <div className="aspect-square bg-rang-paper relative overflow-hidden">
        {product.thumbnail || product.images?.[0]?.url ? (
          <img
            src={product.thumbnail || product.images[0].url}
            alt={product.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-ink">
            No image
          </div>
        )}
        <span className="absolute top-3 left-3 px-2 py-1 text-[10px] font-medium text-sindoor uppercase tracking-wider bg-rang-paper/90 backdrop-blur rounded">
          {product.status || "draft"}
        </span>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <Link
            href={`/admin/products/[id]/edit?id=${product.id}`}
            className="block"
          >
            <h3 className="font-serif font-semibold text-deep-ink leading-tight line-clamp-2">
              {product.title}
            </h3>
          </Link>
          {canWrite && (
            <Link
              href={`/admin/products/[id]/edit?id=${product.id}`}
              className="text-xs text-sindoor hover:underline"
            >
              Edit
            </Link>
          )}
        </div>
        <p className="text-xs text-muted-ink font-sans mb-3">
          {product.handle}
        </p>
        <div className="flex items-baseline gap-2 mb-4">
          <span className="font-sans font-bold text-deep-ink">
            {(product.variants?.[0]?.calculated_price?.calculated_amount / 100).toFixed(2)}
          </span>
          <span className="text-xs text-muted-ink">
            {product.variants?.[0]?.calculated_price?.currency_code?.toUpperCase() || "INR"}
          </span>
        </div>
        {canDelete && (
          <form action={onDelete} className="mt-4">
            <input type="hidden" name="id" value={product.id} />
            <button
              type="submit"
              className="w-full py-2 px-4 bg-sindoor/10 text-sindoor rounded-md text-sm font-medium hover:bg-sindoor hover:text-rang-paper transition-colors"
            >
              Delete Product
            </button>
          </form>
        )}
      </div>
    </article>
  );
}
