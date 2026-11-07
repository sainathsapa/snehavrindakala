"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Icon } from "@snehavrinda-kala/ui";

interface Partner {
  id: string;
  name: string;
  email: string;
  status: string;
  commission_rate: number;
  created_at: string;
}

const STATUS_OPTIONS = ["pending", "approved", "active", "inactive"];

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const LIMIT = 20;

  const loadPartners = useCallback(() => {
    const params = new URLSearchParams({
      limit: String(LIMIT),
      offset: String((page - 1) * LIMIT),
      q: search,
      ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    });
    fetch(`/api/admin/partners?${params.toString()}`, { cache: "no-store" })
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
        setTotalCount(data.count ?? partners.length);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, search, statusFilter, LIMIT, partners.length]);

  useEffect(() => {
    loadPartners();
  }, [loadPartners]);

  const totalPages = Math.max(1, Math.ceil(totalCount / LIMIT));

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
            <Icon name="add" size={16} className="mr-1" />
            New Partner
          </Link>
        </div>

        {/* Search & filter */}
        <div className="mb-6 rounded-xl border border-sand-border bg-surface p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="relative">
              <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-ink" />
              <input
                type="text"
                placeholder="Search partner name or email…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-10 pr-4 py-2 rounded-md border border-sand-border bg-white text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
              />
            </div>
            <div>
              <label className="block text-xs font-sans font-medium text-muted-ink mb-2 uppercase tracking-wider">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-md border border-sand-border bg-white px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
              >
                <option value="all">All statuses</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setPage(1);
                }}
                className="rounded-md border border-sand-border bg-white px-4 py-2 text-sm font-sans text-deep-ink hover:bg-rang-paper transition-colors"
              >
                Reset
              </button>
            </div>
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-muted-ink font-sans">
              Showing {partners.length} of {totalCount} partners
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border border-sand-border bg-white px-3 py-1.5 text-sm font-sans text-deep-ink disabled:opacity-50 disabled:pointer-events-none hover:bg-rang-paper/50 transition-colors"
              >
                <Icon name="chevron-left" size={16} /> Prev
              </button>
              <span className="px-2 text-sm font-sans text-muted-ink">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-md border border-sand-border bg-white px-3 py-1.5 text-sm font-sans text-deep-ink disabled:opacity-50 disabled:pointer-events-none hover:bg-rang-paper/50 transition-colors"
              >
                Next <Icon name="chevron-right" size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
