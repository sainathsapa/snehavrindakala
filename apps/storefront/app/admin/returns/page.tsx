"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Return {
  id: string;
  order_id: string;
  customer_email: string;
  reason: string;
  status: string;
  created_at: string;
}

export default function ReturnsPage() {
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/returns?limit=20", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: any) => {
        setReturns(
          (data.returns || []).map((r: any) => ({
            id: r.id || "",
            order_id: r.order_id || "",
            customer_email: r.customer_email || "",
            reason: r.reason || "",
            status: r.status || "",
            created_at: r.created_at || "",
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
          <p className="text-muted-ink font-sans">Loading returns...</p>
        </div>
      </main>
    );
  }

  const returnRows =
    returns.length > 0
      ? returns.map((r: Return) => (
          <tr key={r.id} className="hover:bg-rang-paper/50 transition-colors">
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              #{r.id.slice(-8)}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              #{r.order_id.slice(-8)}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {r.customer_email}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {r.reason}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              {r.status}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {new Date(r.created_at).toLocaleDateString()}
            </td>
          </tr>
        ))
      : (
          <tr>
            <td colSpan={6} className="px-6 py-12 text-center">
              <p className="text-muted-ink font-sans">
                No returns found.
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
              Returns & Refunds
            </h1>
            <p className="text-muted-ink font-sans">
              Manage customer returns and refunds.
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
                  Order ID
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Reason
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
              {returnRows}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}