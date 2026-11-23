"use client";

/**
 * Client-only action buttons for a single fulfilment group.
 *
 * The server passes ONLY the group id, its current status and a boolean RBAC
 * flag. No partner id (tenant id) is ever sent to or rendered by this component:
 * the tenancy is derived server-side from the signed session in every API route.
 * Nothing here reads, sends or displays any financial/payment field — the
 * payloads are strictly operational (`reason`, `to`, `shipment_id`).
 */

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { FulfilmentStatus } from "@/lib/fulfilment/types";

/** One forward step of the fulfilment machine (see lib/fulfilment/allocate.ts). */
const NEXT_FULFIL_STEP: Partial<Record<FulfilmentStatus, FulfilmentStatus>> = {
  accepted: "packing",
  packing: "ready_for_dispatch",
  ready_for_dispatch: "dispatched",
  dispatched: "delivered",
};

const STEP_LABEL: Record<FulfilmentStatus, string> = {
  assigned: "Assign",
  accepted: "Start packing",
  packing: "Mark ready for dispatch",
  ready_for_dispatch: "Mark dispatched",
  dispatched: "Mark delivered",
  delivered: "Delivered",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const BUTTON_CLASS =
  "rounded-xl bg-sindoor px-4 py-2.5 font-sans text-sm font-semibold text-rang-paper transition-colors hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY_CLASS =
  "rounded-xl border border-terracotta/30 bg-terracotta/5 px-4 py-2.5 font-sans text-sm font-semibold text-terracotta transition-colors hover:bg-terracotta/10 focus:outline-none focus:ring-2 focus:ring-terracotta disabled:cursor-not-allowed disabled:opacity-50";
const INPUT_CLASS =
  "w-full rounded-xl border border-sand-border bg-surface px-3 py-2.5 font-sans text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor";

export default function OrderActions({
  groupId,
  status,
  canWrite,
}: {
  groupId: string;
  status: FulfilmentStatus;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [shipmentId, setShipmentId] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function post(action: "accept" | "reject" | "fulfil", body: Record<string, unknown>) {
    setError("");
    setPending(action);
    try {
      // The group id is the only identity sent; the tenant comes from the session.
      const res = await fetch(`/api/partner/orders/${encodeURIComponent(groupId)}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "The action could not be completed. Please try again.");
        return false;
      }
      setReason("");
      setShipmentId("");
      router.refresh();
      return true;
    } catch {
      setError("We could not reach the service. Please try again.");
      return false;
    } finally {
      setPending(null);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>, run: () => Promise<boolean>) {
    event.preventDefault();
    void run();
  }

  if (!canWrite) {
    return (
      <p className="font-sans text-sm text-muted-ink">
        Your role has read-only access to orders. Operations actions are unavailable.
      </p>
    );
  }

  const nextStep = NEXT_FULFIL_STEP[status];
  const isAssigned = status === "assigned";

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="rounded-lg border border-terracotta/30 bg-terracotta/10 px-4 py-3 font-sans text-sm text-terracotta">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {isAssigned && (
          <form onSubmit={(e) => onSubmit(e, () => post("accept", {}))}>
            <button type="submit" disabled={pending !== null} className={BUTTON_CLASS}>
              {pending === "accept" ? "Accepting…" : "Accept order"}
            </button>
          </form>
        )}

        {nextStep && nextStep !== "dispatched" && (
          <form onSubmit={(e) => onSubmit(e, () => post("fulfil", { to: nextStep }))}>
            <button type="submit" disabled={pending !== null} className={BUTTON_CLASS}>
              {pending === "fulfil" ? "Updating…" : STEP_LABEL[nextStep]}
            </button>
          </form>
        )}
      </div>

      {isAssigned && (
        <form
          className="space-y-3 rounded-xl border border-sand-border bg-rang-paper/40 p-4"
          onSubmit={(e) => onSubmit(e, () => {
            if (!reason.trim()) {
              setError("A rejection reason is required.");
              return Promise.resolve(false);
            }
            return post("reject", { reason: reason.trim() });
          })}
        >
          <label htmlFor="reject-reason" className="block font-sans text-sm font-medium text-deep-ink">
            Reject this order
          </label>
          <textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Reason for rejection"
            className={INPUT_CLASS}
          />
          <button type="submit" disabled={pending !== null} className={SECONDARY_CLASS}>
            {pending === "reject" ? "Rejecting…" : "Reject order"}
          </button>
        </form>
      )}

      {nextStep === "dispatched" && (
        <form
          className="space-y-3 rounded-xl border border-sand-border bg-rang-paper/40 p-4"
          onSubmit={(e) => onSubmit(e, () =>
            post("fulfil", {
              to: "dispatched",
              ...(shipmentId.trim() ? { shipment_id: shipmentId.trim() } : {}),
            })
          )}
        >
          <label htmlFor="shipment-id" className="block font-sans text-sm font-medium text-deep-ink">
            Shipment reference (optional)
          </label>
          <input
            id="shipment-id"
            type="text"
            value={shipmentId}
            onChange={(e) => setShipmentId(e.target.value)}
            maxLength={120}
            placeholder="e.g. carrier tracking id"
            className={INPUT_CLASS}
          />
          <p className="font-sans text-xs text-muted-ink">
            This advances the status to dispatched and attaches an optional
            operational reference. It is never used for payment.
          </p>
          <button type="submit" disabled={pending !== null} className={BUTTON_CLASS}>
            {pending === "fulfil" ? "Updating…" : "Mark dispatched"}
          </button>
        </form>
      )}

      {(status === "delivered" || status === "rejected" || status === "cancelled") && (
        <p className="font-sans text-sm text-muted-ink">
          This order is in a terminal state ({STEP_LABEL[status].toLowerCase()}); no further
          action is available.
        </p>
      )}
    </div>
  );
}
