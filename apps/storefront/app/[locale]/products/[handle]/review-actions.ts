"use server";

/**
 * Submit a review from the product page.
 *
 * Reviews require a signed-in customer: the account is how the backend can
 * check for a real purchase and how it enforces one review per work. Everyone
 * else sees the approved reviews but not the form.
 *
 * A submitted review is queued for moderation (status "pending") — it is not
 * shown publicly until staff approve it. This is deliberate: nothing fabricated
 * or abusive ever reaches the store.
 */

import { medusa } from "@/lib/medusa";
import { getCurrentCustomer } from "@/lib/auth";

export interface ReviewFormState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function submitReviewAction(
  _prev: ReviewFormState,
  formData: FormData
): Promise<ReviewFormState> {
  const productId = String(formData.get("product_id") || "").trim();
  const variantId = String(formData.get("variant_id") || "").trim();
  const rating = Number(formData.get("rating"));
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const photosRaw = String(formData.get("photos") || "").trim();

  const fieldErrors: Record<string, string> = {};
  if (!productId) fieldErrors.product_id = "Missing product.";
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    fieldErrors.rating = "Choose a rating from 1 to 5 stars.";
  }
  if (body.length < 5) {
    fieldErrors.body = "Please write a sentence or two.";
  }

  const customer = await getCurrentCustomer().catch(() => null);
  if (!customer?.id) {
    return { error: "Please sign in to write a review." };
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  let photos: { key: string; mime_type?: string }[] | undefined;
  if (photosRaw) {
    try {
      const parsed = JSON.parse(photosRaw);
      if (Array.isArray(parsed)) {
        photos = parsed
          .filter((p) => p && typeof p.key === "string")
          .slice(0, 3)
          .map((p) => ({ key: p.key, mime_type: p.mime_type }));
      }
    } catch {
      // A malformed photo list is not worth failing the review over.
    }
  }

  const authorName =
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    undefined;

  try {
    await medusa.submitReview({
      product_id: productId,
      variant_id: variantId || undefined,
      customer_id: customer.id,
      author_name: authorName,
      rating,
      title: title || undefined,
      body,
      photos,
    });
    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not submit your review.";
    // The backend returns 409 for a duplicate; surface it plainly.
    if (/409|already reviewed/i.test(message)) {
      return { error: "You have already reviewed this piece." };
    }
    return { error: "We could not submit your review. Please try again." };
  }
}