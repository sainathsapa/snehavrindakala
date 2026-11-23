/**
 * NOT-01 / NOT-02 — notification idempotency and provider receipts.
 *
 * The order confirmation used to be sent from both the payment subscriber and
 * checkout-complete. These tests pin the guarantee that a second identical send
 * costs nothing: no second render, no second SES call, no second row.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/modules/notification/transport", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../src/modules/notification/transport")
  >();
  return {
    ...actual,
    sendEmailWithReceipt: vi.fn(),
  };
});

import {
  sendEmailWithReceipt,
  NOTIFICATION_STATUS,
  DELIVERY_CONFIRMATION_STATUSES,
} from "../src/modules/notification/transport";
import {
  NotificationService,
  deriveEventKey,
} from "../src/modules/notification/service";

const receipt = vi.mocked(sendEmailWithReceipt);

/** Minimal entity manager: no knex, so the read-then-create path is used. */
class FakeManager {
  rows: any[] = [];

  getRepository() {
    const self = this;
    return {
      create(data: any) {
        return { ...data };
      },
      async findOne(where: any) {
        return self.rows.find((r) => r.event_key === where.event_key) || null;
      },
    };
  }

  async findOne(_entity: any, where: any) {
    return this.rows.find((r) => r.event_key === where.event_key) || null;
  }

  async persistAndFlush(row: any) {
    const index = this.rows.findIndex((r) => r.id === row.id);
    if (index >= 0) {
      this.rows[index] = { ...row };
      return;
    }
    if (
      row.event_key &&
      this.rows.some((r) => r.event_key === row.event_key)
    ) {
      const err: any = new Error("duplicate key value violates unique constraint");
      err.code = "23505";
      throw err;
    }
    this.rows.push({ ...row });
  }

  async findAndCount() {
    return [this.rows, this.rows.length];
  }
}

/** Tiny query builder exposing only the three calls the service makes. */
function makeKnex(rows: any[]) {
  const knex: any = (table: string) => {
    const builder: any = {
      table,
      insert(data: any) {
        this.inserted = data;
        return this;
      },
      onConflict() {
        return this;
      },
      ignore() {
        return this;
      },
      returning() {
        return this;
      },
      where(cond: any) {
        this.whereCond = cond;
        return this;
      },
      first() {
        this.result = () =>
          rows.find((r) => r.event_key === this.whereCond.event_key) || null;
        return this;
      },
      update(values: any) {
        this.result = () => {
          const row = rows.find((r) => r.id === this.whereCond.id);
          if (row) Object.assign(row, values);
          return 1;
        };
        return this;
      },
      then(resolve: any, reject: any) {
        // `insert` is followed by ignore()/returning(); insert is the marker.
        if (this.inserted) {
          const existing = rows.some(
            (r) => r.event_key === this.inserted.event_key
          );
          const value = existing ? [] : [{ ...this.inserted }];
          if (!existing) rows.push({ ...this.inserted });
          return Promise.resolve(value).then(resolve, reject);
        }
        return Promise.resolve(this.result ? this.result() : []).then(
          resolve,
          reject
        );
      },
    };
    return builder;
  };
  return knex;
}

class KnexManager {
  rows: any[] = [];
  knex: any;

  constructor() {
    this.knex = makeKnex(this.rows);
  }

  getConnection() {
    return { getKnex: () => this.knex };
  }
}

beforeEach(() => {
  receipt.mockReset();
  receipt.mockResolvedValue({ status: "sent", messageId: "ses-message-1" });
});

describe("deriveEventKey", () => {
  it("uses the order id in the storefront payload", () => {
    expect(
      deriveEventKey("order_confirmation", { order: { id: "order_42" } })
    ).toBe("order_confirmation:order_42");
  });

  it("uses the order id in the subscriber payload", () => {
    expect(deriveEventKey("order_confirmation", { order_id: "order_42" })).toBe(
      "order_confirmation:order_42"
    );
  });

  it("prefers an explicit key carried in the data", () => {
    expect(
      deriveEventKey("order_confirmation", {
        order: { id: "order_42" },
        eventKey: "order_confirmation:other",
      })
    ).toBe("order_confirmation:other");
  });

  it("declines to dedupe when there is no reference id", () => {
    expect(deriveEventKey("cart_reminder", {})).toBeNull();
    expect(deriveEventKey("cart_reminder", { order_id: "" })).toBeNull();
  });
});

describe("sendNotification idempotency (entity path)", () => {
  it("sends once and returns the same row on the second identical call", async () => {
    const manager = new FakeManager();
    const service = new NotificationService({ manager });
    const payload = {
      to: "buyer@example.com",
      template: "order_confirmation",
      data: { order: { id: "order_1", total: 100 } },
    };

    const first = await service.sendNotification(payload);
    const second = await service.sendNotification({ ...payload });

    expect(receipt).toHaveBeenCalledTimes(1);
    expect(second.id).toBe(first.id);
    expect(manager.rows).toHaveLength(1);
    expect(first.status).toBe("sent");
    expect(first.provider_message_id).toBe("ses-message-1");
  });

  it("lets an explicit subscriber key dedupe a storefront send", async () => {
    const manager = new FakeManager();
    const service = new NotificationService({ manager });

    await service.sendNotification({
      to: "buyer@example.com",
      template: "order_confirmation",
      eventKey: "order_confirmation:order_9",
      data: { order_id: "order_9" },
    });
    await service.sendNotification({
      to: "buyer@example.com",
      template: "order_confirmation",
      data: { order: { id: "order_9" } },
    });

    expect(receipt).toHaveBeenCalledTimes(1);
    expect(manager.rows).toHaveLength(1);
  });

  it("sends distinct events separately", async () => {
    const manager = new FakeManager();
    const service = new NotificationService({ manager });
    for (const id of ["order_1", "order_2"]) {
      await service.sendNotification({
        to: "buyer@example.com",
        template: "order_confirmation",
        data: { order: { id } },
      });
    }
    expect(receipt).toHaveBeenCalledTimes(2);
    expect(manager.rows).toHaveLength(2);
  });

  it("records a transport failure with its error message", async () => {
    receipt.mockRejectedValueOnce(new Error("SES throttled"));
    const manager = new FakeManager();
    const service = new NotificationService({ manager });

    const row = await service.sendNotification({
      to: "buyer@example.com",
      template: "order_confirmation",
      data: { order_id: "order_7" },
    });

    expect(row.status).toBe("failed");
    expect(row.error_message).toBe("SES throttled");
    expect(manager.rows).toHaveLength(1);
  });

  it("records a skipped transport without calling it twice", async () => {
    receipt.mockResolvedValue({ status: "skipped", messageId: null });
    const manager = new FakeManager();
    const service = new NotificationService({ manager });
    const payload = {
      to: "buyer@example.com",
      template: "order_confirmation",
      data: { order_id: "order_8" },
    };
    await service.sendNotification(payload);
    const second = await service.sendNotification(payload);
    expect(receipt).toHaveBeenCalledTimes(1);
    expect(second.status).toBe("skipped");
  });
});

describe("sendNotification idempotency (SQL ON CONFLICT path)", () => {
  it("uses INSERT ... ON CONFLICT DO NOTHING and returns the existing row", async () => {
    const manager = new KnexManager();
    const service = new NotificationService({ manager });
    const payload = {
      to: "buyer@example.com",
      template: "order_confirmation",
      data: { order_id: "order_12" },
    };

    const first = await service.sendNotification(payload);
    const second = await service.sendNotification(payload);

    expect(receipt).toHaveBeenCalledTimes(1);
    expect(second.id).toBe(first.id);
    expect(manager.rows).toHaveLength(1);
    expect(manager.rows[0].event_key).toBe("order_confirmation:order_12");
    expect(manager.rows[0].provider_message_id).toBe("ses-message-1");
    expect(manager.rows[0].status).toBe("sent");
  });
});

describe("delivery status vocabulary", () => {
  it("declares delivered and bounced without claiming a webhook exists", () => {
    expect(NOTIFICATION_STATUS.DELIVERED).toBe("delivered");
    expect(NOTIFICATION_STATUS.BOUNCED).toBe("bounced");
    expect(DELIVERY_CONFIRMATION_STATUSES).toContain("delivered");
    expect(DELIVERY_CONFIRMATION_STATUSES).toContain("bounced");
  });
});
