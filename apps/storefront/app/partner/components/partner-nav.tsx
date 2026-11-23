"use client";

/**
 * Partner portal sidebar.
 *
 * The visible sections are filtered against the signed-in member's role using
 * the advisory RBAC matrix, so a viewer never sees finance or team links they
 * cannot use. The nav is interactive (active state + mobile toggle) so it lives
 * on the client; the role itself arrives as a prop from the server layout.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@snehavrinda-kala/ui";
import {
  partnerHasPermission,
  type PartnerPermission,
} from "@/lib/partner/rbac";
import type { PartnerRole } from "@/lib/partner/types";

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Absent means the item is available to every active member. */
  permission?: PartnerPermission;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

/**
 * Exported for pure tests. This is only an advisory map of what to *show*;
 * every target page re-checks the permission on the server against the signed
 * session, so hiding a link is never the enforcement boundary.
 */
export const NAV_GROUPS: readonly NavGroup[] = [
  {
    title: "Workspace",
    items: [
      {
        href: "/partner",
        label: "Overview",
        icon: "dashboard",
        permission: "dashboard:read",
      },
      { href: "/partner/notifications", label: "Notifications", icon: "notifications" },
      {
        href: "/partner/profile",
        label: "Business profile",
        icon: "shop",
        permission: "profile:read",
      },
    ],
  },
  {
    title: "Catalogue",
    items: [
      {
        href: "/partner/products",
        label: "Products",
        icon: "products",
        permission: "products:read",
      },
      {
        // Dedicated, read-only submission history page. The same permission as
        // /partner/products, whose server-side gate it mirrors.
        href: "/partner/submissions",
        label: "Product submissions",
        icon: "upload",
        permission: "products:read",
      },
      {
        href: "/partner/inventory",
        label: "Inventory",
        icon: "archive",
        permission: "inventory:read",
      },
    ],
  },
  {
    title: "Fulfilment",
    items: [
      {
        href: "/partner/orders",
        label: "Orders",
        icon: "orders",
        permission: "orders:read",
      },
      {
        href: "/partner/shipments",
        label: "Shipments",
        icon: "truck",
        permission: "shipments:read",
      },
      {
        href: "/partner/customers",
        label: "Customers",
        icon: "customers",
        permission: "customers:read",
      },
    ],
  },
  {
    title: "Finance",
    items: [
      {
        href: "/partner/earnings",
        label: "Earnings",
        icon: "money",
        permission: "earnings:read",
      },
      {
        href: "/partner/statements",
        label: "Commission statements",
        icon: "percent",
        permission: "statements:read",
      },
      {
        href: "/partner/settlements",
        label: "Settlements",
        icon: "credit-card",
        permission: "settlements:read",
      },
    ],
  },
  {
    title: "Account",
    items: [
      {
        href: "/partner/team",
        label: "Team",
        icon: "users",
        permission: "team:read",
      },
      {
        // Read-only account activity trail. Uses the existing `audit-log`
        // glyph from the shared icon set and the same gate as the page.
        href: "/partner/audit",
        label: "Audit trail",
        icon: "audit-log",
        permission: "profile:read",
      },
      {
        href: "/partner/security",
        label: "Security",
        icon: "lock",
        permission: "security:write",
      },
    ],
  },
];

/**
 * Pure route matcher for the sidebar's `aria-current` state.
 *
 * `usePathname()` never carries a query string, while an `href` may (and a
 * visited route may carry a trailing slash or be a nested child route), so both
 * sides are normalised before comparing. The portal root is excluded from
 * prefix matching: otherwise "Overview" would light up on every single page.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  const normalize = (value: string): string =>
    (value || "").split("?")[0].replace(/\/+$/, "") || "/";
  const current = normalize(pathname);
  const target = normalize(href);
  if (current === target) return true;
  if (target === "/partner" || target === "/") return false;
  return current.startsWith(`${target}/`);
}

/** Pure, permission-filtered view of the nav used by both desktop and mobile. */
export function visibleNavGroups(role: PartnerRole): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.permission || partnerHasPermission(role, item.permission)
    ),
  })).filter((group) => group.items.length > 0);
}

export function PartnerNav({ role }: { role: PartnerRole }) {
  const pathname = usePathname();
  // Desktop shows the sidebar; mobile starts closed so the page is visible.
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const apply = () => setCollapsed(!query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  const groups = visibleNavGroups(role);

  return (
    <>
      {collapsed && (
        <div className="fixed left-4 top-4 z-[60] md:hidden">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-expanded={false}
            aria-label="Open menu"
            className="flex items-center gap-1 rounded-md bg-sindoor px-3 py-2 text-sm font-medium text-rang-paper hover:bg-sindoor/90"
          >
            <Icon name="menu" size={18} />
            Menu
          </button>
        </div>
      )}

      {!collapsed && (
        <div
          className="fixed inset-0 z-40 bg-deep-ink/30 md:hidden"
          onClick={() => setCollapsed(true)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sand-border bg-surface transition-transform duration-300 md:translate-x-0 ${
          collapsed ? "-translate-x-full" : "translate-x-0"
        }`}
      >
        <div className="shrink-0 border-b border-sand-border px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/partner"
              onClick={() => setCollapsed(true)}
              className="flex flex-wrap items-baseline gap-x-1.5"
            >
              <span className="font-serif text-lg font-bold tracking-tight text-deep-ink">
                SnehaVrinda
              </span>
              <span className="font-serif text-lg font-bold tracking-tight text-terracotta">
                Kala
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Close menu"
              className="rounded-md p-1.5 text-muted-ink hover:bg-rang-paper hover:text-terracotta md:hidden"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          <p className="mt-1 font-sans text-xs text-muted-ink">Partner Portal</p>
        </div>

        <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="px-3 pb-1.5 font-sans text-[10px] font-semibold uppercase tracking-wider text-muted-ink/70">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = isNavItemActive(pathname, item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setCollapsed(true)}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 font-sans text-sm font-medium transition-colors ${
                        isActive
                          ? "border border-sindoor/20 bg-sindoor/10 text-sindoor"
                          : "text-muted-ink hover:bg-rang-paper/50 hover:text-terracotta"
                      }`}
                    >
                      <Icon
                        name={item.icon}
                        size={17}
                        className={isActive ? "text-sindoor" : "text-muted-ink"}
                      />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-sand-border px-5 py-3">
          <p className="font-sans text-[11px] leading-snug text-muted-ink">
            Manage your catalogue, orders and earnings in one place.
          </p>
        </div>
      </aside>
    </>
  );
}
