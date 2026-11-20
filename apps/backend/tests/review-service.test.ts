/**
 * Unit tests for the review service's public-facing behaviour.
 *
 * The service takes a MikroORM-style manager. A tiny fake stands in for it so
 * the summary math, the approved-only guarantee and the duplicate guard can be
 * tested without a database.
 */

import { ReviewService } from "../src/modules/review/service";

function fakeManager(seed: any[] = []) {
  const rows = seed.map((r) => ({ ...r }));
  return {
    rows,
    getRepository() {
      return {
        create: (data: any) => data,
      };
    },
    async persistAndFlush() {},
    async findOne(_entity: any, where: any) {
      return (
        rows.find((r) =>
          Object.entries(where).every(([k, v]) => (r as any)[k] === v)
        ) ?? null
      );
    },
    async find(_entity: any, where: any) {
      return rows.filter((r) =>
        Object.entries(where).every(([k, v]) => (r as any)[k] === v)
      );
    },
    async findAndCount(_entity: any, where: any) {
      const matched = rows.filter((r) =>
        Object.entries(where).every(([k, v]) => (r as any)[k] === v)
      );
      return [matched, matched.length];
    },
  };
}

const review = (over: Partial<any> = {}) => ({
  id: Math.random().toString(36).slice(2),
  product_id: "prod_1",
  rating: 5,
  body: "Lovely",
  status: "approved",
  verified: true,
  created_at: new Date("2024-01-01"),
  updated_at: new Date("2024-01-01"),
  ...over,
});

describe("ReviewService.summary", () => {
  it("counts only approved reviews", async () => {
    const mgr = fakeManager([
      review({ rating: 5, status: "approved" }),
      review({ rating: 5, status: "approved" }),
      review({ rating: 1, status: "pending" }),
      review({ rating: 1, status: "rejected" }),
    ]);
    const summary = await new ReviewService({ manager: mgr }).summary("prod_1");
    expect(summary.count).toBe(2);
    expect(summary.average).toBe(5);
  });

  it("returns null average when there are no approved reviews", async () => {
    const mgr = fakeManager([review({ status: "pending" })]);
    const summary = await new ReviewService({ manager: mgr }).summary("prod_1");
    expect(summary.count).toBe(0);
    expect(summary.average).toBeNull();
  });

  it("rounds the average to one decimal place", async () => {
    const mgr = fakeManager([
      review({ rating: 5 }),
      review({ rating: 4 }),
      review({ rating: 4 }),
    ]);
    const summary = await new ReviewService({ manager: mgr }).summary("prod_1");
    // (5+4+4)/3 = 4.333... -> 4.3
    expect(summary.average).toBe(4.3);
  });

  it("builds a 5..1 distribution from approved reviews only", async () => {
    const mgr = fakeManager([
      review({ rating: 5 }),
      review({ rating: 3 }),
      review({ rating: 3 }),
      review({ rating: 1, status: "rejected" }),
    ]);
    const summary = await new ReviewService({ manager: mgr }).summary("prod_1");
    const byRating = Object.fromEntries(
      summary.distribution.map((d) => [d.rating, d.count])
    );
    expect(summary.distribution.map((d) => d.rating)).toEqual([5, 4, 3, 2, 1]);
    expect(byRating[5]).toBe(1);
    expect(byRating[3]).toBe(2);
    expect(byRating[1]).toBe(0); // rejected excluded
  });
});

describe("ReviewService.listPublic", () => {
  it("returns only approved reviews for the product", async () => {
    const mgr = fakeManager([
      review({ id: "a", status: "approved" }),
      review({ id: "b", status: "pending" }),
      review({ id: "c", product_id: "prod_2", status: "approved" }),
    ]);
    const list = await new ReviewService({ manager: mgr }).listPublic("prod_1");
    expect(list.map((r) => r.id)).toEqual(["a"]);
  });

  it("falls back to 'A customer' when the author name is empty", async () => {
    const mgr = fakeManager([review({ author_name: null })]);
    const list = await new ReviewService({ manager: mgr }).listPublic("prod_1");
    expect(list[0].author_name).toBe("A customer");
  });
});

describe("ReviewService.hasReviewed", () => {
  it("is true when a review already exists for customer+product", async () => {
    const mgr = fakeManager([
      review({ customer_id: "cus_1", product_id: "prod_1" }),
    ]);
    expect(await new ReviewService({ manager: mgr }).hasReviewed("prod_1", "cus_1")).toBe(true);
  });

  it("is false for a different product", async () => {
    const mgr = fakeManager([
      review({ customer_id: "cus_1", product_id: "prod_1" }),
    ]);
    expect(await new ReviewService({ manager: mgr }).hasReviewed("prod_2", "cus_1")).toBe(false);
  });
});