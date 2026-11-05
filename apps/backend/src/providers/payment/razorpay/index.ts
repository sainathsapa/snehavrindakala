import { RazorpayPaymentProvider } from "./razorpay.provider";

export default async function razorpayProvider({
  container,
  options,
}: any) {
  return new RazorpayPaymentProvider(container, options);
}

export { RazorpayPaymentProvider };
