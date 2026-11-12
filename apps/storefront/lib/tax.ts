/**
 * GST breakdown shared by the checkout UI, the payment session route, and the
 * tax API. Kept dependency-free so it can run on the server and in the browser.
 */

export const DEFAULT_GST_RATE = 5;
export const DEFAULT_HOME_STATE = "Karnataka";
export const TREAT_AS_INTER_STATE = false;

export interface TaxBreakdown {
  taxable_amount: number;
  gst_rate: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_tax: number;
  total: number;
  is_inter_state: boolean;
}

function round(value: number): number {
  return Math.round(value);
}

/** Normalise free-text state input ("karnataka", "KA", " Karnataka ") */
export function normaliseState(value?: string | null): string {
  return String(value || "")
    .trim()
    .toLowerCase();
}

/**
 * Prices in the catalogue are GST-inclusive, so the tax is extracted from the
 * gross amount rather than added on top of it.
 *
 * @param amountInPaise gross (tax-inclusive) amount
 * @param state customer state, used only to decide CGST+SGST vs IGST
 */
export function calculateTax(
  amountInPaise: number,
  state?: string | null,
  options: { gstRate?: number; homeState?: string } = {}
): TaxBreakdown {
  const gstRate = options.gstRate ?? DEFAULT_GST_RATE;
  const homeState = options.homeState ?? DEFAULT_HOME_STATE;

  const gross = Number.isFinite(amountInPaise) ? Math.max(0, amountInPaise) : 0;
  const totalTax = round((gross * gstRate) / (100 + gstRate));
  const taxable = gross - totalTax;

  const customerState = normaliseState(state);
  const isInterState =
    TREAT_AS_INTER_STATE ||
    (customerState.length > 0 && customerState !== normaliseState(homeState));

  return {
    taxable_amount: taxable,
    gst_rate: gstRate,
    cgst: isInterState ? 0 : round(totalTax / 2),
    sgst: isInterState ? 0 : totalTax - round(totalTax / 2),
    igst: isInterState ? totalTax : 0,
    total_tax: totalTax,
    total: gross,
    is_inter_state: isInterState,
  };
}

/** Human label for the tax line in a summary, e.g. "CGST 2.5% + SGST 2.5%". */
export function taxLabel(breakdown: TaxBreakdown): string {
  const half = breakdown.gst_rate / 2;
  return breakdown.is_inter_state
    ? `IGST ${breakdown.gst_rate}%`
    : `CGST ${half}% + SGST ${half}%`;
}
