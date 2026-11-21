"use server";

/**
 * Withdrawing a studio update.
 *
 * Soft delete: the row keeps its date and text, so a buyer who already read it
 * and asks about it later can still be answered honestly.
 */

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/app/admin/actions";
import { deleteMilestone } from "@/lib/commission-progress";

export async function removeUpdateAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const milestone = formData.get("milestone");
  const commission = formData.get("commission");
  if (typeof milestone !== "string") return;
  await deleteMilestone(milestone);
  if (typeof commission === "string") {
    revalidatePath(`/admin/commissions/requests/${commission}`);
  }
}
