"use client";

import { useState, useEffect, useCallback } from "react";

interface Return {
  id: string;
  order_id: string;
  customer_email: string;
  reason: string;
  status: string;
  created_at: string;
}

const statusClasses: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-700",
  completed: "bg-blue-100 text-blue-800",
};

export default function ReturnsPage() {
  const [returns, setReturns] = useState<Return[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadReturns = useCallback(() => {
    fetch("/api/admin/returns?limit=100", { cache: "no-store" })
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

  useEffect(() => {
    loadReturns();
  }, [loadReturns]);

  async function updateStatus(ret: Return, status: string) {
    setActionId(ret.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/returns/${ret.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update return");
      loadReturns();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionId(null);
    }
  }

  async function removeReturn(ret: Return) {
    if (!confirm(`Delete return request ${ret.id}?`)) return;
    setActionId(ret.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/returns/${ret.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete return");
      loadReturns();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionId(null);
    }
  }

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
            <td className="px-6 py-4 font-sans text-sm">
              <span
                className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                  statusClasses[r.status] || "bg-gray-100 text-gray-600"
                }`}
              >
                {r.status}
              </span>
            </td>
            <td className="px-6 py-4 font-sans text-sm text-muted-ink">
              {new Date(r.created_at).toLocaleDateString()}
            </td>
            <td className="px-6 py-4 font-sans text-sm">
              <div className="flex items-center gap-3">
                {r.status === "pending" && (
                  <>
                    <button
                      onClick={() => updateStatus(r, "approved")}
                      disabled={actionId === r.id}
                      className="text-green-700 font-medium hover:underline disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => updateStatus(r, "rejected")}
                      disabled={actionId === r.id}
                      className="text-red-600 font-medium hover:underline disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </>
                )}
                {r.status === "approved" && (
                  <button
                    onClick={() => updateStatus(r, "completed")}
                    disabled={actionId === r.id}
                    className="text-blue-700 font-medium hover:underline disabled:opacity-50"
                  >
                    Mark completed
                  </button>
                )}
                <button
                  onClick={() => removeReturn(r)}
                  disabled={actionId === r.id}
                  className="text-red-600 font-medium hover:underline disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        ))
      : (
          <tr>
            <td colSpan={7} className="px-6 py-12 text-center">
              <p className="text-muted-ink font-sans">No returns found.</p>
            </td>
          </tr>
        );

  return (
    <main className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
              Returns &amp; Refunds
            </h1>
            <p className="text-muted-ink font-sans">
              Manage customer returns and refunds.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm text-red-700">
            {error}
          </div>
        )}

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
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">{returnRows}</tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
