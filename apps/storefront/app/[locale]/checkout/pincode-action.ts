"use server";

import { lookupPincode, type PincodeResult } from "@/lib/shipping/pincode";

/**
 * Server action behind the PIN-code autofill.
 *
 * Kept separate from `lib/` because the India Post lookup must run on the
 * server: the browser gets a same-origin call and the third-party URL never
 * appears in the client bundle.
 */
export async function lookupPincodeAction(
  pincode: string
): Promise<PincodeResult | null> {
  return lookupPincode(pincode);
}
