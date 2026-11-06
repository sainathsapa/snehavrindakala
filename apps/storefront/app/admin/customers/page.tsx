import { requireAdmin, listCustomers } from "../actions";
import { hasPermission } from "@/lib/rbac";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Customers | SnehaVrinda Kala Admin",
  robots: { index: false, follow: false },
};

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireAdmin();
  const { q, page } = await searchParams;
  const userRole = "super_admin";

  if (!hasPermission(userRole as any, "customers:read")) {
    redirect("/admin?error=unauthorized");
  }

  let customers: any[] = [];
  let count = 0;
  try {
    const res = await listCustomers({
      limit: 20,
      offset: ((parseInt(page || "1") - 1) * 20) || 0,
      q: q || undefined,
    });
    customers = res.customers;
    count = res.count;
  } catch (err) {
    console.error("Failed to load customers", err);
  }

  return (
    <main className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
              Customers
            </h1>
            <p className="text-muted-ink font-sans">
              Manage customer accounts.
            </p>
          </div>
        </div>

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
              placeholder="Search customers…"
              defaultValue={q || ""}
              className="flex-1 px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"
            />
          </form>
        </div>

        {/* Customers table */}
        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <table className="w-full text-left divide-y divide-sand-border">
            <thead>
              <tr className="bg-surface">
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Account
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {customers.length > 0 ? (
                customers.map((customer: any) => (
                  <tr key={customer.id} className="hover:bg-rang-paper/50">
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                      {customer.first_name} {customer.last_name}
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                      {customer.email}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium font-sans ${
                          customer.has_account
                            ? "bg-leaf/10 text-leaf border border-leaf/20"
                            : "bg-muted-ink/10 text-muted-ink border border-muted-ink/20"
                        }`}
                      >
                        {customer.has_account ? "Has Account" : "Guest"}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                      {new Date(customer.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <p className="text-muted-ink font-sans">
                      No customers found.
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
