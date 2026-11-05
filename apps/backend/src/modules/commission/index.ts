import type { ModuleExports } from "@medusajs/types";
import { CommissionService } from "./service";
import { CommissionRequest } from "./models/commission_request";

export const COMMISSION_MODULE = "commission";

export const commissionModule: ModuleExports<typeof CommissionService> = {
  service: CommissionService,
};

export { CommissionService, CommissionRequest };
