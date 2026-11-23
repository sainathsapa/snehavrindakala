import { describe, it, expect } from "vitest";
import {
  AlreadyReviewedError,
  ApplicationNotFoundError,
  ReviewValidationError,
  buildPartnerSlug,
  getApplication,
  isReviewDecision,
  listApplications,
  reviewApplication,
  type OnboardingApplication,
  type QueryExecutor,
  type ReviewDeps,
  type TransactionRunner,
} from "@/lib/partner-onboarding/review";
import { verifyPassword } from "@/lib/partner/password";

const APP = {
  id: "app-1",
  legal_name: "Vidya Handicrafts LLP",
  display_name: "Vidya Handicrafts",
  contact_email: "owner@vidya.example",
  contact_phone: "+91 98765 43210",
  business_details: { registration: "UNCONFIGURED", years_in_business: 4 },
  artist_information: { artist_id: "artist-9" },
  product_categories: ["textiles"],
  document_keys: ["doc-1"],
  review_status: "pending",
  review_notes: null,
  reviewed_by: null,
  reviewed_at: null,
  created_partner_id: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
} as unknown as OnboardingApplication;

const REVIEWED_AT = "2026-01-02T03:04:05.000Z";

interface Call {
  sql: string;
  params: any[];
}

/** A fake DB that records every statement issued inside the transaction. */
function fakeDb(application: OnboardingApplication | null = APP, partnerId = "partner-new") {
  const calls: Call[] = [];
  let transactionCount = 0;
  let time = 0; // 0 = no clock injected

  const exec: QueryExecutor = async (sql, params = []) => {
    calls.push({ sql, params });
    if (sql.includes("FROM partner_onboarding_application")) {
      return application ? [application] : [];
    }
    if (/^INSERT INTO partner\s*\(/.test(sql.trim())) {
      return [{ id: partnerId }];
    }
    if (/^INSERT INTO partner_membership\s*\(/.test(sql.trim())) {
      return [{}];
    }
    if (/^UPDATE partner_onboarding_application/.test(sql.trim())) {
      const [status, notes, reviewer, reviewedAt, createdId] = params;
      return [
        {
          ...(application ?? APP),
          review_status: status,
          review_notes: notes,
          reviewed_by: reviewer,
          reviewed_at: reviewedAt,
          created_partner_id: createdId ?? application?.created_partner_id ?? null,
        },
      ];
    }
    return [];
  };

  const transaction: TransactionRunner = async (fn) => {
    transactionCount += 1;
    return fn(exec);
  };

  const deps: ReviewDeps = {
    query: exec,
    transaction,
    now: () => new Date(time ? time : REVIEWED_AT),
    // Kept simple: every test uses the fixed REVIEWED_AT clock above.
  };

  return { deps, calls, getTransactions: () => transactionCount, setTime: (t: number) => (time = t) };
}

describe("admin decision validation", () => {
  it("accepts only the four review decisions", () => {
    expect(isReviewDecision("pending")).toBe(true);
    expect(isReviewDecision("more_info")).toBe(true);
    expect(isReviewDecision("approved")).toBe(true);
    expect(isReviewDecision("rejected")).toBe(true);
    expect(isReviewDecision("approve")).toBe(false);
    expect(isReviewDecision(null)).toBe(false);
  });

  it("rejects an invalid decision before touching the database", async () => {
    const { deps, calls } = fakeDb();
    await expect(
      reviewApplication(
        {
          id: "app-1",
          decision: "bogus" as any,
          reviewerId: "admin@example.com",
        },
        deps
      )
    ).rejects.toThrow(ReviewValidationError);
    expect(calls).toHaveLength(0);
  });

  it("requires an application id and a reviewer identity", async () => {
    const { deps, calls } = fakeDb();
    await expect(
      reviewApplication(
        { id: "", decision: "approved", reviewerId: "admin@example.com" },
        deps
      )
    ).rejects.toThrow(/application id/);
    await expect(
      reviewApplication({ id: "app-1", decision: "rejected", reviewerId: "" }, deps)
    ).rejects.toThrow(/reviewer/);
    expect(calls).toHaveLength(0);
  });
});

describe("approval provisions a partner and an owner in one transaction", () => {
  it("creates partner + owner membership from submitted data and stores only a password hash", async () => {
    const { deps, calls, getTransactions } = fakeDb();

    const result = await reviewApplication(
      {
        id: "app-1",
        decision: "approved",
        reviewerId: "admin@example.com",
        notes: "identity confirmed",
      },
      deps
    );

    expect(result.ok).toBe(true);
    expect(result.partnerId).toBe("partner-new");
    expect(result.temporaryPassword).toMatch(/^SvK-/);
    expect(result.temporaryPassword!.length).toBeGreaterThanOrEqual(12);
    expect(getTransactions()).toBe(1);

    const partnerInsert = calls.find((c) => /^INSERT INTO partner\s*\(/.test(c.sql.trim()));
    expect(partnerInsert).toBeDefined();
    const [legalName, displayName, slug, email, phone, profile, history, reviewedAt] =
      partnerInsert!.params;
    expect(legalName).toBe(APP.legal_name);
    expect(displayName).toBe(APP.display_name);
    expect(slug).toMatch(/^vidya-handicrafts-[0-9a-f]{8}$/);
    expect(email).toBe(APP.contact_email);
    expect(phone).toBe(APP.contact_phone);
    expect(JSON.parse(profile)).toEqual(APP.business_details);
    expect(partnerInsert!.sql).toContain("'active'");
    expect(partnerInsert!.sql).toContain("'unverified'");
    expect(JSON.parse(history)[0]).toMatchObject({
      decision: "approved",
      reviewer_id: "admin@example.com",
      reviewed_at: REVIEWED_AT,
      notes: "identity confirmed",
    });
    expect(reviewedAt).toBe(REVIEWED_AT);
    // The one-time password must never appear in a stored value.
    expect(JSON.stringify(partnerInsert!.params)).not.toContain(result.temporaryPassword!);

    const membershipInsert = calls.find((c) =>
      /^INSERT INTO partner_membership\s*\(/.test(c.sql.trim())
    );
    expect(membershipInsert).toBeDefined();
    const [memberPartnerId, memberEmail, passwordHash] = membershipInsert!.params;
    expect(memberPartnerId).toBe("partner-new");
    expect(memberEmail).toBe(APP.contact_email);
    expect(membershipInsert!.sql).toContain("'owner'");
    expect(membershipInsert!.sql).toContain("'invited'");
    expect(passwordHash).toMatch(/^scrypt\$/);
    expect(passwordHash).not.toBe(result.temporaryPassword);
    expect(verifyPassword(result.temporaryPassword!, passwordHash)).toBe(true);
    expect(JSON.stringify(membershipInsert!.params)).not.toContain(
      result.temporaryPassword!
    );

    const update = calls.find((c) => /^UPDATE partner_onboarding_application/.test(c.sql.trim()));
    expect(update!.params).toEqual([
      "approved",
      "identity confirmed",
      "admin@example.com",
      REVIEWED_AT,
      "partner-new",
      "app-1",
    ]);

    // All writes happened inside the single injected transaction.
    expect(calls.length).toBe(4);
  });

  it("refuses to approve the same application twice (no duplicate partner)", async () => {
    const already = {
      ...APP,
      review_status: "approved" as const,
      created_partner_id: "partner-old",
    };
    const { deps, calls } = fakeDb(already);
    await expect(
      reviewApplication(
        { id: "app-1", decision: "approved", reviewerId: "admin@example.com" },
        deps
      )
    ).rejects.toThrow(AlreadyReviewedError);
    expect(calls.some((c) => /^INSERT INTO partner\s*\(/.test(c.sql.trim()))).toBe(false);
  });

  it("reports a missing application without provisioning anything", async () => {
    const { deps, calls } = fakeDb(null);
    await expect(
      reviewApplication(
        { id: "missing", decision: "approved", reviewerId: "admin@example.com" },
        deps
      )
    ).rejects.toThrow(ApplicationNotFoundError);
    expect(calls).toHaveLength(1); // only the SELECT FOR UPDATE
  });
});

describe("non-approval decisions only update the application", () => {
  it("rejection does not create a partner or a membership", async () => {
    const { deps, calls, getTransactions } = fakeDb();
    const result = await reviewApplication(
      {
        id: "app-1",
        decision: "rejected",
        reviewerId: "admin@example.com",
        notes: "incomplete documents",
      },
      deps
    );

    expect(result.partnerId).toBeNull();
    expect(result.temporaryPassword).toBeNull();
    expect(getTransactions()).toBe(1);
    expect(
      calls.some((c) => /^INSERT INTO partner(_membership)?\s*\(/.test(c.sql.trim()))
    ).toBe(false);

    const update = calls.find((c) => /^UPDATE partner_onboarding_application/.test(c.sql.trim()));
    expect(update!.params[0]).toBe("rejected");
    expect(update!.params[1]).toBe("incomplete documents");
    expect(update!.params[4]).toBeNull();
  });

  it("request-more-info keeps the application pending-created with no partner", async () => {
    const { deps, calls } = fakeDb();
    const result = await reviewApplication(
      { id: "app-1", decision: "more_info", reviewerId: "admin@example.com" },
      deps
    );
    expect(result.temporaryPassword).toBeNull();
    const update = calls.find((c) => /^UPDATE partner_onboarding_application/.test(c.sql.trim()));
    expect(update!.params[0]).toBe("more_info");
    expect(
      calls.some((c) => /^INSERT INTO partner\s*\(/.test(c.sql.trim()))
    ).toBe(false);
  });
});

describe("reads and pure helpers", () => {
  it("lists applications with bound parameters instead of interpolated status", async () => {
    const { deps, calls } = fakeDb();
    await listApplications({ status: "pending", q: "vidya", limit: 10, offset: 0 }, deps);
    const list = calls[0];
    expect(list.sql).toContain("review_status = $1");
    expect(list.params[0]).toBe("pending");
    expect(list.params[1]).toBe("%vidya%");
    expect(list.params).toHaveLength(4);
  });

  it("refuses an invalid status filter", async () => {
    const { deps, calls } = fakeDb();
    await expect(listApplications({ status: "drop-table" }, deps)).rejects.toThrow(
      ReviewValidationError
    );
    expect(calls).toHaveLength(0);
  });

  it("fetches a single application by id", async () => {
    const { deps, calls } = fakeDb();
    const found = await getApplication("app-1", deps);
    expect(found?.legal_name).toBe(APP.legal_name);
    expect(calls[0].sql).toContain("WHERE id = $1");
    expect(calls[0].params).toEqual(["app-1"]);
  });

  it("slugifies the display name and appends a short unique suffix", () => {
    expect(buildPartnerSlug("Vidya & Sons", "abc123def")).toBe("vidya-and-sons-abc123de");
    expect(buildPartnerSlug("!!!", "feedbeef")).toBe("partner-feedbeef");
  });
});
