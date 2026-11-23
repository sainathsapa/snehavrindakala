/**
 * Partner-portal shipment and fulfilment-customer reads.
 *
 * Every query here goes through `tenantQuery(ctx, ...)` with a literal
 * `{partner}` predicate, so the only partner id that can reach the database is
 * the one derived from the verified server-side `PartnerContext`. A shipment or
 * customer group belonging to another partner simply produces no rows even if
 * its id is known/guessed.
 *
 * The customer view is deliberately fulfilment-only. It is built on top of the
 * existing `getFulfilmentCustomer` scoped helper and then passed through a
 * strict allow-list (`redactCustomerView`) so that even a buggy query that
 * accidentally selects billing/payment/customer PII cannot leak it to the
 * partner portal.
 */

import type { PartnerContext } from "@/lib/partner/types";
import {
  getFulfilmentCustomer,
  listPartnerFulfilmentGroups,
  tenantQuery,
  type QueryExecutor,
} from "@/lib/partner/repository";

/** Columns a partner may see for a shipment of one of its fulfilment groups. */
export interface PartnerShipmentRow {
  shipment_record_id: string;
  order_id: string;
  group_id: string;
  fulfilment_status: string;
  items: unknown;
  shipment_id: string | null;
  shiprocket_order_id: string | null;
  awb_code: string | null;
  courier_name: string | null;
  courier_service: string | null;
  tracking_url: string | null;
  shipment_status: string;
  updated_at: string | Date;
}

/** The only customer information a fulfilling partner is allowed to see. */
export interface FulfilmentCustomerView {
  group_id: string;
  items: unknown;
  customer_order_id: string;
  status: string;
  /** Sanitised delivery contact (name/address only), when the source provides one. */
  shipping_contact?: Record<string, unknown>;
}

/**
 * Shipments live in `order_shipments` (keyed by Medusa order id); a shipment is
 * relevant to a partner only when it is joined to one of that partner's
 * `fulfilment_group` rows via the shared `customer_order_id`.
 */
const SHIPMENT_SELECT =
  "SELECT os.id AS shipment_record_id, os.order_id, " +
  "fg.id AS group_id, fg.status AS fulfilment_status, fg.items, " +
  "os.shipment_id, os.shiprocket_order_id, os.awb_code, " +
  "os.courier_name, os.courier_service, os.tracking_url, " +
  "os.status AS shipment_status, os.updated_at " +
  "FROM fulfilment_group fg " +
  "JOIN order_shipments os ON os.order_id = fg.customer_order_id ";

export function listPartnerShipments(
  ctx: PartnerContext,
  ex?: QueryExecutor
): Promise<PartnerShipmentRow[]> {
  return tenantQuery<PartnerShipmentRow>(
    ctx,
    SHIPMENT_SELECT + " WHERE fg.partner_id = {partner} ORDER BY os.updated_at DESC LIMIT 200",
    [],
    ex
  );
}

/** A single shipment, returned only if its group belongs to `ctx.partnerId`. */
export function getShipmentForGroup(
  ctx: PartnerContext,
  groupId: string,
  ex?: QueryExecutor
): Promise<PartnerShipmentRow[]> {
  return tenantQuery<PartnerShipmentRow>(
    ctx,
    SHIPMENT_SELECT + " WHERE fg.id = $1 AND fg.partner_id = {partner} LIMIT 1",
    [groupId],
    ex
  );
}

/* ── Fulfilment-only customer view ───────────────────────────────────────── */

/** Strict allow-list: anything not listed here (email, phone, payment, etc.) is dropped. */
const SAFE_CUSTOMER_FIELDS = [
  "group_id",
  "items",
  "customer_order_id",
  "status",
  "shipping_contact",
] as const;

/** Nested allow-list for a shipping contact — delivery name/address only. */
const SAFE_CONTACT_FIELDS = [
  "name",
  "full_name",
  "recipient",
  "address",
  "address1",
  "address2",
  "line1",
  "line2",
  "city",
  "state",
  "postal_code",
  "postcode",
  "country",
] as const;

/**
 * Pure defence-in-depth redaction. Keeps only fulfilment-relevant fields and a
 * sanitised shipping contact; strips every other field, including accidental
 * `email`, `phone`, `payment_*`, `card_*`, billing and full-customer columns.
 */
export function redactCustomerView(
  row: Record<string, any> | null | undefined
): FulfilmentCustomerView | null {
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;

  const out: Record<string, any> = {};
  for (const key of SAFE_CUSTOMER_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(row, key)) continue;
    const value = row[key];
    if (key === "shipping_contact") {
      // Only a plain object of allow-listed delivery fields survives. Free-form
      // strings/arrays could carry PII, so they are dropped entirely.
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const contact: Record<string, any> = {};
        for (const ck of SAFE_CONTACT_FIELDS) {
          if (Object.prototype.hasOwnProperty.call(value, ck)) {
            contact[ck] = value[ck];
          }
        }
        out[key] = contact;
      }
      continue;
    }
    out[key] = value;
  }
  return out as FulfilmentCustomerView;
}

/**
 * Fulfilment-relevant customer context for every group owned by the partner.
 * Uses only the scoped `getFulfilmentCustomer` helper and never reads billing,
 * payment, refund or full-customer records.
 */
export async function fulfilmentCustomers(
  ctx: PartnerContext,
  ex?: QueryExecutor
): Promise<FulfilmentCustomerView[]> {
  const groups = await listPartnerFulfilmentGroups(ctx, ex);
  const rows = await Promise.all(
    groups.map(async (group: any) => {
      const match = await getFulfilmentCustomer(ctx, group.id, ex);
      return match[0] ?? null;
    })
  );
  return rows
    .filter((row): row is Record<string, any> => Boolean(row))
    .map((row) => redactCustomerView(row))
    .filter((view): view is FulfilmentCustomerView => Boolean(view));
}
