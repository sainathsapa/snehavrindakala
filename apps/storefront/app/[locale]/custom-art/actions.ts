"use server";

import { localeRedirect } from "@/lib/locale-redirect";
import { getLocale } from "next-intl/server";
import { medusa } from "@/lib/medusa";
import { getCurrentCustomer } from "@/lib/auth";
import { parseAttachmentList } from "@/lib/commission-upload";

export interface CommissionFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Submit a commission brief.
 *
 * Returns field-level errors instead of a single URL flag so the customer knows
 * which box to fix. Redirects to the tracking page on success.
 */
export async function createCommissionAction(
  _prev: CommissionFormState,
  formData: FormData
): Promise<CommissionFormState> {
  const artForm = String(formData.get("art_form") || "").trim();
  const brief = String(formData.get("brief") || "").trim();
  const budget = String(formData.get("budget_range") || "").trim();
  const targetDate = String(formData.get("target_date") || "").trim();
  const deliveryPin = String(formData.get("delivery_pin") || "").trim();
  const dimensions = String(formData.get("dimensions") || "").trim();
  const intendedUse = String(formData.get("intended_use") || "").trim();
  const consent = formData.get("consent");
  const email = String(formData.get("email") || "").trim();
  // Reference files are uploaded by the client before submit (to
  // /api/store/commission-upload) and their storage keys travel in this field as
  // JSON. They are private files, so the action only ever handles opaque keys,
  // never URLs. Parsing (and the 5-file cap) lives in a tested helper.
  const attachments = parseAttachmentList(String(formData.get("attachments") || ""));

  const fieldErrors: Record<string, string> = {};

  if (!artForm) fieldErrors.art_form = "Choose the kind of art you want.";
  if (!brief) {
    fieldErrors.brief = "Tell us what you have in mind.";
  } else if (brief.length < 20) {
    fieldErrors.brief =
      "A little more detail helps us quote accurately — 20 characters minimum.";
  }
  if (!consent) {
    fieldErrors.consent = "We need your consent before we can review references.";
  }
  if (deliveryPin && !/^\d{6}$/.test(deliveryPin)) {
    fieldErrors.delivery_pin = "Enter a 6-digit PIN code.";
  }
  if (targetDate && Number.isNaN(new Date(targetDate).getTime())) {
    fieldErrors.target_date = "That date does not look right.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors,
    };
  }

  const customer = await getCurrentCustomer().catch(() => null);

  let referenceId: string;
  try {
    const response = await medusa.createCommissionRequest({
      customer_id: customer?.id || undefined,
      customer_email: email || undefined,
      art_form: artForm,
      brief,
      intended_use: intendedUse || undefined,
      dimensions: dimensions || undefined,
      budget_range: budget || undefined,
      target_date: targetDate || undefined,
      delivery_pin: deliveryPin || undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
    referenceId = response.reference_id;
  } catch (error) {
    console.error("Failed to create commission request", error);
    return {
      error:
        "We could not submit your request. Please try again — nothing has been lost.",
    };
  }

  localeRedirect(`/commission-status/${encodeURIComponent(referenceId)}?new=1`, await getLocale());
}
