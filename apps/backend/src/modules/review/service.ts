/**
 * Review service.
 *
 * Plain module service following the audit module's pattern (a DML entity and
 * a `manager_` handed in by Medusa). Public list queries return only approved
 * reviews; moderation lists everything; summary computes counts/average from
 * approved rows only, so the star rating can never be inflated by unshown
 * drafts.
 */

import { Review } from "./entities/review";
import { randomUUID } from "crypto";
import type {
  CreateReviewInput,
  ModerateReviewInput,
  PublicReview,
  ReviewSummary,
} from "./types";

export class ReviewService {
  /**
   * Medusa constructs a module service with a single object, not positional
   * arguments. Taking `manager` positionally here meant the service received the
   * module's container instead, so `this.manager_.find(...)` was read as a
   * container lookup and every /store/reviews call failed with
   * "Could not resolve 'find'". Same shape as the other custom modules.
   */
  private readonly manager_: any;

  constructor({ manager }: { manager: any }) {
    this.manager_ = manager;
  }

  async create(input: CreateReviewInput): Promise<any> {
    const review = this.manager_
      .getRepository(Review)
      .create({
        id: randomUUID(),
        ...input,
        photos: input.photos && input.photos.length > 0 ? input.photos.slice(0, 3) : null,
        status: "pending",
      });
    await this.manager_.persistAndFlush(review);
    return review;
  }

  /** True when an approved review exists for this customer + product already. */
  async hasReviewed(product_id: string, customer_id: string): Promise<boolean> {
    const existing = await this.manager_.findOne(Review, {
      product_id,
      customer_id,
    });
    return Boolean(existing);
  }

  /** Approved reviews for a product, newest first. */
  async listPublic(product_id: string, limit = 10): Promise<PublicReview[]> {
    const rows = await this.manager_.find(
      Review,
      { product_id, status: "approved" },
      { orderBy: { created_at: "DESC" }, limit }
    );
    return rows.map((row: any) => ({
      id: row.id,
      product_id: row.product_id,
      author_name: row.author_name || "A customer",
      rating: row.rating,
      title: row.title,
      body: row.body,
      verified: Boolean(row.verified),
      created_at: row.created_at,
    }));
  }

  /** Rating summary from approved reviews only. */
  async summary(product_id: string): Promise<ReviewSummary> {
    const rows = await this.manager_.find(Review, {
      product_id,
      status: "approved",
    });
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0;
    for (const row of rows) {
      distribution[row.rating] = (distribution[row.rating] ?? 0) + 1;
      total += row.rating;
    }
    return {
      product_id,
      count: rows.length,
      average: rows.length > 0 ? Math.round((total / rows.length) * 10) / 10 : null,
      distribution: [5, 4, 3, 2, 1].map((rating) => ({
        rating,
        count: distribution[rating],
      })),
    };
  }

  /** All reviews for moderation, newest first. */
  async listModeration(filter: {
    status?: string;
    product_id?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ reviews: any[]; count: number }> {
    const { status, product_id, limit = 50, offset = 0 } = filter;
    const where: Record<string, any> = {};
    if (status) where.status = status;
    if (product_id) where.product_id = product_id;
    const [reviews, count] = await this.manager_.findAndCount(Review, where, {
      orderBy: { created_at: "DESC" },
      limit,
      offset,
    });
    return { reviews, count };
  }

  async moderate(id: string, input: ModerateReviewInput): Promise<any | null> {
    const review = await this.manager_.findOne(Review, { id });
    if (!review) return null;
    review.status = input.status;
    if (input.admin_note !== undefined) review.admin_note = input.admin_note;
    await this.manager_.persistAndFlush(review);
    return review;
  }
}