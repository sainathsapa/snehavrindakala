"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface AuditLog {
  id: string;
  actor_email: string;
  action: string;
  resource_type: string;
  resource_id: string;
  created_at: string;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/audit-log?limit=20", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: any) => {
        setLogs(
          (data.logs || []).map((l: any) => ({
            id: l.id || "",
            actor_email: l.actor_email || "",
            action: l.action || "",
            resource_type: l.resource_type || "",
            resource_id: l.resource_id || "",
            created_at: l.created_at || "",
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
          <p className="text-muted-ink font-sans">Loading audit log...</p>
        </div>
      </main>
    );
  }

  const logRows =
    logs.length > 0
      ? logs.map((l: AuditLog) => (
          <tr key={l.id} className="hover:bg-rang-paper/50 transition-colors">
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              #{l.id.slice(-8)}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-deep-ink">
              {l.actor_email}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {l.action}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {l.resource_type}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {l.resource_id}
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {new Date(l.created_at).toLocaleDateString()}
            </td>
          </tr>
        ))
      : (
          <tr>
            <td colSpan={6} className="px-6 py-12 text-center">
              <p className="text-muted-ink font-sans">
                No audit log entries found.
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
              Audit Log
            </h1>
            <p className="text-muted-ink font-sans">
              View administrative audit trail.
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
                  Actor
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Resource Type
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Resource ID
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {logRows}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}