"use client";

import { hasPermission } from "@/lib/rbac";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function TicketsPage() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status") || "";
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatePending, setUpdatePending] = useState<string | null>(null);

  useEffect(() => {
    loadTickets();
  }, [status]);

  async function loadTickets() {
    try {
      const res = await fetch(
        `${
          process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000"
        }/api/tickets?status=${status || ""}&limit=50`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        setTickets(Array.isArray(data.tickets) ? data.tickets : []);
      }
    } catch (err) {
      console.error("Failed to load tickets", err);
    } finally {
      setLoading(false);
    }
  }

  const handleStatusChange = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "open" ? "in_progress" : "open";
    setUpdatePending(id);
    try {
      await fetch(
        `${
          process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000"
        }/api/tickets/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      setUpdatePending(null);
      loadTickets();
    } catch {
      setUpdatePending(null);
    }
  };

  const getStatusClass = (ticketStatus: string) => {
    switch (ticketStatus) {
      case "open":
        return "bg-terracotta/10 text-terracotta border border-terracotta/20";
      case "in_progress":
        return "bg-sindoor/10 text-sindoor border border-sindoor/20";
      case "resolved":
        return "bg-leaf/10 text-leaf border border-leaf/20";
      default:
        return "bg-muted-ink/10 text-muted-ink border border-muted-ink/20";
    }
  };

  const getPriorityClass = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-sindoor/10 text-sindoor border border-sindoor/20";
      case "medium":
        return "bg-terracotta/10 text-terracotta border border-terracotta/20";
      default:
        return "bg-leaf/10 text-leaf border border-leaf/20";
    }
  };

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading tickets...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
              Support Tickets
            </h1>
            <p className="text-muted-ink font-sans">
              Customer support and helpdesk.
            </p>
          </div>
        </div>

        <div className="mb-6">
          <select
            defaultValue={status || ""}
            onChange={(e) => {
              // Client-side navigation
              const params = new URLSearchParams(window.location.search);
              if (e.target.value) params.set("status", e.target.value);
              else params.delete("status");
              window.location.search = params.toString();
            }}
            className="px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"
          >
            <option value="">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <table className="w-full text-left divide-y divide-sand-border">
            <thead>
              <tr className="bg-surface">
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Ticket
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Subject
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-4 text-xs font-sans font-medium text-muted-ink uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-border">
              {tickets.length > 0 ? (
                tickets.map((ticket: any) => {
                  const isPending = updatePending === ticket.id;
                  return (
                    <tr key={ticket.id} className="hover:bg-rang-paper/50">
                      <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                        #{ticket.id.slice(-6)}
                      </td>
                      <td className="px-6 py-4 font-sans text-sm text-deep-ink">
                        {ticket.subject}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-sans text-sm text-deep-ink">
                          {ticket.name || "Customer"}
                        </div>
                        <div className="text-xs text-muted-ink">
                          {ticket.email}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium font-sans ${getPriorityClass(ticket.priority)}`}
                        >
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium font-sans ${getStatusClass(ticket.status)}`}
                        >
                          {ticket.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-sans text-sm text-muted-ink">
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/admin/tickets/[id]?id=${ticket.id}`}
                          className="text-sm font-medium text-sindoor hover:underline mr-2"
                        >
                          View
                        </Link>
                        <button
                          onClick={() =>
                            handleStatusChange(ticket.id, ticket.status)
                          }
                          disabled={isPending}
                          className={`text-xs font-medium px-3 py-1 rounded-md transition-colors disabled:opacity-50 ${isPending ? "opacity-50" : ticket.status === "open" ? "bg-sindoor/10 text-sindoor hover:bg-sindoor/20" : "bg-leaf/10 text-leaf hover:bg-leaf/20"}`}
                        >
                          {isPending
                            ? "…"
                            : ticket.status === "open"
                              ? "Start"
                              : "Reopen"}
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <p className="text-muted-ink font-sans">
                      No support tickets found.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
