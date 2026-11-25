import { describe, it, expect } from "vitest";
import * as platform from "@/lib/admin-partners/platform";
import {
  ArtistNotFoundError,
  getPartner,
  linkArtist,
  listPartners,
  PartnerNotFoundError,
  PlatformValidationError,
  setAccountStatus,
  setVerification,
  type Partner,
  type PlatformDeps,
  type QueryExecutor,
} from "@/lib/admin-partners/platform";

const FIXED_NOW = "2026-02-01T10:11:12.000Z";
const fixedNow = () => new Date(FIXED_NOW);

interface Call {
  sql: string;
  params: any[];
}

/** A signed, in-force agreement + approved config, so status tests that expect
 *  activation succeed for the reason they existed before: the status machinery.
 *  The gate itself is exercised in `partner-commercial-gate.test.ts`. */
const DEFAULT_AGREEMENT = {
  id: "agr-1",
  partner_id: "p-1",
  agreement_reference: "AGR-2026-001",
  status: "signed",
  signed_on: "2026-01-01",
  effective_from: "2026-01-01",
  effective_to: null,
  document_ref: "doc-store/agr-2026-001",
  approved_by: "owner@example.com",
  approved_at: "2026-01-01T00:00:00.000Z",
};

const DEFAULT_COMMERCIAL = {
  id: "cc-1",
  partner_id: "p-1",
  commission_policy_id: "policy-1",
  payout_frequency: "monthly",
  payout_terms: "Net 15 after delivery confirmation",
  effective_from: "2026-01-01",
  approved_by: "owner@example.com",
  approved_at: "2026-01-01T00:00:00.000Z",
};

/** Fake executor that records every statement and returns lifecycle-shaped rows. */
function fakeDb(
  opts: {
    partner?: Partial<Partner>;
    artistExists?: boolean;
    /** `null` simulates no agreement / no commercial config on record. */
    agreement?: any | null;
    commercial?: any | null;
  } = {}
) {
  const calls: Call[] = [];
  const partner = {
    id: "p-1",
    legal_name: "Vidya Handicrafts LLP",
    display_name: "Vidya Handicrafts",
    slug: "vidya-handicrafts",
    contact_email: "owner@vidya.example",
    contact_phone: "+91 98765 43210",
    business_profile: {},
    registration_details: {},
    account_status: "pending",
    verification_status: "unverified",
    approval_history: [],
    artist_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...(opts.partner ?? {}),
  } as Partner;

  const exec: QueryExecutor = async (sql, params = []) => {
    const t = sql.replace(/\s+/g, " ").trim();
    calls.push({ sql: t, params });

    if (/^SELECT COUNT\(\*\)/.test(t)) return [{ count: "1" }];
    if (/^SELECT .* FROM site_artist\b/i.test(t)) {
      return opts.artistExists === false ? [] : [{ id: params[0] }];
    }
    // Commercial readiness reads (added with the activation gate).
    if (/^SELECT \* FROM marketplace_partner_agreement\b/i.test(t)) {
      const a = opts.agreement === undefined ? DEFAULT_AGREEMENT : opts.agreement;
      return a ? [a] : [];
    }
    if (/^SELECT \* FROM partner_commercial_config\b/i.test(t)) {
      const c = opts.commercial === undefined ? DEFAULT_COMMERCIAL : opts.commercial;
      return c ? [c] : [];
    }
    if (/^SELECT .* FROM partner\b/i.test(t)) return [partner];

    if (/^UPDATE partner\b/i.test(t)) {
      const isStatus = /account_status\s*=/.test(t);
      const isVerify = /verification_status\s*=/.test(t);
      const isArtist = /artist_id\s*=/.test(t);
      const entry = JSON.parse(params[1])[0];
      return [
        {
          ...partner,
          account_status: isStatus ? params[0] : partner.account_status,
          verification_status: isVerify ? params[0] : partner.verification_status,
          artist_id: isArtist ? params[0] : partner.artist_id,
          approval_history: [...partner.approval_history, entry],
          updated_at: params[2],
        },
      ];
    }
    if (/^INSERT INTO partner_audit_log\b/i.test(t)) return [{ id: "audit-1" }];
    return [];
  };

  const deps = (extra: Partial<PlatformDeps> = {}): PlatformDeps => ({
    executor: exec,
    now: fixedNow,
    ...extra,
  });

  const audits = () =>
    calls.filter((c) => c.sql.includes("INSERT INTO partner_audit_log"));
  const updates = () => calls.filter((c) => /^UPDATE partner\b/i.test(c.sql));

  return { calls, exec, partner, deps, audits, updates };
}

/* ── account status ───────────────────────────────────────────────────────── */

describe("setAccountStatus", () => {
  it("appends a history entry with timestamp + actor and writes one audit row", async () => {
    const db = fakeDb();
    const updated = await setAccountStatus(
      "p-1",
      "active",
      "Admin@Example.com",
      db.deps({ notes: "documents verified" })
    );

    expect(updated.account_status).toBe("active");
    expect(updated.verification_status).toBe("unverified"); // untouched

    const up = db.updates()[0];
    expect(up.params[0]).toBe("active");
    expect(up.sql).toContain("account_status = $1");
    expect(up.sql).not.toMatch(/verification_status\s*=/);
    expect(up.sql).toContain("approval_history");

    const entry = JSON.parse(up.params[1])[0];
    expect(entry).toMatchObject({
      action: "account_status",
      from: "pending",
      to: "active",
      actor: "admin@example.com", // normalised from session email
      timestamp: FIXED_NOW,
      notes: "documents verified",
    });

    expect(db.audits()).toHaveLength(1);
    const audit = db.audits()[0];
    expect(audit.params).toEqual(
      expect.arrayContaining([
        "p-1",
        "admin@example.com",
        "platform_admin",
        "set_account_status",
        "partner",
        "p-1",
      ])
    );
    expect(JSON.parse(audit.params[6])).toMatchObject({
      from: "pending",
      to: "active",
    });
    expect(audit.params[7]).toBe(FIXED_NOW);
  });

  it("accepts all four account states and rejects anything else before any write", async () => {
    for (const status of ["pending", "active", "suspended", "rejected"] as const) {
      const db = fakeDb();
      await setAccountStatus("p-1", status, "admin@example.com", db.deps());
      expect(db.updates()[0].params[0]).toBe(status);
    }
    const db = fakeDb();
    await expect(
      setAccountStatus("p-1", "verified" as any, "admin@example.com", db.deps())
    ).rejects.toThrow(PlatformValidationError);
    await expect(
      setAccountStatus("p-1", "" as any, "admin@example.com", db.deps())
    ).rejects.toThrow(PlatformValidationError);
    expect(db.calls).toHaveLength(0);
  });

  it("requires a valid partner id and actor", async () => {
    const db = fakeDb();
    await expect(
      setAccountStatus("  ", "active", "admin@example.com", db.deps())
    ).rejects.toThrow(/partner id/);
    await expect(
      setAccountStatus("p-1", "active", "", db.deps())
    ).rejects.toThrow(/actor/);
    expect(db.calls).toHaveLength(0);
  });

  it("reports a missing partner without auditing or updating", async () => {
    const db = fakeDb();
    // Force the existence SELECT to return no row.
    const emptyExec: QueryExecutor = async (sql, params = []) => {
      const t = sql.replace(/\s+/g, " ").trim();
      db.calls.push({ sql: t, params });
      return [];
    };
    await expect(
      setAccountStatus("missing", "active", "admin@example.com", {
        executor: emptyExec,
        now: fixedNow,
      })
    ).rejects.toThrow(PartnerNotFoundError);
    expect(db.audits()).toHaveLength(0);
    expect(db.calls.some((c) => /^UPDATE partner\b/i.test(c.sql))).toBe(false);
  });
});

/* ── verification ─────────────────────────────────────────────────────────── */

describe("setVerification", () => {
  it("refuses to verify without explicit admin notes before touching the DB", async () => {
    const db = fakeDb();
    await expect(
      setVerification("p-1", "verified", "admin@example.com", db.deps())
    ).rejects.toThrow(/notes/i);
    await expect(
      setVerification("p-1", "verified", "admin@example.com", db.deps({ notes: "   " }))
    ).rejects.toThrow(/notes/i);
    expect(db.calls).toHaveLength(0);
  });

  it("records notes, appends history, audits, and never changes account status", async () => {
    const db = fakeDb();
    const updated = await setVerification(
      "p-1",
      "verified",
      "admin@example.com",
      db.deps({ notes: "GSTIN and bank details checked", actorRole: "admin" })
    );

    expect(updated.verification_status).toBe("verified");
    expect(updated.account_status).toBe("pending"); // explicit verification != activation

    const up = db.updates()[0];
    expect(up.params[0]).toBe("verified");
    expect(up.sql).toContain("verification_status = $1");
    expect(up.sql).not.toMatch(/account_status\s*=/);
    const entry = JSON.parse(up.params[1])[0];
    expect(entry).toMatchObject({
      action: "verification_status",
      from: "unverified",
      to: "verified",
      actor: "admin@example.com",
      timestamp: FIXED_NOW,
      notes: "GSTIN and bank details checked",
    });

    expect(db.audits()).toHaveLength(1);
    expect(db.audits()[0].params[2]).toBe("admin"); // actor role from session
    expect(JSON.parse(db.audits()[0].params[6])).toMatchObject({
      to: "verified",
      notes: "GSTIN and bank details checked",
    });
  });

  it("rejects an invalid verification status", async () => {
    const db = fakeDb();
    await expect(
      setVerification("p-1", "active" as any, "admin@example.com", db.deps({ notes: "ok" }))
    ).rejects.toThrow(PlatformValidationError);
    expect(db.calls).toHaveLength(0);
  });
});

/* ── artist linking ───────────────────────────────────────────────────────── */

describe("linkArtist", () => {
  it("records the mapping in history + audit WITHOUT activating or verifying", async () => {
    const db = fakeDb({
      partner: {
        account_status: "pending",
        verification_status: "unverified",
        artist_id: null,
      },
    });
    const updated = await linkArtist(
      "p-1",
      "42",
      "admin@example.com",
      db.deps({ notes: "ownership confirmed" })
    );

    expect(updated.artist_id).toBe("42");
    expect(updated.account_status).toBe("pending"); // linking never activates
    expect(updated.verification_status).toBe("unverified"); // nor verifies

    const up = db.updates()[0];
    expect(up.sql).toContain("artist_id = $1");
    expect(up.sql).not.toMatch(/account_status\s*=/);
    expect(up.sql).not.toMatch(/verification_status\s*=/);
    const entry = JSON.parse(up.params[1])[0];
    expect(entry).toMatchObject({
      action: "link_artist",
      artist_id: "42",
      previous_artist_id: null,
      actor: "admin@example.com",
      timestamp: FIXED_NOW,
      notes: "ownership confirmed",
    });
    expect(entry).not.toHaveProperty("account_status");

    expect(db.audits()).toHaveLength(1);
    expect(db.audits()[0].params[3]).toBe("link_artist");
    expect(JSON.parse(db.audits()[0].params[6])).toMatchObject({
      artist_id: "42",
    });
  });

  it("validates the artist id and requires the artist to exist", async () => {
    const bad = fakeDb();
    await expect(
      linkArtist("p-1", "artist-9", "admin@example.com", bad.deps())
    ).rejects.toThrow(/numeric artist id/);
    await expect(
      linkArtist("p-1", "1; DROP TABLE partner", "admin@example.com", bad.deps())
    ).rejects.toThrow(/numeric artist id/);
    expect(bad.calls).toHaveLength(0);

    const missing = fakeDb({ artistExists: false });
    await expect(
      linkArtist("p-1", "999", "admin@example.com", missing.deps())
    ).rejects.toThrow(ArtistNotFoundError);
    expect(missing.audits()).toHaveLength(0);
    expect(missing.calls.some((c) => /^UPDATE partner\b/i.test(c.sql))).toBe(false);
  });
});

/* ── isolation of lifecycle columns / no generic payload path ────────────── */

describe("lifecycle columns are not reachable from a profile payload", () => {
  it("exports no generic update / profile function", () => {
    const genericUpdaters = Object.keys(platform).filter((k) =>
      /update|patch|profile|save|edit/i.test(k)
    );
    expect(genericUpdaters).toEqual([]);
    expect((platform as any).updatePartnerProfile).toBeUndefined();
    expect((platform as any).updatePartner).toBeUndefined();
  });

  it("only setAccountStatus ever writes account_status; only setVerification writes verification_status", async () => {
    const verifyDb = fakeDb();
    await setVerification("p-1", "verified", "admin@example.com", verifyDb.deps({ notes: "ok" }));
    expect(verifyDb.calls.some((c) => /account_status\s*=/.test(c.sql))).toBe(false);

    const linkDb = fakeDb();
    await linkArtist("p-1", "42", "admin@example.com", linkDb.deps());
    expect(linkDb.calls.some((c) => /account_status\s*=/.test(c.sql))).toBe(false);
    expect(linkDb.calls.some((c) => /verification_status\s*=/.test(c.sql))).toBe(false);

    const statusDb = fakeDb();
    await setAccountStatus("p-1", "active", "admin@example.com", statusDb.deps());
    expect(statusDb.calls.some((c) => /verification_status\s*=/.test(c.sql))).toBe(false);
  });

  it("a profile-shaped payload containing lifecycle fields cannot be smuggled in", async () => {
    const db = fakeDb();
    const profilePayload = {
      legal_name: "Vidya Handicrafts LLP",
      contact_email: "owner@vidya.example",
      account_status: "active",
      verification_status: "verified",
    };
    await expect(
      setAccountStatus("p-1", profilePayload as any, "admin@example.com", db.deps())
    ).rejects.toThrow(PlatformValidationError);
    await expect(
      setVerification("p-1", profilePayload as any, "admin@example.com", db.deps({ notes: "ok" }))
    ).rejects.toThrow(PlatformValidationError);
    expect(db.calls).toHaveLength(0);
  });

  it("never issues a destructive statement", async () => {
    const db = fakeDb();
    await setAccountStatus("p-1", "active", "admin@example.com", db.deps());
    await setVerification("p-1", "verified", "admin@example.com", db.deps({ notes: "ok" }));
    await linkArtist("p-1", "42", "admin@example.com", db.deps());
    expect(
      db.calls.filter((c) => /\b(DELETE|TRUNCATE|DROP)\b/i.test(c.sql))
    ).toEqual([]);
  });
});

/* ── reads ────────────────────────────────────────────────────────────────── */

describe("platform reads", () => {
  it("lists partners with bound filter parameters", async () => {
    const db = fakeDb();
    const result = await listPartners(db.exec, {
      status: "active",
      q: "vidya",
      limit: 10,
      offset: 5,
    });
    const list = db.calls[0];
    expect(list.sql).toContain("account_status = $1");
    expect(list.params[0]).toBe("active");
    expect(list.params[1]).toBe("%vidya%");
    expect(list.params).toHaveLength(4); // status, q, limit, offset
    expect(result.count).toBe(1);
  });

  it("rejects an invalid status filter before querying", async () => {
    const db = fakeDb();
    await expect(
      listPartners(db.exec, { status: "active; DROP TABLE partner" })
    ).rejects.toThrow(PlatformValidationError);
    expect(db.calls).toHaveLength(0);
  });

  it("fetches one partner by id with a bound parameter", async () => {
    const db = fakeDb();
    const found = await getPartner("p-1", db.exec);
    expect(found?.legal_name).toBe("Vidya Handicrafts LLP");
    expect(db.calls[0].sql).toContain("WHERE id = $1");
    expect(db.calls[0].params).toEqual(["p-1"]);
  });
});
