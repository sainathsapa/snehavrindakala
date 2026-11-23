/**
 * Partner notifications: tenant scoping, friendly mapping, and the hard rule
 * that no caller-supplied partner id is ever honoured.
 *
 * No real database is used: a fake executor emulates the `partner_id = <tenant>`
 * predicate that `tenantQuery` renders, so a foreign row simply never comes
 * back — exactly as it would in Postgres.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  notificationFromAudit,
  listPartnerNotifications,
  markRead,
  type AuditRow,
} from "@/lib/partner-portal/notifications";
import type { PartnerContext } from "@/lib/partner/types";

const ctxA: PartnerContext = {
  partnerId: "partner-A",
  membershipId: "member-A",
  email: "a@partner.test",
  role: "owner",
  tokenVersion: 1,
};

const ctxB: PartnerContext = {
  ...ctxA,
  partnerId: "partner-B",
  membershipId: "member-B",
  email: "b@partner.test",
};

function auditRow(overrides: Partial<AuditRow> = {}): AuditRow {
  return {
    id: "audit-1",
    partner_id: "partner-A",
    actor_email: "staff@partner.test",
    actor_role: "operations",
    action: "order:assigned",
    entity_type: "fulfilment_group",
    entity_id: "group-1",
    metadata: {},
    created_at: new Date("2026-01-02T03:04:05.000Z"),
    ...overrides,
  };
}

/** Executor that applies the tenant predicate the same way Postgres would. */
function scopedExecutor(rows: AuditRow[]) {
  const calls: Array<{ sql: string; params: any[] }> = [];
  const executor = async (sql: string, params: any[] = []) => {
    calls.push({ sql, params });
    const tenant = params[params.length - 1];
    const visible = rows.filter((r) => r.partner_id === tenant);
    if (/^\s*UPDATE/i.test(sql)) {
      const id = params[0];
      const found = visible.find((r) => r.id === id);
      return found
        ? [
            {
              ...found,
              metadata: {
                ...((typeof found.metadata === "object" && found.metadata
                  ? found.metadata
                  : {}) as Record<string, unknown>),
                read: true,
              },
            },
          ]
        : [];
    }
    return visible;
  };
  return { executor, calls };
}

describe("notificationFromAudit — pure mapper", () => {
  it("maps an audit row to a friendly title/body/time/href notification", () => {
    const n = notificationFromAudit(
      auditRow({
        id: "audit-42",
        action: "order:assigned",
        entity_type: "fulfilment_group",
        entity_id: "group-42",
      })
    );

    expect(n).not.toBeNull();
    expect(n).toMatchObject({
      id: "audit-42",
      title: "Order update",
      href: "/partner/orders",
      read: false,
    });
    expect(n?.body).toContain("Order Assigned");
    expect(n?.body).toContain("group-42");
    expect(n?.time).toBe("2026-01-02T03:04:05.000Z");
  });

  it("links payment events to the earnings section and reflects read state", () => {
    const n = notificationFromAudit(
      auditRow({
        action: "payout:completed",
        entity_type: "payout",
        metadata: { read: true },
        created_at: "2026-02-03T04:05:06Z",
      })
    );
    expect(n).toMatchObject({
      title: "Payment update",
      href: "/partner/earnings",
      read: true,
      time: "2026-02-03T04:05:06Z",
    });
  });

  it("never exposes actor identity in the mapped shape", () => {
    const n = notificationFromAudit(auditRow());
    expect(n && Object.keys(n).sort()).toEqual(
      ["body", "href", "id", "read", "time", "title"].sort()
    );
    expect(JSON.stringify(n)).not.toContain("staff@partner.test");
  });

  it("drops housekeeping/admin-style events as non-fulfilment-relevant", () => {
    expect(notificationFromAudit(auditRow({ action: "login", entity_type: "session" }))).toBeNull();
    expect(
      notificationFromAudit(auditRow({ action: "team:invite", entity_type: "membership" }))
    ).toBeNull();
    expect(
      notificationFromAudit(auditRow({ action: "settings:updated", entity_type: "config" }))
    ).toBeNull();
  });

  it("falls back to the notifications inbox for unknown relevant entity types", () => {
    const n = notificationFromAudit(
      auditRow({ action: "order:note", entity_type: "unknown_thing" })
    );
    expect(n?.href).toBe("/partner/notifications");
  });

  it("uses the canonical AUDIT_ACTIONS naming written by the partner audit logger", () => {
    expect(
      notificationFromAudit(auditRow({ action: "ORDER_ACCEPTED", entity_type: "order" }))
    ).toMatchObject({ title: "Order update", href: "/partner/orders" });
    expect(
      notificationFromAudit(
        auditRow({ action: "PRODUCT_SUBMITTED", entity_type: "partner_product" })
      )
    ).toMatchObject({ title: "Catalogue update", href: "/partner/products" });
    expect(
      notificationFromAudit(
        auditRow({ action: "SETTLEMENT_VIEWED", entity_type: "settlement_batch" })
      )
    ).toMatchObject({ title: "Payment update", href: "/partner/statements" });

    // Housekeeping actions from the same logger are not notifications.
    for (const action of ["MEMBER_INVITED", "PROFILE_UPDATED", "SESSIONS_REVOKED"]) {
      expect(notificationFromAudit(auditRow({ action, entity_type: "partner" }))).toBeNull();
    }
  });
});

describe("listPartnerNotifications — tenant scoping", () => {
  const rows = [
    auditRow({ id: "a1", partner_id: "partner-A", action: "order:assigned" }),
    auditRow({
      id: "a2",
      partner_id: "partner-A",
      action: "login",
      entity_type: "session",
    }),
    auditRow({
      id: "b1",
      partner_id: "partner-B",
      action: "shipment:dispatched",
      entity_type: "shipment",
    }),
  ];

  it("partner A cannot read partner B's notifications (and vice versa)", async () => {
    const { executor } = scopedExecutor(rows);

    const forA = await listPartnerNotifications(ctxA, executor);
    expect(forA.map((n) => n.id)).toEqual(["a1"]);

    const forB = await listPartnerNotifications(ctxB, executor);
    expect(forB.map((n) => n.id)).toEqual(["b1"]);
  });

  it("scopes with a bound partner_id from context, not from any caller input", async () => {
    const { executor, calls } = scopedExecutor(rows);
    await listPartnerNotifications(ctxA, executor);

    const call = calls[0];
    expect(call.sql).toContain("FROM partner_audit_log");
    expect(call.sql).toContain("partner_id = $2");
    // No admin notification table or audience predicate is ever involved.
    expect(call.sql).not.toContain("app_notifications");
    expect(call.sql).not.toContain("audience");
    expect(call.params).toEqual([50, "partner-A"]);
    expect(call.params).not.toContain("partner-B");
  });

  it("requires the {partner} predicate — a forgotten token fails before any read", async () => {
    // The module's SQL is fixed, so prove the guard itself is present: a query
    // without the token is rejected rather than silently returning all rows.
    const { tenantQuery } = await import("@/lib/partner/repository");
    const { executor, calls } = scopedExecutor(rows);
    await expect(
      tenantQuery(ctxA, "SELECT * FROM partner_audit_log", [], executor)
    ).rejects.toThrow(/without \{partner\} predicate/);
    expect(calls).toHaveLength(0);
  });
});

describe("markRead — scoped mutation", () => {
  const rows = [
    auditRow({ id: "a1", partner_id: "partner-A" }),
    auditRow({ id: "b1", partner_id: "partner-B" }),
  ];

  it("marks only this partner's row read and returns the friendly shape", async () => {
    const { executor, calls } = scopedExecutor(rows);
    const result = await markRead(ctxA, "a1", executor);

    expect(result).toMatchObject({ id: "a1", read: true });
    expect(calls[0].sql).toContain("partner_id = $2");
    expect(calls[0].params).toEqual(["a1", "partner-A"]);
  });

  it("a foreign or guessed id cannot mark another partner's row", async () => {
    const { executor } = scopedExecutor(rows);
    expect(await markRead(ctxA, "b1", executor)).toBeNull();
    expect(await markRead(ctxB, "a1", executor)).toBeNull();
  });

  it("rejects an empty id without touching the database", async () => {
    const { executor, calls } = scopedExecutor(rows);
    expect(await markRead(ctxA, "   ", executor)).toBeNull();
    expect(calls).toHaveLength(0);
  });
});

describe("no client partner id is honoured", () => {
  const libSource = readFileSync(
    join(__dirname, "../lib/partner-portal/notifications.ts"),
    "utf8"
  );
  const routeSource = readFileSync(
    join(__dirname, "../app/api/partner/notifications/route.ts"),
    "utf8"
  );

  it("the store never reads the admin notification table", () => {
    expect(libSource).toContain("tenantQuery");
    expect(libSource).toContain("{partner}");
    expect(libSource).not.toMatch(/\b(?:FROM|INTO|UPDATE)\s+app_notifications\b/i);
    expect(libSource).not.toContain("from \"@/lib/notifications\"");
  });

  it("the API derives identity from the server session, not the request", () => {
    expect(routeSource).toMatch(/requirePartnerPermission\(["']dashboard:read["']\)/);
    // No tenant id is pulled from the query string, headers or request body.
    expect(routeSource).not.toMatch(/searchParams/);
    expect(routeSource).not.toMatch(/headers\(\)/);
    expect(routeSource).not.toMatch(/body\?\.partner/);
    expect(routeSource).not.toContain("listNotifications");
  });

  it("the page redirects unauthenticated visitors and reads only the scoped store", () => {
    const pageSource = readFileSync(
      join(__dirname, "../app/partner/notifications/page.tsx"),
      "utf8"
    );
    expect(pageSource).toContain("requirePartnerContext");
    expect(pageSource).toContain('redirect("/partner/login")');
    expect(pageSource).toContain("listPartnerNotifications");
  });
});
