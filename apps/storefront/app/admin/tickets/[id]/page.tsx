"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@snehavrinda-kala/ui";
import { useSearchParams } from "next/navigation";

interface Ticket {
  id: string;
  subject: string;
  message: string;
  email: string;
  name: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

interface TicketReply {
  id: string;
  message: string;
  author: string;
  author_type: string;
  created_at: string;
}

export default function TicketDetailPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [replies, setReplies] = useState<TicketReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [replying, setReplying] = useState(false);
  const [newReply, setNewReply] = useState("");

  useEffect(() => {
    if (id) {
      loadTicket(id);
    }
  }, [id]);

  async function loadTicket(ticketId: string) {
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000"}/api/tickets/${ticketId}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        setTicket(data.ticket);
        setReplies(data.replies || []);
      }
    } catch (err) {
      console.error("Failed to load ticket", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    setSaving(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000"}/api/admin/tickets/${id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      if (res.ok) {
        setSaving(false);
        loadTicket(id);
      } else {
        setSaving(false);
      }
    } catch {
      setSaving(false);
    }
  }

  async function handleAddReply(e: React.FormEvent) {
    e.preventDefault();
    if (!newReply.trim()) return;
    setReplying(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000"}/api/admin/tickets/${id}/reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: newReply,
            author: "Admin",
            author_type: "staff",
          }),
        }
      );
      if (res.ok) {
        setNewReply("");
        setReplying(false);
        loadTicket(id);
      } else {
        setReplying(false);
      }
    } catch {
      setReplying(false);
    }
  }

  if (loading) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Loading ticket...</p>
        </div>
      </main>
    );
  }

  if (!ticket) {
    return (
      <main className="py-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <p className="text-muted-ink font-sans">Ticket not found.</p>
        </div>
      </main>
    );
  }

  const getStatusClass = (s: string) => {
    switch (s) {
      case "open":
        return "bg-terracotta/10 text-terracotta border border-terracotta/20";
      case "in_progress":
        return "bg-sindoor/10 text-sindoor border border-sindoor/20";
      case "resolved":
        return "bg-leaf/10 text-leaf border border-leaf/20";
      case "closed":
        return "bg-muted-ink/10 text-muted-ink border border-muted-ink/20";
      default:
        return "bg-muted-ink/10 text-muted-ink border border-muted-ink/20";
    }
  };

  const getPriorityClass = (p: string) => {
    switch (p) {
      case "high":
        return "bg-sindoor/10 text-sindoor border border-sindoor/20";
      case "medium":
        return "bg-terracotta/10 text-terracotta border border-terracotta/20";
      default:
        return "bg-leaf/10 text-leaf border border-leaf/20";
    }
  };

  return (
    <main className="py-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/admin/tickets"
            className="inline-flex items-center gap-2 text-sindoor font-sans font-medium hover:underline mb-4"
          >
            ← Back to Tickets
          </Link>
          <h1 className="text-3xl font-serif font-semibold text-deep-ink tracking-tight">
            Ticket #{ticket.id.slice(-6)}
          </h1>
          <p className="text-muted-ink font-sans">
            Support request from {ticket.name}
          </p>
        </div>

        <div className="rounded-xl border border-sand-border bg-surface p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-serif font-semibold text-deep-ink">
                {ticket.subject}
              </h2>
              <p className="text-sm text-muted-ink font-sans">
                {ticket.email}
              </p>
            </div>
            <div className="flex gap-2">
              <span
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium font-sans ${getStatusClass(ticket.status)}`}
              >
                {ticket.status}
              </span>
              <span
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium font-sans ${getPriorityClass(ticket.priority)}`}
              >
                {ticket.priority}
              </span>
            </div>
          </div>

          <div className="bg-rang-paper rounded-md p-4 border border-sand-border mb-6">
            <p className="text-sm font-sans text-deep-ink leading-relaxed">
              {ticket.message}
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => handleStatusChange("open")}
              disabled={saving}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${
                ticket.status === "open"
                  ? "bg-leaf/10 text-leaf border border-leaf/20"
                  : "border border-sand-border text-deep-ink hover:bg-rang-paper/50"
              }`}
            >
              Reopen
            </Button>
            <Button
              onClick={() => handleStatusChange("in_progress")}
              disabled={saving}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${
                ticket.status === "in_progress"
                  ? "bg-sindoor/10 text-sindoor border border-sindoor/20"
                  : "border border-sand-border text-deep-ink hover:bg-rang-paper/50"
              }`}
            >
              Start Work
            </Button>
            <Button
              onClick={() => handleStatusChange("resolved")}
              disabled={saving}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${
                ticket.status === "resolved"
                  ? "bg-terracotta/10 text-terracotta border border-terracotta/20"
                  : "border border-sand-border text-deep-ink hover:bg-rang-paper/50"
              }`}
            >
              Mark Resolved
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-sand-border bg-surface overflow-hidden">
          <div className="border-b border-sand-border bg-rang-paper p-6">
            <h2 className="text-lg font-serif font-semibold text-deep-ink">
              Conversation ({replies.length})
            </h2>
          </div>
          <div className="divide-y divide-sand-border">
            {replies.length > 0 ? (
              replies.map((reply) => (
                <div key={reply.id} className="p-6 border-b border-sand-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-sans font-semibold text-deep-ink">
                      {reply.author}
                    </span>
                    <span className="text-xs text-muted-ink font-sans">
                      {new Date(reply.created_at).toLocaleString()}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        reply.author_type === "staff"
                          ? "bg-sindoor/10 text-sindoor border border-sindoor/20"
                          : "bg-leaf/10 text-leaf border border-leaf/20"
                      }`}
                    >
                      {reply.author_type}
                    </span>
                  </div>
                  <p className="text-sm font-sans text-deep-ink leading-relaxed">
                    {reply.message}
                  </p>
                </div>
              ))
            ) : (
              <div className="p-12 text-center">
                <p className="text-muted-ink font-sans">
                  No replies yet. Start the conversation below.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-sand-border bg-surface p-6">
          <h2 className="text-lg font-serif font-semibold text-deep-ink mb-4">
            Send Reply
          </h2>
          <form onSubmit={handleAddReply} className="space-y-4">
            <div>
              <label className="block text-sm font-sans font-medium text-deep-ink mb-2">
                Your Reply
              </label>
              <textarea
                name="message"
                value={newReply}
                onChange={(e) => setNewReply(e.target.value)}
                rows={4}
                placeholder="Type your response to the customer..."
                className="w-full px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans focus:ring-2 focus:ring-sindoor"
              />
            </div>
            <Button
              type="submit"
              disabled={replying || !newReply.trim()}
              className="w-auto px-8 py-3 bg-sindoor text-rang-paper rounded-xl font-semibold hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 transition-colors disabled:opacity-50"
            >
              {replying ? "Sending…" : "Send Reply"}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
