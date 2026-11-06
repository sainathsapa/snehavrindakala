"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface Customer {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  has_account: boolean;
  created_at: string;
  updated_at: string;
}

export default function CustomersPage() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  const page = searchParams.get("page") || "1";
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomers();
  }, [q, page]);

  async function loadCustomers() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/customers?limit=20&offset=${(
          (parseInt(page || "1") - 1) * 20
        ) || 0}${q ? `&q=${q}` : ""}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
        setCount(data.count || 0);
      }
    } catch (err) {
      console.error("Failed to load customers", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading customers...</p>
        </div>
      </main>
    );
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
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Customer</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Email</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Account</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Joined</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Orders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {customers.length > 0 ? (
                customers.map((customer: Customer) => (
                  <tr key={customer.id} className="hover:bg-rang-paper/50">
                    <td className="px-6 py-4">
                      <Link
                        href={`/admin/customers/${customer.id}`}
                        className="font-sans text-sm text-deep-ink hover:underline"
                      >
                        {customer.first_name} {customer.last_name}
                      </Link>
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
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                      -
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <p className="text-muted-ink font-sans">No customers found.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {count > 20 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-muted-ink font-sans">
              Showing {customers.length} of {count} customers
            </p>
            <div className="flex gap-2">
              {Array.from({ length: Math.ceil(count / 20) }).map((_, i) => (
                <Link
                  key={i}
                  href={`/admin/customers?page=${i + 1}${q ? `&q=${q}` : ""}`}
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
