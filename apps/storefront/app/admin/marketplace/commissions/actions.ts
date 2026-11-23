"use server";

/**
 * Server actions for the commission policy configuration screen.
 *
 * Creating a policy here can ONLY produce a draft. Approval and activation are
 * separate, explicitly authorised operations owned by the finance API routes;
 * this action never stamps approved_by and never activates anything.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminIdentity, requirePermission } from "@/app/admin/actions";
import { query } from "@/lib/db";
import { auditFinanceAction } from "@/lib/finance/commission-policy";
import {
  buildDraftPolicy,
  parseCommissionFormValues,
  validateCommissionForm,
  type RawFormRecord,
} from "@/lib/finance-ui/preview";

const LIST_PATH = "/admin/marketplace/commissions";
const NEW_PATH = `${LIST_PATH}/new`;

function formToRecord(formData: FormData): RawFormRecord {
  const record: RawFormRecord = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") record[key] = value;
  }
  return record;
}

/** Redirect back to the form with the submitted values and a readable error. */
function backWithError(raw: RawFormRecord, message: string): never {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") params.set(key, value);
  }
  params.set("error", message);
  redirect(`${NEW_PATH}?${params.toString()}`);
}

/**
 * Create a DRAFT commission policy from the configuration form.
 *
 * Guards, in order:
 *  1. `settlements:write` permission (same gate as the finance API);
 *  2. every business field validated by the shared partner contract;
 *  3. explicit agreement confirmation + a named approver identity.
 * The approver is recorded in the audit trail as a proposed approver, never in
 * the policy's approved_by column.
 */
export async function createCommissionPolicyAction(formData: FormData): Promise<void> {
  if (!(await requirePermission("settlements:write"))) {
    throw new Error("Not authorised to configure commission policies.");
  }

  const raw = formToRecord(formData);
  const values = parseCommissionFormValues(raw);
  const identity = await getAdminIdentity();
  const actorEmail = identity?.email ?? "unknown";
  const actorRole = identity?.role ?? "unknown";

  const policy = buildDraftPolicy(values, actorEmail);
  const validation = validateCommissionForm({
    policy,
    confirmation: values.confirmation,
    approverIdentity: values.approverIdentity,
  });
  if (!validation.valid) {
    backWithError(raw, validation.errors.join(" · "));
  }

  try {
    const rows = (await query(
      "INSERT INTO commission_policy " +
        "(name, scope, scope_ref, rate_basis, tax_included, shipping_included, " +
        "rate_percent, fixed_amount, currency, refund_effect, payable_when, " +
        "status, version, effective_from, effective_to, approved_by, created_by) " +
        "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) " +
        "RETURNING *",
      [
        policy.name,
        policy.scope,
        policy.scope_ref,
        policy.rate_basis,
        policy.tax_included,
        policy.shipping_included,
        policy.rate_percent,
        policy.fixed_amount,
        policy.currency,
        policy.refund_effect,
        policy.payable_when,
        policy.status, // always "draft"
        policy.version,
        policy.effective_from,
        policy.effective_to,
        null, // approved_by — never set at creation
        policy.created_by,
      ]
    )) as Array<{ id?: string }>;

    await auditFinanceAction({
      actorEmail,
      actorRole,
      action: "commission_policy.created",
      entityType: "commission_policy",
      entityId: rows[0]?.id ?? null,
      metadata: {
        status: "draft",
        proposed_approver: values.approverIdentity.trim(),
        agreed_to_signed_terms: true,
      },
    });
  } catch (error: any) {
    backWithError(raw, error?.message || "Could not save the commission policy.");
  }

  revalidatePath(LIST_PATH);
  revalidatePath(NEW_PATH);
  redirect(`${LIST_PATH}?created=1`);
}
