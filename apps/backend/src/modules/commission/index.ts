import type { ModuleExports } from "@medusajs/types";
import { Module } from "@medusajs/utils";
import { CommissionService } from "./service";

export const COMMISSION_MODULE = "commission";

export { CommissionService };

/**
 * The commission module. DML entities are auto-registered with MikroORM via
 * CommissionService extending MedusaService({ CommissionRequest, ... }).
 */
export const commissionModule: ModuleExports<typeof CommissionService> = {
  service: CommissionService,
};

export default Module(COMMISSION_MODULE, { service: CommissionService });
