/**
 * New commission policy — configuration form + PREVIEW.
 *
 * Server-rendered. Preview is computed on the server by the pure
 * `previewCommission` helper from the current field values; it shows
 * illustrative money for the entered rate but never approves, activates or
 * enables settlement. Submitting can only create a draft.
 */

import Link from "next/link";
import { getAdminIdentity, requirePermission } from "@/app/admin/actions";
import {
  buildDraftPolicy,
  parseCommissionFormValues,
  previewCommission,
  validateCommissionForm,
  type CommissionFormValues,
} from "@/lib/finance-ui/preview";
import { createCommissionPolicyAction } from "../actions";

export const dynamic = "force-dynamic";

const SELF = "/admin/marketplace/commissions/new";

async function canEdit(): Promise<boolean> {
  const identity = await getAdminIdentity();
  if (!identity || identity.role === "partner") return false;
  return requirePermission("settlements:write");
}

function AccessDenied() {
  return (
    <main className="py-8">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-xl border border-sand-border bg-surface p-8 text-center">
          <h1 className="font-serif text-2xl font-semibold text-deep-ink">Not available</h1>
          <p className="mt-2 font-sans text-sm text-muted-ink">
            You do not have permission to configure commission policies.
          </p>
        </div>
      </div>
    </main>
  );
}

const fieldClass =
  "mt-1 w-full rounded-md border border-sand-border bg-white px-3 py-2 font-sans text-sm text-deep-ink";
const labelClass =
  "block text-xs font-sans font-medium uppercase tracking-wider text-muted-ink";

function Checkbox({
  name,
  label,
  checked,
}: {
  name: string;
  label: string;
  checked: boolean;
}) {
  return (
    <label className="flex items-start gap-2 font-sans text-sm text-deep-ink">
      <input
        type="checkbox"
        name={name}
        value="on"
        defaultChecked={checked}
        className="mt-0.5 h-4 w-4 rounded border-sand-border"
      />
      <span>{label}</span>
    </label>
  );
}

function Select({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      <select name={name} defaultValue={value} className={fieldClass}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function money(value: number, currency: string): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function NewCommissionPolicyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!(await canEdit())) return <AccessDenied />;
  const params = await searchParams;

  const values: CommissionFormValues = parseCommissionFormValues(params);
  const policy = buildDraftPolicy(values);
  const formCheck = validateCommissionForm({
    policy,
    confirmation: values.confirmation,
    approverIdentity: values.approverIdentity,
  });
  const preview = previewCommission(policy);

  return (
    <main className="py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <header className="mb-6">
          <nav className="mb-3 font-sans text-sm text-sindoor">
            <Link href="/admin/marketplace/commissions" className="hover:underline">
              ← Commission policies
            </Link>
          </nav>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-deep-ink">
            New commission policy
          </h1>
          <p className="mt-2 max-w-3xl font-sans text-sm text-muted-ink">
            Every field below is a business input — nothing is defaulted from a
            rate card. Saving creates a <strong>draft</strong> only. Previewing
            shows illustrative numbers and does not approve, activate or enable
            settlement.
          </p>
        </header>

        {params.error && (
          <div
            role="alert"
            className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 font-sans text-sm text-red-700"
          >
            <span className="font-medium">Not saved.</span>{" "}
            {Array.isArray(params.error) ? params.error.join(", ") : params.error}
          </div>
        )}

        {/* Plain GET form: Preview re-renders this page with the entered values.
            The Save button overrides with a server action that writes a draft. */}
        <form action={SELF} method="get" className="space-y-6">
          <section className="rounded-xl border border-sand-border bg-surface p-6">
            <h2 className="mb-4 font-serif text-lg font-semibold text-deep-ink">
              Identity &amp; scope
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className={labelClass}>Policy name</span>
                <input
                  name="name"
                  defaultValue={values.name}
                  className={fieldClass}
                  placeholder="e.g. Standard craft commission 2026"
                />
              </label>
              <Select
                name="scope"
                label="Scope"
                value={values.scope}
                options={[
                  { value: "global", label: "Global" },
                  { value: "partner", label: "Partner" },
                  { value: "category", label: "Category" },
                  { value: "product", label: "Product" },
                ]}
              />
              <label className="block">
                <span className={labelClass}>Scope reference (not for global)</span>
                <input
                  name="scope_ref"
                  defaultValue={values.scope_ref}
                  className={fieldClass}
                  placeholder="partner / category / product id"
                />
              </label>
              <label className="block">
                <span className={labelClass}>Currency</span>
                <input
                  name="currency"
                  defaultValue={values.currency}
                  className={fieldClass}
                  placeholder="INR"
                />
              </label>
              <label className="block">
                <span className={labelClass}>Effective from</span>
                <input
                  type="date"
                  name="effective_from"
                  defaultValue={values.effective_from}
                  className={fieldClass}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Effective to (optional)</span>
                <input
                  type="date"
                  name="effective_to"
                  defaultValue={values.effective_to}
                  className={fieldClass}
                />
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-sand-border bg-surface p-6">
            <h2 className="mb-4 font-serif text-lg font-semibold text-deep-ink">
              Rate &amp; calculation basis
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                name="rate_basis"
                label="Rate basis"
                value={values.rate_basis}
                options={[
                  { value: "gross_item_value", label: "Gross item value" },
                  { value: "discounted_item_value", label: "Discounted item value" },
                ]}
              />
              <label className="block">
                <span className={labelClass}>Rate percent (0–100)</span>
                <input
                  type="number"
                  step="0.001"
                  name="rate_percent"
                  defaultValue={values.rate_percent}
                  className={fieldClass}
                  placeholder="Leave blank when using a fixed amount"
                />
              </label>
              <label className="block">
                <span className={labelClass}>Fixed amount per item</span>
                <input
                  type="number"
                  step="0.01"
                  name="fixed_amount"
                  defaultValue={values.fixed_amount}
                  className={fieldClass}
                  placeholder="Leave blank when using a percent"
                />
              </label>
              <p className="self-end font-sans text-xs text-muted-ink sm:col-span-2">
                Fill <strong>exactly one</strong> of rate percent or fixed amount.
                Neither field is invented for you.
              </p>
              <div className="space-y-3 sm:col-span-2">
                <Checkbox
                  name="tax_included"
                  label="Include tax in the commission basis"
                  checked={values.tax_included}
                />
                <Checkbox
                  name="shipping_included"
                  label="Include shipping in the commission basis"
                  checked={values.shipping_included}
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-sand-border bg-surface p-6">
            <h2 className="mb-4 font-serif text-lg font-semibold text-deep-ink">
              Refunds &amp; payout timing
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                name="refund_effect"
                label="Refund effect"
                value={values.refund_effect}
                options={[
                  { value: "reverse_earnings", label: "Reverse earnings" },
                  { value: "no_reversal", label: "No reversal" },
                ]}
              />
              <Select
                name="payable_when"
                label="Payable when"
                value={values.payable_when}
                options={[
                  { value: "order_paid", label: "Order paid" },
                  { value: "order_delivered", label: "Order delivered" },
                  { value: "return_window_elapsed", label: "Return window elapsed" },
                ]}
              />
            </div>
          </section>

          {/* Preview — pure, server-computed, informational only. */}
          <section
            aria-labelledby="preview-heading"
            className="rounded-xl border border-sand-border bg-surface p-6"
          >
            <div className="flex flex-wrap items-center gap-3">
              <h2
                id="preview-heading"
                className="font-serif text-lg font-semibold text-deep-ink"
              >
                Preview (no changes made)
              </h2>
              <span
                className={`rounded-full border px-2 py-0.5 font-sans text-[10px] uppercase tracking-[0.14em] ${
                  preview.settlementEnabled
                    ? "bg-leaf/10 text-leaf border-leaf/20"
                    : "bg-sindoor/10 text-sindoor border-sindoor/20"
                }`}
              >
                {preview.settlementEnabled ? "settlement enabled" : "settlement disabled"}
              </span>
            </div>
            <p className="mt-2 font-sans text-sm text-muted-ink">
              Illustrative figures for example order values. A preview never
              approves, activates or settles a policy — this draft has status{" "}
              <code className="font-mono text-xs">{preview.status}</code> and
              cannot be used for payouts until it is approved and activated.
            </p>

            <div className="mt-4 overflow-hidden rounded-lg border border-sand-border">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-rang-paper/40">
                    <th className="px-4 py-2 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Example</th>
                    <th className="px-4 py-2 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Basis</th>
                    <th className="px-4 py-2 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Commission</th>
                    <th className="px-4 py-2 text-xs font-sans font-medium uppercase tracking-wider text-muted-ink">Partner payable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-border">
                  {preview.lines.map((line, index) => (
                    <tr key={line.label + index}>
                      <td className="px-4 py-2 font-sans text-sm text-deep-ink">
                        {line.label}
                      </td>
                      <td className="px-4 py-2 font-sans text-sm text-muted-ink">
                        {money(line.gross_basis, policy.currency)}
                      </td>
                      <td className="px-4 py-2 font-sans text-sm text-deep-ink">
                        {money(line.commission, policy.currency)}
                      </td>
                      <td className="px-4 py-2 font-sans text-sm text-deep-ink">
                        {money(line.payable, policy.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4">
              <h3 className="font-sans text-sm font-medium text-deep-ink">
                Validation checklist
              </h3>
              <ul className="mt-2 space-y-1" aria-label="Validation checklist">
                {formCheck.valid ? (
                  <li className="font-sans text-sm text-leaf">
                    ✓ Ready to save as a draft. Approval and activation are still required.
                  </li>
                ) : (
                  formCheck.errors.map((error) => (
                    <li key={error} className="font-sans text-sm text-sindoor">
                      ✗ {error}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </section>

          <section className="rounded-xl border border-sand-border bg-surface p-6">
            <h2 className="mb-4 font-serif text-lg font-semibold text-deep-ink">
              Confirmation &amp; accountability
            </h2>
            <div className="space-y-4">
              <Checkbox
                name="confirmation"
                label="I confirm this matches the signed partner agreement."
                checked={values.confirmation}
              />
              <label className="block">
                <span className={labelClass}>Approver identity (email)</span>
                <input
                  type="email"
                  name="approverIdentity"
                  defaultValue={values.approverIdentity}
                  className={fieldClass}
                  placeholder="finance@example.com"
                />
                <span className="mt-1 block font-sans text-xs text-muted-ink">
                  The accountable approver. Recorded in the audit trail as a
                  proposed approver; it does not approve or activate this draft.
                </span>
              </label>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="rounded-md border border-sand-border bg-white px-4 py-2 font-sans text-sm font-medium text-deep-ink transition-colors hover:border-sindoor"
            >
              Preview (no changes)
            </button>
            <button
              type="submit"
              formAction={createCommissionPolicyAction}
              formMethod="post"
              className="rounded-md bg-sindoor px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-sindoor/90"
            >
              Save as draft
            </button>
            <span className="font-sans text-xs text-muted-ink">
              The server re-validates every field (including the confirmation and
              approver) and will refuse an incomplete draft.
            </span>
          </div>
        </form>
      </div>
    </main>
  );
}
