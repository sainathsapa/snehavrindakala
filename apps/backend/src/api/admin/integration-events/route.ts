import type { MedusaRequest, MedusaResponse } from "@medusajs/types";
import type { IntegrationEventService } from "../../../modules/integration_event/service";

/**
 * GET /admin/integration-events
 * List integration events (operations exception inbox).
 */
async function GET(req: MedusaRequest, res: MedusaResponse) {
  const integrationEventService = req.scope.resolve(
    "integration_event"
  ) as IntegrationEventService;

  const { provider, processing_state, offset, limit } = req.query as unknown as {
    provider?: string;
    processing_state?: string;
    offset?: string;
    limit?: string;
  };

  const { events, count } = await integrationEventService.listEventsByProvider(
    provider || "razorpay",
    {
      processing_state,
      offset: offset ? Number(offset) : 0,
      limit: limit ? Number(limit) : 50,
    }
  );

  return res.status(200).json({
    integration_events: events,
    count,
    offset: Number(offset) || 0,
    limit: Number(limit) || 50,
  });
}

export { GET };
