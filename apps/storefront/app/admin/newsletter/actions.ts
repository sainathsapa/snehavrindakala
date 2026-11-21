"use server";

/**
 * Actions for the letter list.
 *
 * Unsubscribing keeps the row — a person who asked to stop is a fact worth
 * remembering, and it prevents a later import from adding them back. Deleting
 * is for erasure requests and removes the row entirely.
 */

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/app/admin/actions";
import { deleteSubscriber, unsubscribeEmail } from "@/lib/newsletter";

export async function unsubscribeSubscriberAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  await unsubscribeEmail(formData.get("email"));
  revalidatePath("/admin/newsletter");
}

export async function deleteSubscriberAction(formData: FormData): Promise<void> {
  if (!(await requireAdmin())) return;
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id <= 0) return;
  await deleteSubscriber(id);
  revalidatePath("/admin/newsletter");
}
