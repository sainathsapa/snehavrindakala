import type { ModuleExports } from "@medusajs/types";
import { IntegrationEventService } from "./service";

export const INTEGRATION_EVENT_MODULE = "integration_event";

export const integrationEventModule: ModuleExports<typeof IntegrationEventService> = {
  service: IntegrationEventService,
};

export { IntegrationEventService };
