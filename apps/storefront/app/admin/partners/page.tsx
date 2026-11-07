"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Partner {
  id: string;
  name: string;
  email: string;
  status: string;
  commission_rate: number;
  created_at: string;
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/partners?limit=20", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: any) => {
        setPartners(
          (data.partners || []).map((p: any) => ({
            id: p.id || "",
            name: p.name || "",
            email: p.email || "",
            status: p.status || "",
            commission_rate: p.commission_rate || 0,
            created_at: p.created_at || "",
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
          <p className="text-muted-ink font-sans">Loading partners...</p>
        </div>
      </main>
    );
  }

  const partnerRows =
    partners.length > 0
      ? partners.map((p: Partner) => (
          <tr key={p.id} className="hover:bg-rang-paper/50 transition-colors">
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              #{p.id.slice(-8)}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              {p.name}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {p.email}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              {p.status}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-deep-ink text-right">
              {p.commission_rate.toFixed(1)}%
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {new Date(p.created_at).toLocaleDateString()}
            </td>
            <td className="px-6 py-4 font-sans text-sm">
              <Link
                href={`/admin/partners/${p.id}/edit`}
                className="text-sindoor font-medium hover:underline"
              >
                Edit
              </Link>
            </td>
          </tr>
        ))
      : (
          <tr>
            <td colSpan={7} className="px-6 py-12 text-center">
              <p className="text-muted-ink font-sans">
                No partners found.
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
              Partners
            </h1>
            <p className="text-muted-ink font-sans">
              Manage partner artists.
            </p>
          </div>
          <Link
            href="/admin/partners/new"
            className="rounded-md bg-sindoor px-4 py-2 text-sm font-sans font-medium text-white hover:bg-sindoor/90 transition-colors"
          >
            New Partner
          </Link>
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
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">
                  Commission
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {partnerRows}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}