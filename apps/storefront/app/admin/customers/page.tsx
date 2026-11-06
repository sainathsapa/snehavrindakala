"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Customer {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
  created_at: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/customers?limit=20", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: any) => {
        setCustomers(
          (data.customers || []).map((c: any) => ({
            id: c.id || "",
            email: c.email || "",
            first_name: c.first_name || "",
            last_name: c.last_name || "",
            status: c.status || "",
            created_at: c.created_at || "",
          }))
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading customers...</p>
        </div>
      </main>
    );
  }

  const customerRows =
    customers.length > 0
      ? customers.map((c: Customer) => (
          <tr key={c.id} className="hover:bg-rang-paper/50 transition-colors">
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              #{c.id.slice(-8)}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              <Link
                href={`/admin/customers/${c.id}`}
                className="text-sindoor font-medium hover:underline"
              >
                {c.first_name} {c.last_name}
              </Link>
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {c.email}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              {c.status}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {new Date(c.created_at).toLocaleDateString()}
            </td>
          </tr>
        ))
      : (
          <tr>
            <td colSpan={5} className="px-6 py-12 text-center">
              <p className="text-muted-ink font-sans">
                No customers found.
              </p>
            </td>
          </tr>
        );

  return (
    <main className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
              Customers
            </h1>
            <p className="text-muted-ink font-sans">
              Manage customer accounts.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <table className="w-full text-left divide-y divide-sand-border">
            <thead>
              <tr className="bg-surface">
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {customerRows}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}