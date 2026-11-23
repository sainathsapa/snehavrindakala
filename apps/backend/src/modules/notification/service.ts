/**
 * Notification service. Transactional email/message records (DML).
 *
 * DML entities are registered with MikroORM via
 * MedusaServiceModelObjectsSymbol.
 *
 * NOT-01: a send carries an idempotency key (supplied or derived from the
 * template plus the reference id). A UNIQUE index on `event_key` makes claiming
 * that key atomic. A second call for the same key returns the row that is
 * already there and never reaches the transport.
 *
 * NOT-02: the provider's `MessageId` is persisted on the row, and a failed send
 * keeps its error text, so an operator can see what happened and retry it.
 */
import { Notification } from "./entities/notification";
import { MedusaServiceModelObjectsSymbol } from "@medusajs/utils";
import { randomUUID } from "crypto";
import type { SendNotificationInput } from "./types";
import { renderTemplate, type TemplateContext } from "./templates";
import { sendEmailWithReceipt, type SendReceipt } from "./transport";
import { planNotificationFailure, classifySendError } from "./retry";

const MODEL_OBJECTS = {
  Notification,
};

/** The service accepts an optional explicit key; old callers need not change. */
type NotificationInput = SendNotificationInput & { eventKey?: string };
type NotificationRow = any;

/**
 * A stable key for "this message about this thing". The storefront posts
 * `{ to, template, data }` to /store/notifications/send, where the reference id
 * lives in `data.order.id`; the backend subscriber has the same id. Deriving the
 * same string on both paths is what collapses the two confirmation sends into
 * one. An explicit key (or one carried inside `data`) wins over derivation.
 */
export function deriveEventKey(
  template: string,
  data: Record<string, any> = {}
): string | null {
  const supplied = data?.eventKey ?? data?.idempotencyKey ?? data?.event_key;
  if (typeof supplied === "string" && supplied.trim()) return supplied.trim();

  const ref =
    data?.order?.id ??
    data?.orderId ??
    data?.order_id ??
    data?.reference_id ??
    data?.quote_id ??
    data?.shipment_id ??
    data?.cart_id;
  if (ref === undefined || ref === null || ref === "") return null;
  return `${template}:${String(ref)}`;
}

function isUniqueViolation(err: any): boolean {
  return Boolean(
    err &&
      (err.code === "23505" ||
        /unique|duplicate key|conflict/i.test(String(err?.message || "")))
  );
}

export class NotificationService {
  protected readonly manager_: any;

  constructor({ manager }: { manager: any }) {
    this.manager_ = manager;
  }

  /** The underlying query builder, when the manager exposes one. */
  private knex(): any | null {
    try {
      return this.manager_?.getConnection?.()?.getKnex?.() || null;
    } catch {
      return null;
    }
  }

  private async findByEventKey(eventKey: string): Promise<NotificationRow | null> {
    const repo = this.manager_?.getRepository?.(Notification);
    if (repo && typeof repo.findOne === "function") {
      return (await repo.findOne({ event_key: eventKey })) || null;
    }
    if (typeof this.manager_?.findOne === "function") {
      return (await this.manager_.findOne(Notification, { event_key: eventKey })) || null;
    }
    return null;
  }

  /**
   * Claim the right to send.
   *
   * With a SQL runner this is a real `INSERT ... ON CONFLICT DO NOTHING
   * RETURNING`: the UNIQUE index is the arbiter, so two concurrent callers
   * cannot both win. Without one (unit tests, or a manager that hides
   * its connection) we do the equivalent read-then-create and rely on the same
   * index plus a unique-violation catch as the final guard.
   */
  private async claim(
    eventKey: string | null,
    seed: Record<string, any>
  ): Promise<{ row: NotificationRow | null; claimed: boolean; viaSql: boolean }> {
    const knex = this.knex();
    if (knex && eventKey) {
      const [inserted] = await knex("app_notification")
        .insert({ ...seed, event_key: eventKey })
        .onConflict("event_key")
        .ignore()
        .returning("*");
      if (inserted) return { row: inserted, claimed: true, viaSql: true };
      const existing = await knex("app_notification")
        .where({ event_key: eventKey })
        .first();
      return { row: existing || null, claimed: false, viaSql: true };
    }

    if (eventKey) {
      const existing = await this.findByEventKey(eventKey);
      if (existing) return { row: existing, claimed: false, viaSql: false };
    }
    return { row: null, claimed: false, viaSql: false };
  }

  private async writeSqlOutcome(
    row: NotificationRow,
    outcome: { status: string; messageId?: string | null; error?: string | null }
  ): Promise<NotificationRow> {
    // GAP-05: the send path writes retry state (migration 005) alongside the
    // historical outcome. A transient failure is scheduled for retry instead of
    // being discarded; a terminal one is marked terminal. `status` keeps its
    // six-value vocabulary, so this is fully additive for existing rows/readers.
    const failure =
      outcome.status === "failed"
        ? planNotificationFailure({ attempts: Number(row.attempts) || 0, error: outcome.error })
        : null;
    const updates: Record<string, any> = {
      status: outcome.status,
      provider_message_id: outcome.messageId ?? null,
      error_message: outcome.error ?? null,
      updated_at: new Date(),
      last_attempt_at: new Date(),
      ...(failure
        ? {
            attempts: failure.attempts,
            delivery_status: failure.delivery_status,
            next_attempt_at: failure.next_attempt_at,
            last_error: failure.last_error,
            error_kind: failure.error_kind,
            terminal_reason: failure.terminal_reason,
            dead_lettered_at: failure.dead_lettered_at,
          }
        : {
            attempts: Number(row.attempts) || 0,
            delivery_status: outcome.status === "sent" ? "accepted" : "skipped",
          }),
    };
    const knex = this.knex()!;
    await knex("app_notification").where({ id: row.id }).update(updates);
    return { ...row, ...updates };
  }

  async sendNotification(data: NotificationInput): Promise<any> {
    const {
      to,
      template,
      data: templateData,
      channel = "email",
      eventKey,
    } = data;
    const key = eventKey || deriveEventKey(template, templateData || {});

    const seed: Record<string, any> = {
      id: randomUUID(),
      recipient: to,
      channel,
      template,
      data: templateData || {},
      status: "pending",
      provider_message_id: null,
      error_message: null,
      attempts: 0,
      delivery_status: "queued",
    };

    const claim = await this.claim(key, seed);
    if (claim.row && !claim.claimed) {
      // NOT-01: already recorded. Returning here means no second render, no
      // second transport call and no second row — a true no-op.
      return claim.row;
    }

    const row: NotificationRow =
      claim.row ||
      this.manager_.getRepository(Notification).create({
        ...seed,
        event_key: key,
      });

    let outcome: {
      status: string;
      messageId?: string | null;
      error?: string | null;
    } = { status: "skipped" };

    try {
      if (channel === "email") {
        const receipt = await this.sendViaSES(to, template, templateData || {});
        // "skipped" means SES is not configured (development). That is not a
        // failure — recording it as one would make the admin queue look broken.
        outcome = {
          status: receipt.status === "sent" ? "sent" : "skipped",
          messageId: receipt.messageId,
        };
      } else {
        console.log(
          `[Notification] channel "${channel}" is not implemented; skipping (template="${template}")`
        );
        outcome = { status: "skipped" };
      }
    } catch (err) {
      outcome = {
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      };
      // Log a PII-free classification only — the provider error may quote the
      // recipient address and must not be copied into application logs.
      console.error(
        `[Notification] Failed to send "${template}" (${classifySendError(err).reason}); recipient withheld`
      );
    }

    if (claim.viaSql && claim.claimed) {
      return this.writeSqlOutcome(row, outcome);
    }

    row.status = outcome.status;
    row.provider_message_id = outcome.messageId ?? null;
    row.error_message = outcome.error ?? null;
    // GAP-05 retry state, mirrored from writeSqlOutcome for non-SQL managers.
    row.attempts = Number(row.attempts) || 0;
    row.last_attempt_at = new Date();
    if (outcome.status === "failed") {
      Object.assign(
        row,
        planNotificationFailure({
          attempts: Number(row.attempts) || 0,
          error: outcome.error,
        })
      );
    } else {
      row.delivery_status = outcome.status === "sent" ? "accepted" : "skipped";
    }

    try {
      await this.manager_.persistAndFlush(row);
    } catch (err) {
      // A racing insert can still beat the pre-check. The unique index decides
      // the winner, and returning the winner keeps this call a no-op.
      if (isUniqueViolation(err) && key) {
        const existing = await this.findByEventKey(key);
        if (existing) return existing;
      }
      throw err;
    }

    return row;
  }

  private templateContext(): TemplateContext {
    return {
      storefrontUrl: (
        process.env.STOREFRONT_URL ||
        process.env.NEXT_PUBLIC_STOREFRONT_URL ||
        "https://snehavrinda.in"
      ).replace(/\/+$/, ""),
      contactEmail:
        process.env.CONTACT_EMAIL ||
        process.env.NEXT_PUBLIC_CONTACT_EMAIL ||
        "hello@snehavrinda.in",
      currency: process.env.MEDUSA_CURRENCY_CODE?.toUpperCase() || "INR",
    };
  }

  private async sendViaSES(
    to: string,
    template: string,
    templateData: Record<string, any>
  ): Promise<SendReceipt> {
    if (!to) {
      throw new Error(
        `Cannot send "${template}": no recipient address was provided`
      );
    }

    const rendered = renderTemplate(
      template,
      this.templateContext(),
      templateData
    );

    return sendEmailWithReceipt({
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  async listNotifications(filter: {
    recipient?: string;
    status?: string;
    template?: string;
    offset?: number;
    limit?: number;
  } = {}): Promise<{ notifications: any[]; count: number }> {
    const { recipient, status, template, offset = 0, limit = 50 } = filter;
    const where: Record<string, any> = {};
    if (recipient) where.recipient = recipient;
    if (status) where.status = status;
    if (template) where.template = template;

    const [notifications, count] = await this.manager_.findAndCount(
      Notification,
      where,
      {
        offset,
        limit,
        orderBy: { created_at: "DESC" },
      }
    );

    return { notifications, count };
  }
}

// Register DML entities with Medusa/MikroORM metadata at module load time.
(NotificationService as any)[MedusaServiceModelObjectsSymbol] = MODEL_OBJECTS;
