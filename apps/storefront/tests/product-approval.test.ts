import { describe, it, expect } from "vitest";
import {
  canReview,
  isReviewDecision,
  listSubmissions,
  NotReviewableError,
  ProductApprovalValidationError,
  reviewSubmission,
  SubmissionNotFoundError,
  type ProductSubmission,
  type QueryExecutor,
} from "@/lib/admin-marketplace/product-approvals";

const SUBMISSION = {
  id: "sub-1",
  partner_id: "partner-1",
  product_id: "prod-1",
  submission_status: "submitted",
  attributes: { material: "cotton" },
  rejection_reason: null,
  submitted_at: "2026-01-01T00:00:00.000Z",
  reviewed_by: null,
  reviewed_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
} as unknown as ProductSubmission;

interface Call {
  sql: string;
  params: any[];
}

/** Fake executor that records every statement and models the row + its update. */
function fakeDb(current: ProductSubmission | null = SUBMISSION) {
  const calls: Call[] = [];
  const exec: QueryExecutor = async (sql, params = []) => {
    calls.push({ sql, params });
    const s = sql.trim();
    if (/^SELECT \* FROM partner_product WHERE id = /.test(s)) {
      return current ? [current] : [];
    }
    if (/^UPDATE partner_product/.test(s)) {
      const [status, reason, reviewer, reviewedAt, id] = params;
      return [
        {
          ...(current ?? SUBMISSION),
          id,
          submission_status: status,
          rejection_reason: reason,
          reviewed_by: reviewer,
          reviewed_at: reviewedAt,
          updated_at: reviewedAt,
        },
      ];
    }
    if (s.includes("FROM partner_product pp")) {
      return [{ ...SUBMISSION, partner_display_name: "Vidya Handicrafts" }];
    }
    return [];
  };
  return { exec, calls };
}

const updateCall = (calls: Call[]) =>
  calls.find((c) => /^UPDATE partner_product/.test(c.sql.trim()))!;

describe("canReview (pure state guard)", () => {
  it("allows only a submitted product", () => {
    expect(canReview("submitted")).toBe(true);
  });

  it("refuses drafts, already-decided products and anything else", () => {
    for (const status of [
      "draft",
      "approved",
      "rejected",
      "SUBMITTED",
      "",
      null,
      undefined,
    ]) {
      expect(canReview(status)).toBe(false);
    }
  });
});

describe("decision validation happens before any database write", () => {
  it("accepts only approved / rejected", () => {
    expect(isReviewDecision("approved")).toBe(true);
    expect(isReviewDecision("rejected")).toBe(true);
    for (const v of ["approve", "reject", "pending", "draft", null, undefined]) {
      expect(isReviewDecision(v)).toBe(false);
    }
  });

  it("rejects an invalid decision without touching the database", async () => {
    const { exec, calls } = fakeDb();
    await expect(
      reviewSubmission(
        "sub-1",
        { decision: "approve" as any, reviewer: "admin@example.com" },
        exec
      )
    ).rejects.toThrow(ProductApprovalValidationError);
    expect(calls).toHaveLength(0);
  });

  it("requires a reviewer identity", async () => {
    const { exec, calls } = fakeDb();
    await expect(
      reviewSubmission(
        "sub-1",
        { decision: "approved", reviewer: "   " },
        exec
      )
    ).rejects.toThrow(/reviewer/i);
    expect(calls).toHaveLength(0);
  });
});

describe("only submitted products can be reviewed", () => {
  it.each(["draft", "approved", "rejected"])(
    "refuses to review a %s submission and issues no UPDATE",
    async (status) => {
      const current = {
        ...SUBMISSION,
        submission_status: status as ProductSubmission["submission_status"],
      } as ProductSubmission;
      const { exec, calls } = fakeDb(current);
      await expect(
        reviewSubmission(
          "sub-1",
          { decision: "approved", reviewer: "admin@example.com" },
          exec
        )
      ).rejects.toThrow(NotReviewableError);
      expect(calls.some((c) => /^UPDATE partner_product/.test(c.sql.trim()))).toBe(
        false
      );
    }
  );

  it("reports a missing submission without updating anything", async () => {
    const { exec, calls } = fakeDb(null);
    await expect(
      reviewSubmission(
        "missing",
        { decision: "approved", reviewer: "admin@example.com" },
        exec
      )
    ).rejects.toThrow(SubmissionNotFoundError);
    expect(calls).toHaveLength(1); // only the SELECT ... FOR UPDATE
  });
});

describe("approval sets the decision and audit fields", () => {
  it("records approved with no reason and complete reviewer audit fields", async () => {
    const { exec, calls } = fakeDb();
    const result = await reviewSubmission(
      "sub-1",
      { decision: "approved", reviewer: "admin@example.com" },
      exec
    );

    expect(result.ok).toBe(true);
    const call = updateCall(calls);
    const [status, reason, reviewer, reviewedAt, id] = call.params;
    expect(status).toBe("approved");
    expect(reason).toBeNull();
    expect(reviewer).toBe("admin@example.com");
    expect(id).toBe("sub-1");
    expect(reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO timestamp

    expect(result.submission.submission_status).toBe("approved");
    expect(result.submission.rejection_reason).toBeNull();
    expect(result.submission.reviewed_by).toBe(reviewer);
    expect(result.submission.reviewed_at).toBe(reviewedAt);
    expect(result.submission.updated_at).toBe(reviewedAt);
  });

  it("clears a stale rejection reason when approving", async () => {
    const current = {
      ...SUBMISSION,
      rejection_reason: "old reason",
    } as ProductSubmission;
    const { exec, calls } = fakeDb(current);
    await reviewSubmission(
      "sub-1",
      { decision: "approved", reviewer: "admin@example.com" },
      exec
    );
    expect(updateCall(calls).params[1]).toBeNull();
  });
});

describe("rejection requires a reason", () => {
  it("rejects a rejection with no reason before any DB write", async () => {
    const { exec, calls } = fakeDb();
    await expect(
      reviewSubmission(
        "sub-1",
        { decision: "rejected", reviewer: "admin@example.com" },
        exec
      )
    ).rejects.toThrow(/reason/i);
    expect(calls).toHaveLength(0);
  });

  it("rejects a blank reason", async () => {
    const { exec, calls } = fakeDb();
    await expect(
      reviewSubmission(
        "sub-1",
        { decision: "rejected", reason: "   ", reviewer: "admin@example.com" },
        exec
      )
    ).rejects.toThrow(/reason/i);
    expect(calls).toHaveLength(0);
  });

  it("stores the trimmed reason together with the reviewer audit fields", async () => {
    const { exec, calls } = fakeDb();
    const result = await reviewSubmission(
      "sub-1",
      {
        decision: "rejected",
        reason: "  missing artisan details  ",
        reviewer: "admin@example.com",
      },
      exec
    );

    const [status, reason, reviewer, reviewedAt] = updateCall(calls).params;
    expect(status).toBe("rejected");
    expect(reason).toBe("missing artisan details");
    expect(reviewer).toBe("admin@example.com");
    expect(reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.submission.submission_status).toBe("rejected");
    expect(result.submission.rejection_reason).toBe("missing artisan details");
    expect(result.submission.reviewed_by).toBe(reviewer);
    expect(result.submission.reviewed_at).toBe(reviewedAt);
  });
});

describe("listSubmissions", () => {
  it("binds a status filter as a parameter, never interpolated", async () => {
    const { exec, calls } = fakeDb();
    const rows = await listSubmissions(exec, "submitted");
    expect(calls[0].sql).toContain("pp.submission_status = $1");
    expect(calls[0].params).toEqual(["submitted"]);
    expect(rows[0].partner_display_name).toBe("Vidya Handicrafts");
  });

  it("lists all submissions when no status is given", async () => {
    const { exec, calls } = fakeDb();
    await listSubmissions(exec);
    expect(calls[0].sql).not.toContain("submission_status =");
    expect(calls[0].params).toEqual([]);
  });

  it("refuses an invalid status filter before hitting the database", async () => {
    const { exec, calls } = fakeDb();
    await expect(listSubmissions(exec, "drop-table")).rejects.toThrow(
      ProductApprovalValidationError
    );
    expect(calls).toHaveLength(0);
  });
});
