import type { ModuleExports } from "@medusajs/types";
import { CommissionService } from "./service";

export const COMMISSION_MODULE = "commission";

export const commissionModule: ModuleExports<typeof CommissionService> = {
  service: CommissionService,
};

export { CommissionService };
