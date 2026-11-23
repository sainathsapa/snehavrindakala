import { describe, it, expect } from "vitest";
import {
  changeMemberRole,
  changeOwnPassword,
  inviteMember,
  listMembers,
  revokeMemberSessions,
  suspendMember,
  updateProfile,
} from "@/lib/partner-portal/team";
import { verifyPassword, hashPassword } from "@/lib/partner/password";
import { resolvePartnerContext } from "@/lib/partner/context";
import { signPartnerSession } from "@/lib/partner/session";
import type { PartnerContext } from "@/lib/partner/types";

const PARTNER_A = "partner-A";
const PARTNER_B = "partner-B";

function ctx(overrides: Partial<PartnerContext> = {}): PartnerContext {
  return {
    partnerId: PARTNER_A,
    membershipId: "member-A",
    email: "owner@partner.test",
    role: "owner",
    tokenVersion: 1,
    ...overrides,
  };
}

function member(overrides: Record<string, any> = {}) {
  return {
    id: "member-A",
    partner_id: PARTNER_A,
    email: "owner@partner.test",
    password_hash: hashPassword("a-valid-current-password"),
    full_name: "Owner",
    role: "owner",
    status: "active",
    token_version: 1,
    last_login_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function partner(overrides: Record<string, any> = {}) {
  return {
    id: PARTNER_A,
    legal_name: "Partner A Legal",
    display_name: "Partner A",
    slug: "partner-a",
    contact_email: "owner@partner.test",
    contact_phone: null,
    business_profile: {},
    registration_details: {},
    account_status: "active",
    verification_status: "unverified",
    ...overrides,
  };
}

function publicMember(row: any) {
  const { password_hash: _ignored, ...safe } = row;
  return safe;
}

/**
 * Stateful in-memory executor. It honours the `{partner}` substitution produced
 * by buildScopedStatement, so a query that forgets to scope by partner returns
 * nothing — the same failure mode as a real database with the tenant predicate.
 */
function fakeDb(partners: any[] = [partner()], members: any[] = [member()]) {
  const calls: Array<{ sql: string; params: any[] }> = [];
  const state = { partners: [...partners], members: [...members] };

  const executor = async (sql: string, params: any[] = []) => {
    calls.push({ sql, params });
    const q = sql.replace(/\s+/g, " ").trim();
    const scopedPartner = params[params.length - 1];

    if (q.startsWith("INSERT INTO partner_membership")) {
      const [email, password_hash, full_name, role] = params;
      const row = member({
        id: `invited-${state.members.length + 1}`,
        partner_id: scopedPartner,
        email,
        password_hash,
        full_name,
        role,
        status: "invited",
      });
      state.members.push(row);
      return [publicMember(row)];
    }

    if (q.startsWith("UPDATE partner_membership")) {
      const memberId = params.find(
        (p) => typeof p === "string" && state.members.some((m) => m.id === p)
      );
      const row = state.members.find((m) => m.id === memberId);
      if (!row || row.partner_id !== scopedPartner) return [];
      if (q.includes("SET role =")) {
        row.role = q.match(/SET role = '(\w+)'/)?.[1] ?? params[0];
      }
      if (q.includes("status = 'suspended'")) row.status = "suspended";
      if (q.includes("token_version = token_version + 1")) row.token_version += 1;
      if (q.includes("password_hash = $1")) row.password_hash = params[0];
      return [publicMember(row)];
    }

    if (q.includes("FROM partner_membership")) {
      if (q.includes("count(*)")) {
        const count = state.members.filter(
          (m) =>
            m.partner_id === scopedPartner &&
            m.role === "owner" &&
            m.status === "active"
        ).length;
        return [{ count }];
      }
      // listPartnerMembers: WHERE partner_id = $1 ORDER BY ... (no id filter).
      if (q.includes("WHERE partner_id = $1") && q.includes("ORDER BY")) {
        return state.members
          .filter((m) => m.partner_id === scopedPartner)
          .map(publicMember);
      }
      const scoped = q.includes("AND partner_id");
      const id = params[0];
      const row = state.members.find(
        (m) => m.id === id && (!scoped || m.partner_id === scopedPartner)
      );
      if (!row) return [];
      return q.includes("password_hash") ? [row] : [publicMember(row)];
    }

    if (q.startsWith("UPDATE partner ")) {
      const row = state.partners.find((p) => p.id === scopedPartner);
      if (!row) return [];
      const setPart = q.slice(q.indexOf("SET ") + 4, q.indexOf(" WHERE "));
      const assignment = /(\w+) = \$(\d+)/g;
      let match: RegExpExecArray | null;
      while ((match = assignment.exec(setPart))) {
        const field = match[1];
        const value = params[Number(match[2]) - 1];
        row[field] = field === "business_profile" ? JSON.parse(value) : value;
      }
      return [row];
    }

    if (q.includes("FROM partner WHERE")) {
      const row = state.partners.find((p) => p.id === params[0]);
      return row ? [row] : [];
    }

    return [];
  };

  return { executor, calls, state };
}

describe("team membership — tenant isolation", () => {
  it("listing returns only the authenticated partner's members", async () => {
    const foreign = member({ id: "member-B", partner_id: PARTNER_B, email: "b@partner.test" });
    const { executor } = fakeDb([partner()], [member(), foreign]);
    const rows = await listMembers(ctx(), executor);
    expect(rows.map((r: any) => r.id)).toEqual(["member-A"]);
  });

  it("a foreign member id is a no-op for role change, suspend and revoke", async () => {
    const foreign = member({
      id: "member-B",
      partner_id: PARTNER_B,
      email: "b@partner.test",
      role: "owner",
    });
    const { executor, calls, state } = fakeDb(
      [partner(), partner({ id: PARTNER_B })],
      [member(), foreign]
    );

    expect(await changeMemberRole(ctx(), "member-B", "viewer", executor)).toBeNull();
    expect(await suspendMember(ctx(), "member-B", executor)).toBeNull();
    expect(await revokeMemberSessions(ctx(), "member-B", executor)).toBeNull();

    const after = state.members.find((m) => m.id === "member-B")!;
    expect(after.role).toBe("owner");
    expect(after.status).toBe("active");
    expect(after.token_version).toBe(1);

    // Any UPDATE that names the foreign id is still tenant-scoped to A, so the
    // database predicate prevents it from touching B's row.
    const updates = calls.filter((c) => c.sql.trim().startsWith("UPDATE"));
    expect(updates.length).toBeGreaterThan(0);
    // Every membership update is addressed as id = $1 AND partner_id = $2.
    expect(updates.every((c) => c.sql.includes("id = $1 AND partner_id = $2"))).toBe(true);
    const foreignUpdates = updates.filter((c) => c.params.includes("member-B"));
    expect(foreignUpdates.every((c) => c.params[c.params.length - 1] === PARTNER_A)).toBe(true);
  });
});

describe("team membership — owner protections", () => {
  it("forbids an owner from suspending themselves", async () => {
    const { executor, state } = fakeDb();
    await expect(suspendMember(ctx(), "member-A", executor)).rejects.toThrow(
      /own membership/
    );
    expect(state.members[0].status).toBe("active");
  });

  it("forbids removing the last active owner (suspend or demotion)", async () => {
    const manager = member({
      id: "member-M",
      email: "manager@partner.test",
      role: "manager",
    });
    const { executor, state } = fakeDb(
      [partner()],
      [member(), manager]
    );
    const managerCtx = ctx({ membershipId: "member-M", role: "manager", email: "manager@partner.test" });

    await expect(suspendMember(managerCtx, "member-A", executor)).rejects.toThrow(
      /last active owner/
    );
    await expect(
      changeMemberRole(managerCtx, "member-A", "viewer", executor)
    ).rejects.toThrow(/last active owner/);
    expect(state.members.find((m) => m.id === "member-A")!.status).toBe("active");
    expect(state.members.find((m) => m.id === "member-A")!.role).toBe("owner");
  });

  it("allows suspending an owner when another active owner remains", async () => {
    const otherOwner = member({
      id: "member-O2",
      email: "owner2@partner.test",
      role: "owner",
    });
    const { executor } = fakeDb([partner()], [member(), otherOwner]);
    const suspended = await suspendMember(ctx(), "member-O2", executor);
    expect(suspended?.status).toBe("suspended");
  });
});

describe("session revocation", () => {
  it("bumping token_version invalidates an otherwise valid context", async () => {
    const { executor } = fakeDb();
    const token = signPartnerSession({
      partnerId: PARTNER_A,
      membershipId: "member-A",
      role: "owner",
      tokenVersion: 1,
      email: "owner@partner.test",
    });
    expect(await resolvePartnerContext(token, executor)).not.toBeNull();

    await revokeMemberSessions(ctx(), "member-A", executor);
    expect(await resolvePartnerContext(token, executor)).toBeNull();
  });

  it("changing a password verifies the old one and revokes sessions", async () => {
    const { executor } = fakeDb();
    const token = signPartnerSession({
      partnerId: PARTNER_A,
      membershipId: "member-A",
      role: "owner",
      tokenVersion: 1,
      email: "owner@partner.test",
    });

    expect(
      await changeOwnPassword(ctx(), "wrong-password", "a-brand-new-password", executor)
    ).toBe(false);
    expect(
      await changeOwnPassword(ctx(), "a-valid-current-password", "a-brand-new-password", executor)
    ).toBe(true);
    expect(await resolvePartnerContext(token, executor)).toBeNull();
  });
});

describe("business profile updates", () => {
  it("cannot change account_status, verification_status or other privileged columns", async () => {
    const { executor, calls, state } = fakeDb([partner({ account_status: "suspended" })]);
    await expect(
      updateProfile(
        ctx(),
        { display_name: "New name", account_status: "active" } as any,
        executor
      )
    ).rejects.toThrow(/account_status/);
    await expect(
      updateProfile(ctx(), { verification_status: "verified" } as any, executor)
    ).rejects.toThrow(/verification_status/);

    expect(calls).toHaveLength(0);
    expect(state.partners[0].account_status).toBe("suspended");
    expect(state.partners[0].verification_status).toBe("unverified");
  });

  it("writes only allow-listed business fields scoped to the partner row", async () => {
    const { executor, calls, state } = fakeDb([
      partner({ id: PARTNER_B, display_name: "Other partner" }),
      ...[],
    ]);
    // Put partner A in state too (the fake starts with just B in this case).
    state.partners.push(partner());

    const updated = await updateProfile(
      ctx(),
      { display_name: "Renamed", business_profile: { description: "Handmade" } },
      executor
    );
    expect(updated.display_name).toBe("Renamed");
    expect(state.partners.find((p: any) => p.id === PARTNER_A)!.business_profile).toEqual({
      description: "Handmade",
    });
    expect(state.partners.find((p: any) => p.id === PARTNER_B)!.display_name).toBe(
      "Other partner"
    );

    const assignment = calls.find((c) => c.sql.trim().startsWith("UPDATE partner "))!;
    const setClause = assignment.sql.slice(0, assignment.sql.indexOf(" WHERE "));
    expect(setClause).not.toContain("account_status");
    expect(assignment.params[assignment.params.length - 1]).toBe(PARTNER_A);
  });
});

describe("invitations", () => {
  it("hashes a random one-time password and creates a tenant-scoped invited member", async () => {
    const { executor, state } = fakeDb();
    const result = await inviteMember(
      ctx(),
      { email: "new@partner.test", fullName: "New Member", role: "manager" },
      executor
    );

    expect(result.member?.partner_id).toBe(PARTNER_A);
    expect(result.member?.status).toBe("invited");
    expect(result.member?.role).toBe("manager");
    expect(result.member).not.toHaveProperty("password_hash");
    expect(result.tempPassword.length).toBeGreaterThanOrEqual(12);

    const stored = state.members.find((m) => m.id === result.member!.id)!;
    expect(stored.password_hash).toMatch(/^scrypt\$/);
    expect(stored.password_hash).not.toBe(result.tempPassword);
    expect(verifyPassword(result.tempPassword, stored.password_hash)).toBe(true);
  });

  it("rejects invalid roles and email addresses", async () => {
    const { executor } = fakeDb();
    await expect(
      inviteMember(ctx(), { email: "x@partner.test", role: "superadmin" }, executor)
    ).rejects.toThrow(/role/);
    await expect(
      inviteMember(ctx(), { email: "not-an-email", role: "viewer" }, executor)
    ).rejects.toThrow(/email/);
  });
});
