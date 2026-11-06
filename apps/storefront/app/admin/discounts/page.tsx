"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Discount {
  id: string;
  code: string;
  type: string;
  value: number;
  expires_at: string;
  status: string;
}

export default function DiscountsPage() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/discounts?limit=20", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: any) => {
        setDiscounts(
          (data.discounts || []).map((d: any) => ({
            id: d.id || "",
            code: d.code || "",
            type: d.type || "",
            value: d.value || 0,
            expires_at: d.expires_at || "",
            status: d.status || "",
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
          <p className="text-muted-ink font-sans">Loading discounts...</p>
        </div>
      </main>
    );
  }

  const discountRows =
    discounts.length > 0
      ? discounts.map((d: Discount) => (
          <tr key={d.id} className="hover:bg-rang-paper/50 transition-colors">
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              #{d.id.slice(-8)}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              {d.code}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {d.type}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-deep-ink text-right">
              ${d.value}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {d.status}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {new Date(d.expires_at).toLocaleDateString()}
            </td>
          </tr>
        ))
      : (
          <tr>
            <td colSpan={6} className="px-6 py-12 text-center">
              <p className="text-muted-ink font-sans">
                No discounts found.
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
              Discounts
            </h1>
            <p className="text-muted-ink font-sans">
              Manage discount codes.
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
                  Code
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">
                  Value
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Expires
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {discountRows}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}