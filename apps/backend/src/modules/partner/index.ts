import type { ModuleExports } from "@medusajs/types";
import { PartnerService } from "./service";
import { PartnerApplication } from "./models/partner_application";

export const PARTNER_MODULE = "partner";

export const partnerModule: ModuleExports<typeof PartnerService> = {
  service: PartnerService,
};

export { PartnerService, PartnerApplication };
