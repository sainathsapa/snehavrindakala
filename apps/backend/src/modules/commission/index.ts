import type { ModuleExports } from "@medusajs/types";
import { Module } from "@medusajs/utils";
import { CommissionService } from "./service";

export const COMMISSION_MODULE = "commission";

export const commissionModule: ModuleExports<typeof CommissionService> = {
  service: CommissionService,
};

export { CommissionService };


export default Module(COMMISSION_MODULE, { service: CommissionService });
