import type { Module } from "@medusajs/framework/types";
import { PartnerService } from "./service";
import { PartnerApplication } from "./models/partner_application";

export const PARTNER_MODULE = "partner";

export const partnerModule: Module = {
  name: PARTNER_MODULE,
  service: PartnerService,
  models: [PartnerApplication],
};

export { PartnerService, PartnerApplication };
