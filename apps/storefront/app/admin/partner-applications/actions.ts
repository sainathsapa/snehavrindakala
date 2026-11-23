"use server";

/**
 * Server actions for the partner onboarding review screen.
 *
 * The decision itself lives in `lib/partner-onboarding/review`; these actions
 * only enforce admin permission, derive the reviewer from the signed session
 * (never from the form), and pass a one-time result back to the UI.
 */

import { revalidatePath } from "next/cache";
import { getAdminIdentity, requirePermission } from "@/app/admin/actions";
import {
  AlreadyReviewedError,
  ApplicationNotFoundError,
  isReviewDecision,
  reviewApplication,
  ReviewValidationError,
} from "@/lib/partner-onboarding/review";

export interface ReviewActionState {
  ok: boolean;
  message: string;
  partnerId?: string | null;
  /** Shown once in the admin UI for a secure out-of-band handoff. */
  temporaryPassword?: string | null;
}

export async function reviewApplicationAction(
  _previous: ReviewActionState | null,
  formData: FormData
): Promise<ReviewActionState> {
  if (!(await requirePermission("partners:write"))) {
    return { ok: false, message: "Not authorised." };
  }

  const id = String(formData.get("id") || "");
  const decision = String(formData.get("decision") || "");
  const rawNotes = formData.get("notes");
  const notes = typeof rawNotes === "string" ? rawNotes : "";

  if (!isReviewDecision(decision)) {
    return { ok: false, message: "Invalid decision." };
  }

  const identity = await getAdminIdentity();
  if (!identity) {
    return { ok: false, message: "Not signed in." };
  }

  try {
    const result = await reviewApplication({
      id,
      decision,
      reviewerId: identity.email,
      notes: notes.trim() ? notes : null,
    });
    revalidatePath("/admin/partner-applications");
    revalidatePath(`/admin/partner-applications/${id}`);
    return {
      ok: true,
      message:
        decision === "approved"
          ? "Application approved. Partner account and owner invite created."
          : `Application marked ${decision.replace("_", " ")}.`,
      partnerId: result.partnerId,
      temporaryPassword: result.temporaryPassword,
    };
  } catch (err: any) {
    if (err instanceof ApplicationNotFoundError) {
      return { ok: false, message: err.message };
    }
    if (err instanceof AlreadyReviewedError) {
      return { ok: false, message: err.message };
    }
    if (err instanceof ReviewValidationError) {
      return { ok: false, message: err.message };
    }
    console.error("Failed to review partner application", err);
    return { ok: false, message: "Could not record this decision." };
  }
}
