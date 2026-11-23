import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/partner/password";
import {
  signPartnerSession,
  verifyPartnerToken,
} from "@/lib/partner/session";
import type { QueryExecutor } from "@/lib/partner/repository";
import { authenticatePartnerMember } from "@/lib/partner-auth/login";
import {
  RESET_TOKEN_MAX_AGE,
  confirmPartnerPasswordReset,
  signResetToken,
  verifyResetToken,
} from "@/lib/partner-auth/reset-token";

// No live database: every lookup is driven through an injected executor.
vi.mock("@/lib/db", () => ({
  query: vi.fn(async () => []),
  queryResult: vi.fn(async () => ({ rows: [], rowCount: 0 })),
  transaction: vi.fn(),
  getPool: vi.fn(),
}));

const EMAIL = "owner@partner.test";
const PASSWORD = "correct-horse-battery";
const HASH = hashPassword(PASSWORD);

function membership(overrides: Record<string, any> = {}) {
  return {
    id: "member-1",
    partner_id: "partner-1",
    email: EMAIL,
    full_name: "Test Owner",
    role: "owner",
    status: "active",
    token_version: 3,
    password_hash: HASH,
    last_login_at: null,
    ...overrides,
  };
}

function partner(overrides: Record<string, any> = {}) {
  return {
    id: "partner-1",
    account_status: "active",
    display_name: "Test Partner",
    ...overrides,
  };
}

interface QueryCall {
  sql: string;
  params: any[];
}

function executorFor(memberRow: any, partnerRow: any) {
  const calls: QueryCall[] = [];
  const executor: QueryExecutor = async (sql: string, params: any[] = []) => {
    calls.push({ sql, params });
    if (sql.includes("FROM partner_membership WHERE lower(email)")) {
      return memberRow ? [memberRow] : [];
    }
    if (sql.includes("FROM partner_membership WHERE id =")) {
      return memberRow ? [memberRow] : [];
    }
    if (sql.includes("FROM partner WHERE id =")) {
      return partnerRow ? [partnerRow] : [];
    }
    return [];
  };
  return { executor, calls };
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("COOKIE_SECRET", "partner-auth-test-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("partner member login", () => {
  it("rejects a wrong password with the same null result as any other failure", async () => {
    const { executor } = executorFor(membership(), partner());
    expect(
      await authenticatePartnerMember(EMAIL, "not-the-right-password", executor)
    ).toBeNull();
  });

  it("rejects a suspended membership even with the correct password", async () => {
    const { executor } = executorFor(
      membership({ status: "suspended" }),
      partner()
    );
    expect(await authenticatePartnerMember(EMAIL, PASSWORD, executor)).toBeNull();
  });

  it("rejects an invited membership", async () => {
    const { executor } = executorFor(membership({ status: "invited" }), partner());
    expect(await authenticatePartnerMember(EMAIL, PASSWORD, executor)).toBeNull();
  });

  it("rejects a suspended partner account even with valid credentials", async () => {
    const { executor } = executorFor(
      membership(),
      partner({ account_status: "suspended" })
    );
    expect(await authenticatePartnerMember(EMAIL, PASSWORD, executor)).toBeNull();
  });

  it("gives the same answer for an unknown address and malformed input", async () => {
    const { executor } = executorFor(null, partner());
    expect(await authenticatePartnerMember("nobody@example.com", PASSWORD, executor)).toBeNull();
    expect(await authenticatePartnerMember(undefined, PASSWORD, executor)).toBeNull();
    expect(await authenticatePartnerMember(EMAIL, undefined, executor)).toBeNull();
  });

  it("valid credentials produce a verifiable token with the member's identity", async () => {
    const { executor, calls } = executorFor(membership(), partner());
    const token = await authenticatePartnerMember(EMAIL, PASSWORD, executor);

    expect(token).toBeTruthy();
    const payload = verifyPartnerToken(token!);
    expect(payload).toMatchObject({
      pid: "partner-1",
      mid: "member-1",
      role: "owner",
      ver: 3,
      email: EMAIL,
    });
    expect(payload!.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(
      calls.some((call) =>
        call.sql.startsWith("UPDATE partner_membership SET last_login_at")
      )
    ).toBe(true);
  });

  it("a failed last_login_at write does not turn a valid login into a failure", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { executor } = executorFor(membership(), partner());
    const failingExecutor: QueryExecutor = async (sql, params) => {
      if (sql.startsWith("UPDATE")) throw new Error("write failed");
      return executor(sql, params);
    };
    expect(await authenticatePartnerMember(EMAIL, PASSWORD, failingExecutor)).toBeTruthy();
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe("partner reset tokens", () => {
  it("round-trips a token for a membership", () => {
    expect(verifyResetToken(signResetToken("member-1"))).toBe("member-1");
  });

  it("rejects a tampered signature or body", () => {
    const token = signResetToken("member-1");
    const [body, signature] = token.split(".");
    const flipped = (signature[0] === "A" ? "B" : "A") + signature.slice(1);
    expect(verifyResetToken(`${body}.${flipped}`)).toBeNull();

    const forgedBody = Buffer.from(
      JSON.stringify({ mid: "member-2", exp: Math.floor(Date.now() / 1000) + 3600 })
    ).toString("base64url");
    expect(verifyResetToken(`${forgedBody}.${signature}`)).toBeNull();
    expect(verifyResetToken("garbage")).toBeNull();
  });

  it("rejects an expired token", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = signResetToken("member-1");
    expect(verifyResetToken(token)).toBe("member-1");

    vi.setSystemTime(
      new Date(Date.now() + (RESET_TOKEN_MAX_AGE + 60) * 1000)
    );
    expect(verifyResetToken(token)).toBeNull();
  });

  it("is namespaced away from partner session tokens", () => {
    const session = signPartnerSession({
      partnerId: "partner-1",
      membershipId: "member-1",
      role: "owner",
      tokenVersion: 3,
      email: EMAIL,
    });
    expect(verifyResetToken(session)).toBeNull();
  });
});

describe("confirming a partner password reset", () => {
  it("stores the new hash and bumps token_version to revoke sessions", async () => {
    const token = signResetToken("member-1");
    const { executor, calls } = executorFor(membership(), null);
    expect(await confirmPartnerPasswordReset(token, "brand-new-password", executor)).toBe(true);

    const update = calls.find((call) =>
      call.sql.startsWith("UPDATE partner_membership SET password_hash")
    );
    expect(update).toBeDefined();
    expect(update!.sql).toContain("token_version = token_version + 1");
    expect(verifyPassword("brand-new-password", update!.params[0])).toBe(true);
    expect(update!.params[1]).toBe("member-1");
  });

  it("refuses bad tokens, weak passwords and suspended members without writing", async () => {
    const { executor, calls } = executorFor(
      membership({ status: "suspended" }),
      null
    );
    expect(await confirmPartnerPasswordReset("garbage", "brand-new-password", executor)).toBe(false);
    expect(await confirmPartnerPasswordReset(signResetToken("member-1"), "short", executor)).toBe(false);
    expect(
      await confirmPartnerPasswordReset(signResetToken("member-1"), "brand-new-password", executor)
    ).toBe(false);
    expect(calls.some((call) => call.sql.startsWith("UPDATE"))).toBe(false);
  });
});
