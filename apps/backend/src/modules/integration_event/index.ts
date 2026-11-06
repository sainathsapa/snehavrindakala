import type { ModuleExports } from "@medusajs/types";
import { Module } from "@medusajs/utils";
import { IntegrationEventService } from "./service";

export const INTEGRATION_EVENT_MODULE = "integration_event";

export { IntegrationEvent } from "./entities/integration_event";
export type {
  IntegrationEventProcessingState,
} from "./entities/integration_event";
export { IntegrationEventService };

/**
 * The integration_event module. DML entities are auto-registered with
 * MikroORM via IntegrationEventService extending
 * MedusaService({ IntegrationEvent }).
 */
export const integrationEventModule: ModuleExports<typeof IntegrationEventService> =
  {
    service: IntegrationEventService,
  };

export default Module(INTEGRATION_EVENT_MODULE, { service: IntegrationEventService });
