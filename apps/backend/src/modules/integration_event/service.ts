import { IntegrationEvent } from "./entities/integration_event";
import type { CreateIntegrationEventInput } from "./types";

export class IntegrationEventService {
  protected readonly manager_: any;

  constructor({ manager }: { manager: any }) {
    this.manager_ = manager;
  }

  async recordEvent(data: CreateIntegrationEventInput): Promise<IntegrationEvent> {
    const existing = await this.manager_.findOne(IntegrationEvent, {
      provider: data.provider,
      event_id: data.event_id,
    });
    if (existing) {
      return existing;
    }

    const event = new IntegrationEvent(data);
    return this.manager_.persistAndFlush(event);
  }

  async getEvent(id: string): Promise<IntegrationEvent | null> {
    return this.manager_.findOne(IntegrationEvent, { id });
  }

  async getEventByProviderAndId(
    provider: string,
    eventId: string
  ): Promise<IntegrationEvent | null> {
    return this.manager_.findOne(IntegrationEvent, { provider, event_id: eventId });
  }

  async markProcessing(id: string): Promise<IntegrationEvent> {
    const event = await this.manager_.findOne(IntegrationEvent, { id });
    if (!event) {
      throw new Error(`Integration event ${id} not found`);
    }
    event.processing_state = "processing";
    event.attempt_count = (event.attempt_count || 0) + 1;
    return this.manager_.persistAndFlush(event);
  }

  async markProcessed(id: string): Promise<IntegrationEvent> {
    const event = await this.manager_.findOne(IntegrationEvent, { id });
    if (!event) {
      throw new Error(`Integration event ${id} not found`);
    }
    event.processing_state = "processed";
    event.processed_at = new Date();
    return this.manager_.persistAndFlush(event);
  }

  async markFailed(id: string, error: string): Promise<IntegrationEvent> {
    const event = await this.manager_.findOne(IntegrationEvent, { id });
    if (!event) {
      throw new Error(`Integration event ${id} not found`);
    }
    event.processing_state = "failed";
    event.last_error = error;
    return this.manager_.persistAndFlush(event);
  }

  async markDeadLetter(id: string): Promise<IntegrationEvent> {
    const event = await this.manager_.findOne(IntegrationEvent, { id });
    if (!event) {
      throw new Error(`Integration event ${id} not found`);
    }
    event.processing_state = "dead_letter";
    return this.manager_.persistAndFlush(event);
  }

  async listFailedEvents(limit: number = 50): Promise<IntegrationEvent[]> {
    return this.manager_.find(IntegrationEvent, {
      processing_state: "failed",
    }, { orderBy: { updated_at: "ASC" }, take: limit });
  }

  async listEventsByProvider(
    provider: string,
    filter: {
      processing_state?: string;
      offset?: number;
      limit?: number;
    } = {}
  ): Promise<{ events: IntegrationEvent[]; count: number }> {
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
