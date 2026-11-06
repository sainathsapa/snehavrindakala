"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface AuditLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_values: any;
  new_values: any;
  user_email: string;
  user_role: string;
  created_at: string;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/audit-log", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to load audit log", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading audit log...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
            Audit Log
          </h1>
          <p className="text-muted-ink font-sans">
            Track system changes and admin actions.
          </p>
        </div>

        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <table className="w-full text-left divide-y divide-sand-border">
            <thead>
              <tr className="bg-surface">
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Entity</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Action</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Changes</th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {logs.length > 0 ? (
                logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-rang-paper/50">
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                      <span className="font-mono text-xs">{log.entity_type}</span>
                      <p className="text-xs text-muted-ink">{log.entity_id}</p>
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-deep-ink">{log.action}</td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">{log.user_email}</td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                      <span className="font-mono text-[10px]">
                        {JSON.stringify(log.old_values || {}).slice(0, 60)} → {JSON.stringify(log.new_values || {}).slice(0, 60)}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-sans text-sm text-muted-ink">{new Date(log.created_at).toLocaleDateString()}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} className="px-6 py-12 text-center"><p className="text-muted-ink font-sans">No audit log entries.</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}