/**
 * Reads the GST configuration from the environment (with sane defaults).
 */

import {
  DEFAULT_GST_RATE,
  DEFAULT_HOME_STATE,
  type TaxBreakdown,
  calculateTax,
  taxLabel,
} from "./tax";

export function getSellerHomeState(): string {
  return process.env.SELLER_HOME_STATE || DEFAULT_HOME_STATE;
}

export function getGstRate(): number {
  const rate = Number(process.env.GST_RATE);
  return Number.isFinite(rate) && rate >= 0 ? rate : DEFAULT_GST_RATE;
}

/** Tax breakdown for a GST-inclusive amount in paise. */
export function taxForAmount(
  amountInPaise: number,
  state?: string | null
): TaxBreakdown {
  return calculateTax(amountInPaise, state, {
    gstRate: getGstRate(),
    homeState: getSellerHomeState(),
  });
}

export { taxLabel };
export type { TaxBreakdown };
