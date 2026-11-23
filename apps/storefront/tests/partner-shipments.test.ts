import { describe, it, expect } from "vitest";
import type { PartnerContext } from "@/lib/partner/types";
import {
  listPartnerShipments,
  getShipmentForGroup,
  fulfilmentCustomers,
  redactCustomerView,
} from "@/lib/partner-portal/shipments";

const ctxA: PartnerContext = {
  partnerId: "partner-A",
  membershipId: "member-A",
  email: "ops@partner-a.test",
  role: "operations",
  tokenVersion: 1,
};

interface FakeDb {
  groups: any[];
  shipments: any[];
}

/**
 * In-memory stand-in for the two tables. It honours the partner predicate that
 * `tenantQuery` binds as the last parameter, so a foreign id genuinely returns
 * no rows instead of being "found and then hidden".
 */
function dbExecutor(db: FakeDb, dirtyCustomer = false) {
  return async (sql: string, params: any[] = []) => {
    const partnerId = params[params.length - 1];

    if (sql.includes("JOIN order_shipments")) {
      const groupId = sql.includes("fg.id = $1") ? params[0] : null;
      return db.groups
        .filter((g) => g.partner_id === partnerId)
        .filter((g) => !groupId || g.id === groupId)
        .flatMap((g) =>
          db.shipments
            .filter((s) => s.order_id === g.customer_order_id)
            .map((s) => ({
              shipment_record_id: s.id,
              order_id: s.order_id,
              group_id: g.id,
              fulfilment_status: g.status,
              items: g.items,
              shipment_id: s.shipment_id,
              shiprocket_order_id: s.shiprocket_order_id ?? null,
              awb_code: s.awb_code,
              courier_name: s.courier_name,
              courier_service: s.courier_service ?? null,
              tracking_url: s.tracking_url ?? null,
              shipment_status: s.status,
              updated_at: "2026-01-01T00:00:00Z",
            }))
        );
    }

    if (sql.includes("AS group_id")) {
      const groupId = params[0];
      return db.groups
        .filter((g) => g.id === groupId && g.partner_id === partnerId)
        .map((g) => ({
          group_id: g.id,
          items: g.items,
          customer_order_id: g.customer_order_id,
          status: g.status,
          ...(dirtyCustomer
            ? {
                email: "buyer@example.com",
                phone: "+919999999999",
                payment_method: "card",
                card_last4: "4242",
                shipping_contact: {
                  name: "Buyer Name",
                  city: "Pune",
                  email: "buyer@example.com",
                  phone: "+919999999999",
                },
              }
            : {}),
        }));
    }

    if (sql.includes("FROM fulfilment_group WHERE")) {
      return db.groups.filter((g) => g.partner_id === partnerId);
    }

    return [];
  };
}

const db: FakeDb = {
  groups: [
    {
      id: "group-A",
      partner_id: "partner-A",
      customer_order_id: "order-A",
      status: "dispatched",
      items: [{ item_id: "item-1", quantity: 1 }],
    },
    {
      id: "group-B",
      partner_id: "partner-B",
      customer_order_id: "order-B",
      status: "assigned",
      items: [{ item_id: "item-2", quantity: 2 }],
    },
  ],
  shipments: [
    {
      id: "shp-A",
      order_id: "order-A",
      partner_id: "partner-A",
      awb_code: "AWB111",
      courier_name: "Courier A",
      shipment_id: "sr-111",
      status: "shipped",
    },
    {
      id: "shp-B",
      order_id: "order-B",
      partner_id: "partner-B",
      awb_code: "AWB222",
      courier_name: "Courier B",
      shipment_id: "sr-222",
      status: "created",
    },
  ],
};

describe("partner shipment reads are tenant-scoped", () => {
  it("lists only shipments joined to this partner's fulfilment groups", async () => {
    const rows = await listPartnerShipments(ctxA, dbExecutor(db));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      group_id: "group-A",
      order_id: "order-A",
      awb_code: "AWB111",
      courier_name: "Courier A",
      fulfilment_status: "dispatched",
      shipment_status: "shipped",
    });
  });

  it("a cross-partner shipment/group id returns nothing", async () => {
    const ex = dbExecutor(db);
    expect(await getShipmentForGroup(ctxA, "group-B", ex)).toEqual([]);
    expect(await getShipmentForGroup(ctxA, "shp-B", ex)).toEqual([]);
    // Own group still resolves, proving the executor is not just always empty.
    expect(await getShipmentForGroup(ctxA, "group-A", ex)).toHaveLength(1);
  });
});

describe("redactCustomerView — fulfilment-only, defence in depth", () => {
  it("keeps only group/order/items/status and a sanitised delivery contact", () => {
    const clean = redactCustomerView({
      group_id: "group-A",
      items: [{ item_id: "item-1", quantity: 1 }],
      customer_order_id: "order-A",
      status: "dispatched",
      shipping_contact: {
        name: "Buyer Name",
        city: "Pune",
        email: "buyer@example.com",
        phone: "+919999999999",
      },
    });

    expect(clean).toEqual({
      group_id: "group-A",
      items: [{ item_id: "item-1", quantity: 1 }],
      customer_order_id: "order-A",
      status: "dispatched",
      shipping_contact: { name: "Buyer Name", city: "Pune" },
    });
  });

  it("removes email, phone, payment and other full-customer fields", () => {
    const clean = redactCustomerView({
      group_id: "group-A",
      items: [],
      customer_order_id: "order-A",
      status: "assigned",
      email: "buyer@example.com",
      phone: "+919999999999",
      payment_method: "card",
      card_last4: "4242",
      payment_intent_id: "pi_123",
      billing_address: { line1: "Secret street" },
      gstin: "GSTIN-SECRET",
      full_name: "Full Customer Name",
    })!;

    for (const leaked of [
      "email",
      "phone",
      "payment_method",
      "card_last4",
      "payment_intent_id",
      "billing_address",
      "gstin",
      "full_name",
    ]) {
      expect(clean).not.toHaveProperty(leaked);
    }
    expect(clean.group_id).toBe("group-A");
  });

  it("drops free-form or non-object shipping contacts entirely", () => {
    const clean = redactCustomerView({
      group_id: "group-A",
      customer_order_id: "order-A",
      status: "assigned",
      shipping_contact: "Buyer, +919999999999, buyer@example.com",
    })!;
    expect(clean).not.toHaveProperty("shipping_contact");
  });
});

describe("fulfilmentCustomers never exposes sensitive fields", () => {
  it("redacts dirty rows returned by the scoped helper", async () => {
    const views = await fulfilmentCustomers(ctxA, dbExecutor(db, true));
    expect(views).toHaveLength(1);
    const view = views[0] as any;
    expect(Object.keys(view).sort()).toEqual(
      ["customer_order_id", "group_id", "items", "shipping_contact", "status"].sort()
    );
    expect(view.shipping_contact).toEqual({ name: "Buyer Name", city: "Pune" });
    expect(view).not.toHaveProperty("email");
    expect(view).not.toHaveProperty("phone");
    expect(view).not.toHaveProperty("payment_method");
  });

  it("every generated SQL statement carries the partner predicate", async () => {
    const calls: Array<{ sql: string; params: any[] }> = [];
    const ex = async (sql: string, params: any[] = []) => {
      calls.push({ sql, params });
      if (sql.includes("AS group_id")) return [{ group_id: "group-A", items: [], customer_order_id: "order-A", status: "assigned" }];
      if (sql.includes("FROM fulfilment_group WHERE")) return [{ id: "group-A" }];
      return [];
    };

    await listPartnerShipments(ctxA, ex);
    await getShipmentForGroup(ctxA, "group-A", ex);
    await fulfilmentCustomers(ctxA, ex);

    expect(calls.length).toBeGreaterThanOrEqual(4);
    for (const call of calls) {
      expect(call.sql).toMatch(/partner_id = \$\d+/);
      expect(call.params[call.params.length - 1]).toBe(ctxA.partnerId);
    }
  });
});
