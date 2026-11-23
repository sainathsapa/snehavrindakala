import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PartnerContext } from "@/lib/partner/types";
import type { QueryExecutor } from "@/lib/partner/repository";

// Never touch a real database: every query is driven through an injected executor.
vi.mock("@/lib/db", () => ({
  query: vi.fn(async () => []),
  queryResult: vi.fn(async () => ({ rows: [], rowCount: 0 })),
  transaction: vi.fn(),
  getPool: vi.fn(),
}));

import {
  AUDIT_ACTIONS,
  REDACTED,
  auditPayload,
  listPartnerAudit,
  recordPartnerAudit,
} from "@/lib/partner-audit/audit";

const ctx: PartnerContext = {
  partnerId: "partner-A",
  membershipId: "member-A",
  email: "owner@partner-A.test",
  role: "owner",
  tokenVersion: 1,
};

interface QueryCall {
  sql: string;
  params: any[];
}

function captureExecutor(rows: any[] = []) {
  const calls: QueryCall[] = [];
  const executor: QueryExecutor = async (sql: string, params: any[] = []) => {
    calls.push({ sql, params });
    return rows;
  };
  return { executor, calls };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("recordPartnerAudit — append-only row construction", () => {
  it("builds an INSERT with server-provided identity and all audit columns", async () => {
    const { executor, calls } = captureExecutor();
    await recordPartnerAudit(
      {
        partnerId: ctx.partnerId,
        actorEmail: ctx.email,
        actorRole: ctx.role,
        action: AUDIT_ACTIONS.MEMBER_INVITED,
        entityType: "partner_membership",
        entityId: "member-B",
        metadata: { invitedRole: "manager" },
      },
      executor
    );

    expect(calls).toHaveLength(1);
    const { sql, params } = calls[0];
    expect(sql).toContain("INSERT INTO partner_audit_log");
    expect(sql).toContain(
      "(partner_id, actor_email, actor_role, action, entity_type, entity_id, metadata)"
    );
    expect(sql).toContain("$7::jsonb");
    expect(params).toEqual([
      "partner-A",
      "owner@partner-A.test",
      "owner",
      "MEMBER_INVITED",
      "partner_membership",
      "member-B",
      JSON.stringify({ invitedRole: "manager" }),
    ]);
    expect(JSON.parse(params[6])).toEqual({ invitedRole: "manager" });
  });

  it("stores null for a missing entity id and {} for missing metadata", async () => {
    const { executor, calls } = captureExecutor();
    await recordPartnerAudit(
      {
        partnerId: "partner-A",
        actorEmail: "finance@partner-A.test",
        actorRole: "finance",
        action: AUDIT_ACTIONS.SETTLEMENT_VIEWED,
        entityType: "settlement_batch",
      },
      executor
    );
    const [, , , , , entityId, metadata] = calls[0].params;
    expect(entityId).toBeNull();
    expect(JSON.parse(metadata)).toEqual({});
  });

  it("records an unknown action verbatim instead of rejecting it", async () => {
    const { executor, calls } = captureExecutor();
    await recordPartnerAudit(
      {
        partnerId: "partner-A",
        actorEmail: ctx.email,
        actorRole: "manager",
        action: "SOME_NEW_ACTION_NOT_IN_CONSTANTS",
        entityType: "thing",
        entityId: "thing-1",
      },
      executor
    );
    expect(calls[0].params[3]).toBe("SOME_NEW_ACTION_NOT_IN_CONSTANTS");
    expect(calls[0].sql).toContain("INSERT INTO partner_audit_log");
  });

  it("never trusts a client-supplied partner id field in metadata", async () => {
    const { executor, calls } = captureExecutor();
    await recordPartnerAudit(
      {
        partnerId: ctx.partnerId,
        actorEmail: ctx.email,
        actorRole: ctx.role,
        action: AUDIT_ACTIONS.PROFILE_UPDATED,
        entityType: "partner",
        entityId: ctx.partnerId,
        metadata: { partnerId: "partner-B", note: "renamed" },
      },
      executor
    );
    // The tenant column is the server-derived partnerId, not the metadata value.
    expect(calls[0].params[0]).toBe("partner-A");
    expect(calls[0].params[0]).not.toBe("partner-B");
  });
});

describe("listPartnerAudit — tenant scoping", () => {
  it("scopes the read through tenantQuery with the context partner id only", async () => {
    const rows = [
      {
        id: "audit-1",
        partner_id: "partner-A",
        actor_email: ctx.email,
        actor_role: "owner",
        action: AUDIT_ACTIONS.ORDER_ACCEPTED,
        entity_type: "fulfilment_group",
        entity_id: "group-1",
        metadata: {},
        created_at: "2026-01-01T00:00:00Z",
      },
    ];
    const { executor, calls } = captureExecutor(rows);
    const result = await listPartnerAudit(ctx, executor);

    expect(result).toEqual(rows);
    expect(calls).toHaveLength(1);
    const { sql, params } = calls[0];
    expect(sql).toContain("FROM partner_audit_log");
    expect(sql).toContain("partner_id = $1"); // {partner} token was replaced
    expect(sql).not.toContain("{partner}");
    expect(sql).toContain("ORDER BY created_at DESC");
    expect(params).toEqual(["partner-A"]); // no caller-supplied tenant id
  });

  it("returns only what the scoped executor returns (foreign rows never included)", async () => {
    // Simulate the DB applying the partner predicate: a foreign partner's rows
    // are absent from the result even though the table contains them.
    const { executor } = captureExecutor([
      { id: "audit-own", partner_id: "partner-A", action: AUDIT_ACTIONS.PRODUCT_SUBMITTED },
    ]);
    const result = await listPartnerAudit(ctx, executor);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("audit-own");
    expect(result.every((r) => r.partner_id === "partner-A")).toBe(true);
  });

  it("does not execute when the context is missing (fails closed)", async () => {
    const { executor, calls } = captureExecutor();
    await expect(listPartnerAudit(null as any, executor)).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});

describe("auditPayload — pure, redaction-safe metadata", () => {
  it("redacts secret keys at any depth and in arrays", () => {
    const payload = auditPayload(AUDIT_ACTIONS.MEMBER_INVITED, ctx, {
      invitedEmail: "newmember@partner-A.test", // email key -> redacted
      credentials: { password: "s3cr3t-pass", token: "abc.def.ghi" },
      history: [
        { password_hash: "hash-value" },
        { apiKey: "key-123", note: "role changed to manager" },
      ],
      fromRole: "viewer",
      toRole: "manager",
    });

    expect(payload).toMatchObject({
      action: "MEMBER_INVITED",
      partnerId: "partner-A",
      actorRole: "owner",
    });
    const serialised = JSON.stringify(payload);
    expect(serialised).not.toContain("s3cr3t-pass");
    expect(serialised).not.toContain("abc.def.ghi");
    const entity = payload.entity as any;
    expect(entity.invitedEmail).toBe(REDACTED);
    // A container key that is itself sensitive is redacted wholesale.
    expect(entity.credentials).toBe(REDACTED);
    expect(entity.history[0].password_hash).toBe(REDACTED);
    expect(entity.history[1].apiKey).toBe(REDACTED);
    expect(entity.history[1].note).toBe("role changed to manager");
    expect(entity.fromRole).toBe("viewer");
    expect(entity.toRole).toBe("manager");
  });

  it("redacts customer PII keys and PAN/card numbers, including raw values in strings", () => {
    const payload = auditPayload(AUDIT_ACTIONS.ORDER_FULFILLED, ctx, {
      orderId: "order-42",
      customer: {
        email: "customer@shopper.example",
        fullName: "A Customer",
        card: { pan: "4111111111111111", cvv: "123" },
      },
      note: "Ship to buyer@shopper.example, ref 5500005555555559",
      status: "dispatched",
    });

    const serialised = JSON.stringify(payload);
    expect(serialised).not.toContain("customer@shopper.example");
    expect(serialised).not.toContain("buyer@shopper.example");
    expect(serialised).not.toContain("4111111111111111");
    expect(serialised).not.toContain("5500005555555559");
    expect(serialised).not.toContain("123\"");
    const entity = payload.entity as any;
    expect(entity.customer.email).toBe(REDACTED);
    expect(entity.customer.card.pan).toBe(REDACTED);
    expect(entity.customer.card.cvv).toBe(REDACTED);
    expect(entity.orderId).toBe("order-42");
    expect(entity.status).toBe("dispatched");
  });

  it("does not duplicate the actor's email into metadata (identity lives in its own column)", () => {
    const payload = auditPayload(AUDIT_ACTIONS.PROFILE_UPDATED, ctx, {
      displayName: "New Name",
    });
    expect(JSON.stringify(payload)).not.toContain(ctx.email);
    expect(payload).not.toHaveProperty("actorEmail");
  });

  it("is pure: same inputs give the same output and never mutate the entity", () => {
    const entity = { title: "A", nested: { token: "t" }, items: [1, 2] };
    const snapshot = JSON.stringify(entity);
    const first = auditPayload(AUDIT_ACTIONS.PRODUCT_SUBMITTED, ctx, entity);
    const second = auditPayload(AUDIT_ACTIONS.PRODUCT_SUBMITTED, ctx, entity);
    expect(first).toEqual(second);
    expect(JSON.stringify(entity)).toBe(snapshot);
  });
});

describe("AUDIT_ACTIONS", () => {
  it("exposes all required canonical action constants", () => {
    expect(AUDIT_ACTIONS).toEqual({
      MEMBER_INVITED: "MEMBER_INVITED",
      MEMBER_ROLE_CHANGED: "MEMBER_ROLE_CHANGED",
      MEMBER_SUSPENDED: "MEMBER_SUSPENDED",
      SESSIONS_REVOKED: "SESSIONS_REVOKED",
      PROFILE_UPDATED: "PROFILE_UPDATED",
      PRODUCT_SUBMITTED: "PRODUCT_SUBMITTED",
      ORDER_ACCEPTED: "ORDER_ACCEPTED",
      ORDER_REJECTED: "ORDER_REJECTED",
      ORDER_FULFILLED: "ORDER_FULFILLED",
      SETTLEMENT_VIEWED: "SETTLEMENT_VIEWED",
    });
  });
});
