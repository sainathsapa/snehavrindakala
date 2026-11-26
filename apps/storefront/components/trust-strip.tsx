/**
 * The reassurance row shown on a product page and at checkout.
 *
 * Buyer anxiety peaks the moment money is about to move. These are the four
 * facts that answer it — and each is a real policy of this store, not a
 * marketing badge: works are shipped with a certificate, payment runs through
 * Razorpay, the studio reviews damage claims on approved returns, and every
 * piece is packed by the studio.
 *
 * The returns badge used to read "Easy returns", which contradicted the published
 * policy (all sales final, damage claims only, approved in writing). A store that
 * advertises easy returns and then refuses them loses the customer twice.
 */
import { Link } from "@/i18n/routing";

const ITEMS = [
  {
    label: "Certificate of authenticity",
    href: "/authenticity",
    icon: (
      <path d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.4 7.2 17.9l.9-5.4L4.2 8.7l5.4-.8L12 3z" />
    ),
  },
  {
    label: "Secure payment by Razorpay",
    icon: (
      <path d="M7 10V8a5 5 0 0110 0v2m-9 0h8a1 1 0 011 1v7a1 1 0 01-1 1H8a1 1 0 01-1-1v-7a1 1 0 011-1z" />
    ),
  },
  {
    label: "Damage claims reviewed",
    href: "/policies/returns",
    icon: <path d="M4 12a8 8 0 1014-5.3M4 4v4h4" />,
  },
  {
    label: "Packed by the studio",
    icon: <path d="M3 8l9-5 9 5v8l-9 5-9-5V8zm9-5v17M3 8l9 5 9-5" />,
  },
];

export function TrustStrip({ compact = false }: { compact?: boolean }) {
  return (
    <ul
      className={`grid gap-3 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}
    >
      {ITEMS.map((item) => {
        const content = (
          <>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              className="shrink-0 text-terracotta"
              aria-hidden="true"
            >
              <g
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {item.icon}
              </g>
            </svg>
            <span className="font-sans text-xs leading-snug text-deep-ink/80">
              {item.label}
            </span>
          </>
        );
        return (
          <li key={item.label} className="flex items-start gap-2">
            {item.href ? (
              <Link href={item.href} className="flex items-start gap-2 hover:text-kumkum">
                {content}
              </Link>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ul>
  );
}
