import { ModuleProvider, Modules } from "@medusajs/utils";
import ShiprocketFulfilmentProvider from "./shiprocket.provider";

/**
 * Registers Shiprocket with Medusa's fulfilment module, which is what makes
 * `fp_shiprocket_shiprocket` resolvable in the admin's shipping options.
 *
 * The v1 factory shape this replaces is why Medusa v2 could not load the
 * provider and the shop shipped on `manual_manual`.
 */
export const services = [ShiprocketFulfilmentProvider];

export default ModuleProvider(Modules.FULFILLMENT, {
  services,
});

export { ShiprocketFulfilmentProvider };
