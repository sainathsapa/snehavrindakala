"use client";

/**
 * Admin queue of public partner onboarding applications.
 *
 * The list is read from the guarded admin API (the page shell is admin-only in
 * the same way as the neighbouring admin screens), and every row links to the
 * review screen where a decision is recorded through a Server Action.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface ApplicationSummary {
  id: string;
  legal_name: string;
  display_name: string;
  contact_email: string;
  review_status: string;
  created_at: string;
}

const STATUS_OPTIONS = ["pending", "more_info", "approved", "rejected"];
const LIMIT = 20;

function statusClass(status: string) {
  switch (status) {
    case "pending":
      return "bg-terracotta/10 text-terracotta border border-terracotta/20";
    case "more_info":
      return "bg-sindoor/10 text-sindoor border border-sindoor/20";
    case "approved":
      return "bg-leaf/10 text-leaf border border-leaf/20";
    default:
      return "bg-muted-ink/10 text-muted-ink border border-muted-ink/20";
  }
}

export default function PartnerApplicationsPage() {
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      limit: String(LIMIT),
      offset: String((page - 1) * LIMIT),
      q: search,
      ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    });
    fetch(`/api/admin/partner-applications?${params.toString()}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : { applications: [], count: 0 }))
      .then((data: any) => {
        setApplications(
          (data.applications || []).map((a: any) => ({
            id: a.id || "",
            legal_name: a.legal_name || "",
            display_name: a.display_name || "",
            contact_email: a.contact_email || "",
            review_status: a.review_status || "pending",
            created_at: a.created_at || "",
          }))
        );
        setTotalCount(data.count ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, search, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(totalCount / LIMIT));

  const rows =
    applications.length > 0
      ? applications.map((a) => (
          <tr key={a.id} className="hover:bg-rang-paper/50 transition-colors">
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              #{a.id.slice(-8)}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              {a.legal_name}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {a.display_name}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {a.contact_email}
            </td>
            <td className="px-6 py-4 font-sans text-sm">
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-medium font-sans ${statusClass(a.review_status)}`}
              >
                {a.review_status.replace("_", " ")}
              </span>
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}
            </td>
            <td className="px-6 py-4 font-sans text-sm">
              <Link
                href={`/admin/partner-applications/${a.id}`}
                className="text-sindoor font-medium hover:underline"
              >
                Review
              </Link>
            </td>
          </tr>
        ))
      : (
          <tr>
            <td colSpan={7} className="px-6 py-12 text-center">
              <p className="text-muted-ink font-sans">
                {loading ? "Loading applications…" : "No applications found."}
              </p>
            </td>
          </tr>
        );

  return (
    <main className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
            Partner Applications
          </h1>
          <p className="text-muted-ink font-sans">
            Review submissions from makers who want to join the marketplace.
          </p>
        </div>

        <div className="mb-6 rounded-xl border border-sand-border bg-surface p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Search name or email…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full px-4 py-2 rounded-md border border-sand-border bg-white text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
            />
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
                    {s.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase())}
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
                {[
                  "ID",
                  "Legal name",
                  "Display name",
                  "Contact",
                  "Status",
                  "Submitted",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">{rows}</tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-muted-ink font-sans">
              Showing {applications.length} of {totalCount} applications
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border border-sand-border bg-white px-3 py-1.5 text-sm font-sans text-deep-ink disabled:opacity-50 disabled:pointer-events-none hover:bg-rang-paper/50 transition-colors"
              >
                Prev
              </button>
              <span className="px-2 text-sm font-sans text-muted-ink">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-md border border-sand-border bg-white px-3 py-1.5 text-sm font-sans text-deep-ink disabled:opacity-50 disabled:pointer-events-none hover:bg-rang-paper/50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
