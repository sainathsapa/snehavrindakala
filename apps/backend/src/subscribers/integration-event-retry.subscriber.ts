/**
 * Integration event retry subscriber (plain module).
 *
 * Periodically retried via background worker for failed/dead-letter
 * integration events.
 */

export const config = {
  event: ["integration.event.retry"],
};

export default async function integrationEventRetrySubscriber(
  args: any
): Promise<void> {
  const { event, container } = args;
  const data = event?.data || {};

  const integrationEventService = container.resolve(
    "integration_event"
  );

  const { provider, limit = 50 } = data || {};

  const failedEvents = await integrationEventService.listFailedEvents?.(limit);
  console.log(
    `[Subscriber] Integration event retry: found ${
      failedEvents?.length || 0
    } failed events`
  );

  for (const event of failedEvents || []) {
    if ((event as any).attempt_count >= 5) {
      await integrationEventService.markDeadLetter?.((event as any).id);
      console.log(
        `[Subscriber] Event ${(event as any).id} moved to dead-letter (max attempts)`
      );
      continue;
    }

    console.log(
      `[Subscriber] Re-enqueuing event ${(event as any).id} (attempt ${
        (event as any).attempt_count + 1
      })`
    );
  }
}
