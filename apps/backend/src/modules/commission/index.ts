import type { Module } from "@medusajs/framework/types";
import { CommissionService } from "./service";
import { CommissionRequest } from "./models/commission_request";

export const COMMISSION_MODULE = "commission";

export const commissionModule: Module = {
  name: COMMISSION_MODULE,
  service: CommissionService,
  models: [CommissionRequest],
};

export { CommissionService, CommissionRequest };
