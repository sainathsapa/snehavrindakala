"use client";

/**
 * Review moderation.
 *
 * Staff see pending reviews first (the default filter), can approve or reject
 * with an optional note, and only approved reviews reach the public product
 * page. Nothing here fabricates a rating — this screen exists so a human
 * decides what is genuine before it is shown.
 */

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@snehavrinda-kala/ui";

interface AdminReview {
  id: string;
  product_id: string;
  author_name: string | null;
  rating: number;
  title: string | null;
  body: string;
  verified: boolean;
  verification_order_id: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
}

const STATUS_CLASSES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-700",
};

export default function ReviewsPage() {
  const [status, setStatus] = useState("pending");
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    fetch(`/api/admin/reviews?${params.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: any) => {
        setReviews(data.reviews ?? []);
        setError("");
      })
      .catch(() => setError("Could not load reviews."))
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const moderate = async (id: string, next: "approved" | "rejected") => {
    setActionId(id);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Action failed.");
        return;
      }
      load();
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-deep-ink">Reviews</h1>
        <div className="flex items-center gap-2">
          <Icon name="filter" size={16} className="text-muted-ink" />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border border-sand-border bg-surface px-3 py-1.5 text-sm text-deep-ink"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-ink">Loading…</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-muted-ink">No reviews in this queue.</p>
      ) : (
        <ul className="space-y-4">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="rounded-lg border border-sand-border bg-surface p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    STATUS_CLASSES[review.status] ?? "bg-gray-100 text-gray-700"
                  }`}
                >
                  {review.status}
                </span>
                <span className="text-sm text-deep-ink">
                  {"★".repeat(review.rating)}
                  <span className="text-muted-ink">
                    {"★".repeat(5 - review.rating)}
                  </span>
                </span>
                {review.verified ? (
                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium uppercase text-green-700">
                    Verified purchase
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-ink">Unverified</span>
                )}
                <span className="text-xs text-muted-ink">
                  {review.author_name || "A customer"} ·{" "}
                  {new Date(review.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-ink">
                Product: <span className="font-mono">{review.product_id}</span>
                {review.verification_order_id && (
                  <> · Order: {review.verification_order_id}</>
                )}
              </p>
              {review.title && (
                <p className="mt-2 font-medium text-deep-ink">{review.title}</p>
              )}
              <p className="mt-1 text-sm leading-relaxed text-deep-ink/85">
                {review.body}
              </p>
              {review.status === "pending" && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => moderate(review.id, "approved")}
                    disabled={actionId === review.id}
                    className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => moderate(review.id, "rejected")}
                    disabled={actionId === review.id}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              )}
              {review.admin_note && (
                <p className="mt-2 text-xs italic text-muted-ink">
                  Note: {review.admin_note}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}