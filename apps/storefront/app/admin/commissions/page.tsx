"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Commission {
  id: string;
  artist_name: string;
  amount: number;
  currency_code: string;
  status: string;
  created_at: string;
}

export default function CommissionsPage() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/commissions?limit=20", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: any) => {
        setCommissions(
          (data.commissions || []).map((c: any) => ({
            id: c.id || "",
            artist_name: c.artist_name || "",
            amount: c.amount || 0,
            currency_code: c.currency_code || "inr",
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
          <p className="text-muted-ink font-sans">Loading commissions...</p>
        </div>
      </main>
    );
  }

  const commissionRows =
    commissions.length > 0
      ? commissions.map((c: Commission) => (
          <tr key={c.id} className="hover:bg-rang-paper/50 transition-colors">
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              #{c.id.slice(-8)}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              {c.artist_name}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {c.currency_code?.toUpperCase()}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-deep-ink text-right">
              {(c.amount / 100).toFixed(2)}
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
            <td colSpan={6} className="px-6 py-12 text-center">
              <p className="text-muted-ink font-sans">
                No commissions found.
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
              Commissions
            </h1>
            <p className="text-muted-ink font-sans">
              Manage artist commissions and payouts.
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
                  Artist
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Currency
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">
                  Amount
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
              {commissionRows}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}