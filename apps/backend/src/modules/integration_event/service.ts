/**
 * Integration event service. Idempotent webhook event ledger (DML).
 *
 * DML entities are registered with MikroORM via
 * MedusaServiceModelObjectsSymbol.
 */
import { IntegrationEvent } from "./entities/integration_event";
import { MedusaServiceModelObjectsSymbol } from "@medusajs/utils";
import type { CreateIntegrationEventInput } from "./types";

const MODEL_OBJECTS = {
  IntegrationEvent,
};

export class IntegrationEventService {
  protected readonly manager_: any;

  constructor({ manager }: { manager: any }) {
    this.manager_ = manager;
  }

  async recordEvent(data: CreateIntegrationEventInput): Promise<any> {
    const existing = await this.manager_.findOne(IntegrationEvent, {
      where: { provider: data.provider, event_id: data.event_id },
    });
    if (existing) {
      return existing;
    }

    const event = this.manager_
      .getRepository(IntegrationEvent)
      .create({
        ...data,
        processing_state: data.processing_state ?? "received",
        attempt_count: data.attempt_count ?? 0,
        received_at: data.received_at ?? new Date(),
      });
    return this.manager_.persistAndFlush(event);
  }

  async getEvent(id: string): Promise<any | null> {
    return this.manager_.findOne(IntegrationEvent, { id });
  }

  async getEventByProviderAndId(
    provider: string,
    eventId: string
  ): Promise<any | null> {
    return this.manager_.findOne(IntegrationEvent, {
      provider,
      event_id: eventId,
    });
  }

  async markProcessing(id: string): Promise<any> {
    const event = await this.manager_.findOne(IntegrationEvent, { id });
    if (!event) {
      throw new Error(`Integration event ${id} not found`);
    }

    await this.manager_.getRepository(IntegrationEvent).update(id, {
      processing_state: "processing",
      attempt_count: (event.attempt_count || 0) + 1,
    });
    return this.manager_.findOne(IntegrationEvent, { id });
  }

  async markProcessed(id: string): Promise<any> {
    const event = await this.manager_.findOne(IntegrationEvent, { id });
    if (!event) {
      throw new Error(`Integration event ${id} not found`);
    }

    await this.manager_.getRepository(IntegrationEvent).update(id, {
      processing_state: "processed",
      processed_at: new Date(),
    });
    return this.manager_.findOne(IntegrationEvent, { id });
  }

  async markFailed(id: string, error: string): Promise<any> {
    const event = await this.manager_.findOne(IntegrationEvent, { id });
    if (!event) {
      throw new Error(`Integration event ${id} not found`);
    }

    await this.manager_.getRepository(IntegrationEvent).update(id, {
      processing_state: "failed",
      last_error: error,
    });
    return this.manager_.findOne(IntegrationEvent, { id });
  }

  async markDeadLetter(id: string): Promise<any> {
    const event = await this.manager_.findOne(IntegrationEvent, { id });
    if (!event) {
      throw new Error(`Integration event ${id} not found`);
    }

    await this.manager_.getRepository(IntegrationEvent).update(id, {
      processing_state: "dead_letter",
    });
    return this.manager_.findOne(IntegrationEvent, { id });
  }

  async listFailedEvents(limit: number = 50): Promise<any[]> {
    return this.manager_.find(IntegrationEvent, {
      where: { processing_state: "failed" },
      orderBy: { updated_at: "ASC" },
      take: limit,
    });
  }

  async listEventsByProvider(
    provider: string,
    filter: {
      processing_state?: string;
      offset?: number;
      limit?: number;
    } = {}
  ): Promise<{ events: any[]; count: number }> {
    const { processing_state, offset = 0, limit = 50 } = filter;
    const where: Record<string, any> = { provider };
    if (processing_state) where.processing_state = processing_state;

    const [events, count] = await this.manager_.findAndCount(IntegrationEvent, {
      where,
      skip: offset,
      take: limit,
      orderBy: { received_at: "DESC" },
    });

    return { events, count };
  }
}

// Register DML entities with Medusa/MikroORM metadata at module load time.
(IntegrationEventService as any)[MedusaServiceModelObjectsSymbol] = MODEL_OBJECTS;
