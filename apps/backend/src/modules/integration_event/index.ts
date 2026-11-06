import type { ModuleExports } from "@medusajs/types";
import { Module } from "@medusajs/utils";
import { IntegrationEventService } from "./service";

export const INTEGRATION_EVENT_MODULE = "integration_event";

export const integrationEventModule: ModuleExports<typeof IntegrationEventService> = {
  service: IntegrationEventService,
};

export { IntegrationEventService };


export default Module(INTEGRATION_EVENT_MODULE, { service: IntegrationEventService });
