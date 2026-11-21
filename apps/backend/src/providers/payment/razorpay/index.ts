import { ModuleProvider, Modules } from "@medusajs/utils";
import RazorpayPaymentProvider from "./razorpay.provider";

/**
 * Registers Razorpay with Medusa's payment module.
 *
 * Medusa v2 discovers providers through `ModuleProvider(Modules.PAYMENT, …)`
 * and identifies each one by its static `identifier`, so this entry is what
 * makes `pp_razorpay_razorpay` resolvable. The old v1 factory shape
 * (`export default ({container, options}) => new Provider(...)`) is what made
 * the backend crash with "moduleProviderServices is not iterable".
 */
export const services = [RazorpayPaymentProvider];

export default ModuleProvider(Modules.PAYMENT, {
  services,
});

export { RazorpayPaymentProvider };
