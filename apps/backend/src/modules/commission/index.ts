import type { ModuleExports } from "@medusajs/types";
import { Module } from "@medusajs/utils";
import { CommissionService } from "./service";

export const COMMISSION_MODULE = "commission";

export { CommissionService };

/**
 * The commission module.
 *
 * `event_bus` is injected so the service can emit `commission.request.created`
 * and `commission.status.transitioned`. The subscribers in
 * src/subscribers/commission.subscriber.ts have always listened for those
 * names, but nothing emitted them, so no commission notification was ever
 * delivered. Injection is optional: without it the service logs and carries on
 * rather than failing a write.
 */
export const commissionModule: ModuleExports<typeof CommissionService> = {
  service: CommissionService,
};

export default Module(COMMISSION_MODULE, {
  service: CommissionService,
});
