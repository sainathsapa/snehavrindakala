import { requireAdmin, listCategories } from "../actions";
import { hasPermission } from "@/lib/rbac";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Categories | SnehaVrinda Kala Admin",
  robots: { index: false, follow: false },
};

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireAdmin();
  const { q, page } = await searchParams;

  let categories: any[] = [];
  let count = 0;
  try {
    const res = await listCategories({
      limit: 50,
      offset: ((parseInt(page || "1") - 1) * 50) || 0,
    });
    categories = res.categories;
    count = res.count;
  } catch (err) {
    console.error("Failed to load categories", err);
  }

  return (
    <main className="py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
              Categories
            </h1>
            <p className="text-muted-ink font-sans">
              Organize your product catalogue.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <table className="w-full text-left divide-y divide-sand-border">
            <thead>
              <tr className="bg-surface">
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {categories.length > 0 ? (
                categories.map((cat: any) => (
                  <tr key={cat.id} className="hover:bg-rang-paper/50">
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                      {cat.name}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                      {cat.description || "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/admin/categories/${cat.id}/edit`}
                        className="text-sm font-medium text-sindoor hover:underline mr-4"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center">
                    <p className="text-muted-ink font-sans">
                      No categories found.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
