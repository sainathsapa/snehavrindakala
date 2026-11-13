import type { ReactNode, SVGProps } from "react";

/**
 * Icon set for the storefront and admin panel.
 *
 * Every path here is hand-checked 24x24 geometry on a stroked grid: shapes are
 * closed where they should be, coordinates stay inside the viewBox, and each
 * name describes what is actually drawn. The previous set had paths copied out
 * of unrelated icon families — several overflowed the canvas (values like 895
 * and 126) and others drew nothing recognisable, so a nav label and its glyph
 * disagreed.
 *
 * Icons inherit `currentColor` and take their size from the `size` prop, so
 * they follow text colour and never need per-usage styling.
 */

export type IconName =
  | "dashboard"
  | "orders"
  | "products"
  | "categories"
  | "customers"
  | "partners"
  | "tickets"
  | "users"
  | "settings"
  | "analytics"
  | "discounts"
  | "commissions"
  | "tax"
  | "audit-log"
  | "notifications"
  | "menu"
  | "close"
  | "logout"
  | "search"
  | "filter"
  | "edit"
  | "delete"
  | "view"
  | "add"
  | "save"
  | "cancel"
  | "archive"
  | "clock"
  | "user"
  | "mail"
  | "phone"
  | "home"
  | "shop"
  | "store"
  | "palette"
  | "cart"
  | "journal"
  | "star"
  | "heart"
  | "lock"
  | "unlock"
  | "chevron-left"
  | "chevron-right"
  | "chevron-down"
  | "plus"
  | "minus"
  | "check"
  | "x"
  | "external-link"
  | "print"
  | "download"
  | "upload"
  | "link"
  | "calendar"
  | "tag"
  | "percent"
  | "money"
  | "truck"
  | "credit-card"
  | "shield"
  | "info"
  | "alert"
  | "success";

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number | string;
  className?: string;
}

/** A stroked 24x24 SVG. Children are the paths for one icon. */
function Svg({
  children,
  ...props
}: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

const ICONS: Record<IconName, (props: SVGProps<SVGSVGElement>) => ReactNode> = {
  /* ---- navigation ---- */
  dashboard: (props) => (
    <Svg {...props}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </Svg>
  ),
  orders: (props) => (
    <Svg {...props}>
      <path d="M6 2h12a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </Svg>
  ),
  products: (props) => (
    <Svg {...props}>
      <path d="M12 3 3 7.5v9L12 21l9-4.5v-9L12 3z" />
      <path d="M3 7.5 12 12l9-4.5" />
      <path d="M12 12v9" />
    </Svg>
  ),
  categories: (props) => (
    <Svg {...props}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </Svg>
  ),
  customers: (props) => (
    <Svg {...props}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 5.5a3.5 3.5 0 0 1 0 7" />
      <path d="M17.5 14.2A6 6 0 0 1 21 20" />
    </Svg>
  ),
  partners: (props) => (
    <Svg {...props}>
      <circle cx="8" cy="9" r="3" />
      <circle cx="17" cy="7" r="2.5" />
      <path d="M2.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M14.5 19a4.5 4.5 0 0 1 7 0" />
    </Svg>
  ),
  tickets: (props) => (
    <Svg {...props}>
      <path d="M3 9V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a2.5 2.5 0 0 0 0 6v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a2.5 2.5 0 0 0 0-6z" />
      <path d="M14 8v1M14 12v1M14 16v1" />
    </Svg>
  ),
  users: (props) => (
    <Svg {...props}>
      <circle cx="12" cy="7" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </Svg>
  ),
  settings: (props) => (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.3 4.3l1.6 1.6M18.1 18.1l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.3 19.7l1.6-1.6M18.1 5.9l1.6-1.6" />
    </Svg>
  ),
  analytics: (props) => (
    <Svg {...props}>
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <path d="M7 15l4-5 3 3 5-7" />
    </Svg>
  ),
  discounts: (props) => (
    <Svg {...props}>
      <path d="M20.6 12.6 12.6 20.6a2 2 0 0 1-2.8 0L3.4 14.2a2 2 0 0 1-.6-1.6l.5-7.1a2 2 0 0 1 1.9-1.9l7.1-.5a2 2 0 0 1 1.6.6l6.4 6.4a2 2 0 0 1 0 2.9z" />
      <circle cx="8.5" cy="8.5" r="1.5" />
    </Svg>
  ),
  commissions: (props) => (
    <Svg {...props}>
      {/* A handshake: an agreed bespoke piece between two parties. */}
      <path d="M2.5 12.5 6 9l3.5 3" />
      <path d="M21.5 12.5 18 9l-3.5 3" />
      <path d="M6 9.5 9.5 6l5 0L18 9.5" />
      <path d="M9.5 15.5 12 13l2.5 2.5" />
      <path d="M8 13.5 9.5 15l1.5-1.5" />
    </Svg>
  ),
  tax: (props) => (
    <Svg {...props}>
      <circle cx="8" cy="8" r="2" />
      <circle cx="16" cy="16" r="2" />
      <path d="M19 5 5 19" />
    </Svg>
  ),
  "audit-log": (props) => (
    <Svg {...props}>
      <path d="M14 2H6a1 1 0 0 0-1 1v18a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7l-5-5z" />
      <path d="M14 2v5h5" />
      <path d="M8 13h8M8 17h5" />
    </Svg>
  ),
  notifications: (props) => (
    <Svg {...props}>
      <path d="M18 8a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
      <path d="M10.3 21a2 2 0 0 0 3.4 0" />
    </Svg>
  ),

  /* ---- chrome ---- */
  menu: (props) => (
    <Svg {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Svg>
  ),
  close: (props) => (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  ),
  logout: (props) => (
    <Svg {...props}>
      <path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </Svg>
  ),
  search: (props) => (
    <Svg {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 21 21" />
    </Svg>
  ),
  filter: (props) => (
    <Svg {...props}>
      <path d="M3 5h18l-7 8v6l-4 2v-8L3 5z" />
    </Svg>
  ),

  /* ---- actions ---- */
  edit: (props) => (
    <Svg {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </Svg>
  ),
  delete: (props) => (
    <Svg {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
      <path d="M10 11v6M14 11v6" />
    </Svg>
  ),
  view: (props) => (
    <Svg {...props}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  ),
  add: (props) => (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  ),
  save: (props) => (
    <Svg {...props}>
      <path d="M19 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h11l4 4v13a1 1 0 0 1-1 1z" />
      <path d="M8 3v6h7V3" />
      <rect x="8" y="13" width="8" height="8" rx="1" />
    </Svg>
  ),
  cancel: (props) => (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </Svg>
  ),
  archive: (props) => (
    <Svg {...props}>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      <path d="M10 12h4" />
    </Svg>
  ),
  clock: (props) => (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </Svg>
  ),

  /* ---- people & contact ---- */
  user: (props) => (
    <Svg {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </Svg>
  ),
  mail: (props) => (
    <Svg {...props}>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </Svg>
  ),
  phone: (props) => (
    <Svg {...props}>
      <path d="M21 16.9v2.6a2 2 0 0 1-2.2 2 19.5 19.5 0 0 1-8.5-3 19 19 0 0 1-5.9-5.9 19.5 19.5 0 0 1-3-8.6A2 2 0 0 1 3.4 2H6a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L7.1 9.9a15.5 15.5 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.4c1 .3 1.9.6 2.9.7a2 2 0 0 1 1.7 2z" />
    </Svg>
  ),

  /* ---- commerce ---- */
  home: (props) => (
    <Svg {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
      <path d="M10 21v-6h4v6" />
    </Svg>
  ),
  shop: (props) => (
    <Svg {...props}>
      <path d="M3 9h18l-1.5 11a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1L3 9z" />
      <path d="M8 9V6a4 4 0 0 1 8 0v3" />
    </Svg>
  ),
  // Awning over a doorway — a seller's stall. Used for "Sell".
  store: (props) => (
    <Svg {...props}>
      <path d="M4 9h16l-1 3.5a2.5 2.5 0 0 1-2.4 1.8H7.4A2.5 2.5 0 0 1 5 12.5L4 9z" />
      <path d="M5.5 14.3V20h13v-5.7" />
      <path d="M9.5 20v-3.5h5V20" />
      <path d="M4 9l1.2-4.5h13.6L20 9" />
    </Svg>
  ),
  // An artist's palette with a thumb hole and three wells. Used for artwork.
  palette: (props) => (
    <Svg {...props}>
      <path d="M12 3.2a8.8 8.8 0 0 0 0 17.6c1.2 0 2-.9 2-2 0-.7-.3-1.2-.7-1.7-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8h1.9A5.6 5.6 0 0 0 22 8.4C21.4 5.3 17.2 3.2 12 3.2z" />
      <circle cx="8" cy="9" r="1" />
      <circle cx="12.4" cy="7.4" r="1" />
      <circle cx="16.2" cy="9.6" r="1" />
    </Svg>
  ),
  // Shopping bag with a handle — the header's bag affordance.
  cart: (props) => (
    <Svg {...props}>
      <path d="M4.5 8h15l-1 12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1L4.5 8z" />
      <path d="M8.5 8V5.5a3.5 3.5 0 0 1 7 0V8" />
    </Svg>
  ),
  journal: (props) => (
    <Svg {...props}>
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22V4.5z" />
      <path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20" />
      <path d="M8 7h8M8 11h5" />
    </Svg>
  ),
  star: (props) => (
    <Svg {...props}>
      <path d="m12 3 2.8 5.9 6.2.8-4.5 4.5 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.7l6.2-.8L12 3z" />
    </Svg>
  ),
  heart: (props) => (
    <Svg {...props}>
      <path d="M12 20s-7.5-4.7-7.5-9.6A4.4 4.4 0 0 1 12 7.4a4.4 4.4 0 0 1 7.5 3C19.5 15.3 12 20 12 20z" />
    </Svg>
  ),
  lock: (props) => (
    <Svg {...props}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </Svg>
  ),
  unlock: (props) => (
    <Svg {...props}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 7.5-2" />
    </Svg>
  ),

  /* ---- chevrons & maths ---- */
  "chevron-left": (props) => (
    <Svg {...props}>
      <path d="M15 5l-7 7 7 7" />
    </Svg>
  ),
  "chevron-right": (props) => (
    <Svg {...props}>
      <path d="M9 5l7 7-7 7" />
    </Svg>
  ),
  "chevron-down": (props) => (
    <Svg {...props}>
      <path d="M5 9l7 7 7-7" />
    </Svg>
  ),
  plus: (props) => (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  ),
  minus: (props) => (
    <Svg {...props}>
      <path d="M5 12h14" />
    </Svg>
  ),
  check: (props) => (
    <Svg {...props}>
      <path d="M4 12.5 9.5 18 20 6.5" />
    </Svg>
  ),
  x: (props) => (
    <Svg {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  ),
  "external-link": (props) => (
    <Svg {...props}>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </Svg>
  ),

  /* ---- files & data ---- */
  print: (props) => (
    <Svg {...props}>
      <path d="M7 8V3h10v5" />
      <rect x="3" y="8" width="18" height="8" rx="2" />
      <path d="M7 16h10v5H7z" />
    </Svg>
  ),
  download: (props) => (
    <Svg {...props}>
      <path d="M12 3v12" />
      <path d="M7 10.5 12 15l5-4.5" />
      <path d="M4 19h16" />
    </Svg>
  ),
  upload: (props) => (
    <Svg {...props}>
      <path d="M12 16V4" />
      <path d="M7 8.5 12 4l5 4.5" />
      <path d="M4 20h16" />
    </Svg>
  ),
  link: (props) => (
    <Svg {...props}>
      <path d="M10 13a4 4 0 0 0 5.7 0l2.6-2.6a4 4 0 0 0-5.7-5.7L11.5 6" />
      <path d="M14 11a4 4 0 0 0-5.7 0l-2.6 2.6a4 4 0 0 0 5.7 5.7L12.5 18" />
    </Svg>
  ),
  calendar: (props) => (
    <Svg {...props}>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M3.5 10h17" />
      <path d="M8 3v4M16 3v4" />
    </Svg>
  ),
  tag: (props) => (
    <Svg {...props}>
      <path d="M4 12.6 12.6 4H20v7.4L11.4 20z" />
      <circle cx="16" cy="8" r="1.4" />
    </Svg>
  ),
  percent: (props) => (
    <Svg {...props}>
      <circle cx="7.5" cy="7.5" r="2.5" />
      <circle cx="16.5" cy="16.5" r="2.5" />
      <path d="M19 5 5 19" />
    </Svg>
  ),
  money: (props) => (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12h7" />
      <path d="M12 8c-1.4 0-2.2.7-2.2 1.6 0 1.9 4.4 1.1 4.4 3.1 0 1-1 1.7-2.2 1.7" />
    </Svg>
  ),
  truck: (props) => (
    <Svg {...props}>
      <path d="M2.5 7.5h10v9h-10z" />
      <path d="M12.5 11h4l3 3v2.5h-7" />
      <circle cx="6.5" cy="18.5" r="1.8" />
      <circle cx="16.5" cy="18.5" r="1.8" />
    </Svg>
  ),
  "credit-card": (props) => (
    <Svg {...props}>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 10h19" />
      <path d="M6 15h3" />
    </Svg>
  ),

  /* ---- status ---- */
  shield: (props) => (
    <Svg {...props}>
      <path d="M12 2.5 20 5.5v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6l8-3z" />
      <path d="M9 12l2 2 4-4" />
    </Svg>
  ),
  info: (props) => (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </Svg>
  ),
  alert: (props) => (
    <Svg {...props}>
      <path d="M12 3.5 21.5 20H2.5L12 3.5z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </Svg>
  ),
  success: (props) => (
    <Svg {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5 11 15.5 16.5 9" />
    </Svg>
  ),
};

export function Icon({ name, size = 20, className, ...props }: IconProps) {
  const Comp = ICONS[name];
  if (!Comp) return null;

  return (
    <Comp
      {...props}
      width={size}
      height={size}
      className={className}
    />
  );
}
