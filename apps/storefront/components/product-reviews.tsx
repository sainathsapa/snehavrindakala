"use client";

/**
 * Product reviews: a rating summary, the approved reviews, and a submission
 * form for signed-in customers.
 *
 * Ratings are shown *only* when genuine approved reviews exist — there is no
 * decorative or seeded score anywhere. A customer who has not signed in sees the
 * reviews but is pointed to sign in rather than given a form that cannot work.
 */

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { StarRating } from "./star-rating";
import {
  submitReviewAction,
  type ReviewFormState,
} from "@/app/[locale]/products/[handle]/review-actions";

interface Review {
  id: string;
  author_name: string | null;
  rating: number;
  title: string | null;
  body: string;
  verified: boolean;
  created_at: string;
}

interface Summary {
  count: number;
  average: number | null;
  distribution: { rating: number; count: number }[];
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-sindoor px-5 py-2.5 font-sans text-sm font-medium text-rang-paper transition-colors hover:bg-sindoor/90 disabled:opacity-60"
    >
      {pending ? "Submitting…" : "Submit review"}
    </button>
  );
}

export function ProductReviews({
  productId,
  variantId,
  reviews,
  summary,
  canReview,
}: {
  productId: string;
  variantId?: string;
  reviews: Review[];
  summary: Summary;
  canReview: boolean;
}) {
  const [state, formAction] = useActionState<ReviewFormState, FormData>(
    submitReviewAction,
    {}
  );

  return (
    <section className="mt-16 border-t border-sand-border/60 pt-12">
      <h2 className="font-serif text-2xl font-semibold text-deep-ink">
        Reviews
      </h2>

      {summary.count === 0 ? (
        <p className="mt-3 font-sans text-sm text-muted-ink">
          No reviews yet. Be the first to share what this piece is like at home.
        </p>
      ) : (
        <div className="mt-4 flex items-center gap-4">
          <StarRating value={summary.average ?? 0} size={20} />
          <span className="font-sans text-sm text-deep-ink">
            {summary.average} · {summary.count}{" "}
            {summary.count === 1 ? "review" : "reviews"}
          </span>
        </div>
      )}

      {reviews.length > 0 && (
        <ul className="mt-8 space-y-6">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="border-b border-sand-border/50 pb-6 last:border-0"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StarRating value={review.rating} size={15} />
                {review.verified && (
                  <span className="rounded-full bg-leaf/10 px-2 py-0.5 font-sans text-[10px] font-medium uppercase tracking-wide text-leaf">
                    Verified purchase
                  </span>
                )}
                <span className="font-sans text-xs text-muted-ink">
                  {review.author_name || "A customer"} ·{" "}
                  {new Date(review.created_at).toLocaleDateString()}
                </span>
              </div>
              {review.title && (
                <p className="mt-2 font-serif text-base font-semibold text-deep-ink">
                  {review.title}
                </p>
              )}
              <p className="mt-1 font-sans text-sm leading-relaxed text-deep-ink/85">
                {review.body}
              </p>
            </li>
          ))}
        </ul>
      )}

      {/* Form: signed-in customers only. */}
      <div className="mt-10 rounded-sm border border-sand-border/70 bg-surface/60 p-6">
        {state.ok ? (
          <p className="font-sans text-sm text-leaf" role="status">
            Thank you — your review has been received and will appear once it is
            reviewed.
          </p>
        ) : canReview ? (
          <form action={formAction} className="space-y-4">
            <h3 className="font-serif text-lg font-semibold text-deep-ink">
              Write a review
            </h3>
            <input type="hidden" name="product_id" value={productId} />
            {variantId && (
              <input type="hidden" name="variant_id" value={variantId} />
            )}
            {state.error && (
              <p role="alert" className="font-sans text-sm text-red-700">
                {state.error}
              </p>
            )}
            <div>
              <label
                htmlFor="rating"
                className="block font-sans text-sm font-medium text-deep-ink"
              >
                Your rating
              </label>
              <select
                id="rating"
                name="rating"
                required
                defaultValue="5"
                className="mt-1 rounded-md border border-sand-border bg-surface px-3 py-2 font-sans text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "star" : "stars"}
                  </option>
                ))}
              </select>
              {state.fieldErrors?.rating && (
                <p className="mt-1 font-sans text-xs text-red-700">
                  {state.fieldErrors.rating}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="title"
                className="block font-sans text-sm font-medium text-deep-ink"
              >
                Title <span className="text-muted-ink">(optional)</span>
              </label>
              <input
                id="title"
                name="title"
                type="text"
                maxLength={120}
                className="mt-1 w-full rounded-md border border-sand-border bg-surface px-3 py-2 font-sans text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
              />
            </div>
            <div>
              <label
                htmlFor="body"
                className="block font-sans text-sm font-medium text-deep-ink"
              >
                Your review
              </label>
              <textarea
                id="body"
                name="body"
                rows={4}
                required
                className="mt-1 w-full rounded-md border border-sand-border bg-surface px-3 py-2 font-sans text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                placeholder="What is it like in person? How does it look at home?"
              />
              {state.fieldErrors?.body && (
                <p className="mt-1 font-sans text-xs text-red-700">
                  {state.fieldErrors.body}
                </p>
              )}
            </div>
            <SubmitButton />
          </form>
        ) : (
          <p className="font-sans text-sm text-muted-ink">
            <Link href="/account/login" className="text-sindoor underline">
              Sign in
            </Link>{" "}
            to write a review. Reviews are shown once approved.
          </p>
        )}
      </div>
    </section>
  );
}