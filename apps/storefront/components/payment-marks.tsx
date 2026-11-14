/**
 * The payment methods this store actually accepts.
 *
 * Drawn as type rather than as downloaded card logos on purpose. Visa and
 * Mastercard both restrict reproduction of their marks to approved artwork, and
 * a hand-copied logo reads as counterfeit on the one part of the page that is
 * supposed to signal safety. Plain wordmarks next to a padlock say the same
 * thing without misrepresenting anyone's trademark.
 *
 * Every entry here is a method the Razorpay integration can settle, so the row
 * is a statement about this shop, not generic filler.
 */

const METHODS = [
  { id: "visa", label: "Visa" },
  { id: "mastercard", label: "Mastercard" },
  { id: "rupay", label: "RuPay" },
  { id: "upi", label: "UPI" },
  { id: "gpay", label: "Google Pay" },
  { id: "paytm", label: "Paytm" },
  { id: "netbanking", label: "Net banking" },
];

export function PaymentMarks({ dense = false }: { dense?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
      <span className="inline-flex items-center gap-1 font-sans text-[9px] font-semibold uppercase tracking-[0.18em] text-haldi/85">
        {/* A small drawn padlock — the one mark that is ours to draw. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 12 14"
          className="h-3 w-3 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        >
          <rect x="1.5" y="6" width="9" height="7" rx="1.2" />
          <path d="M3.5 6V4.2a2.5 2.5 0 0 1 5 0V6" strokeLinecap="round" />
        </svg>
        Secure
      </span>
      <ul
        aria-label="Payment methods accepted"
        className={
          dense
            ? "flex flex-wrap items-center gap-x-1.5 gap-y-1"
            : "flex flex-wrap items-center gap-x-1.5 gap-y-1"
        }
      >
        {METHODS.map((method) => (
          <li
            key={method.id}
            className="rounded-[3px] border border-rang-paper/20 px-1.5 py-0.5 font-sans text-[9px] font-medium uppercase tracking-[0.06em] text-rang-paper/60"
          >
            {method.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
