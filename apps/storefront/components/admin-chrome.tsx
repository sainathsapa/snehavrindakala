"use client";

/**
 * Client chrome for the admin area: sidebar, mobile toggle, sign out.
 *
 * Split out of app/admin/layout.tsx so that the layout can stay a Server
 * Component and verify the session before rendering. Only the interactive parts
 * run on the client; identity is passed in as props from the server, so there
 * is no "Checking access…" flash and no pre-check HTML.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { Icon, type IconName } from "@snehavrinda-kala/ui";
import { NotificationBell } from "@/components/notification-bell";

type Role = "super_admin" | "manager" | "support" | "viewer";

const NAV_ITEMS: { href: string; label: string; icon: IconName; role: Role }[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard", role: "viewer" },
  { href: "/admin/orders", label: "Orders", icon: "orders", role: "viewer" },
  { href: "/admin/products", label: "Products", icon: "products", role: "viewer" },
  {
    href: "/admin/categories",
    label: "Categories",
    icon: "categories",
    role: "viewer",
  },
  {
    href: "/admin/customers",
    label: "Customers",
    icon: "customers",
    role: "viewer",
  },
  { href: "/admin/partners", label: "Partners", icon: "partners", role: "viewer" },
  {
    href: "/admin/tickets",
    label: "Support Tickets",
    icon: "tickets",
    role: "viewer",
  },
  { href: "/admin/users", label: "Users & Roles", icon: "users", role: "super_admin" },
  { href: "/admin/settings", label: "Settings", icon: "settings", role: "super_admin" },
  { href: "/admin/analytics", label: "Analytics", icon: "analytics", role: "viewer" },
  { href: "/admin/discounts", label: "Discounts", icon: "discounts", role: "manager" },
  {
    href: "/admin/commissions",
    label: "Commissions",
    icon: "commissions",
    role: "manager",
  },
  { href: "/admin/tax", label: "Tax (GST)", icon: "tax", role: "manager" },
  { href: "/admin/audit-log", label: "Audit Log", icon: "audit-log", role: "super_admin" },
  {
    href: "/admin/notifications",
    label: "Notifications",
    icon: "notifications",
    role: "manager",
  },
];

const ROLE_ORDER: Record<string, number> = {
  super_admin: 4,
  manager: 3,
  support: 2,
  viewer: 1,
};

function canAccess(userRole: string, required: Role): boolean {
  return (ROLE_ORDER[userRole] ?? 0) >= (ROLE_ORDER[required] ?? 0);
}

export function AdminChrome({
  email,
  role,
  children,
}: {
  email: string;
  role: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  // The login page lives under /admin but must not show the shell.
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const visibleItems = NAV_ITEMS.filter((item) =>
    canAccess(role, item.role)
  );

  return (
    <div className="relative min-h-screen bg-rang-paper">
      <div className="fixed left-4 top-4 z-60 md:hidden">
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Open menu" : "Close menu"}
          className="rounded-md bg-sindoor px-4 py-3 font-medium text-rang-paper hover:bg-sindoor/90"
        >
          <Icon name={collapsed ? "menu" : "close"} size={20} className="mr-1" />
          {collapsed ? "Menu" : "Close"}
        </button>
      </div>

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sand-border bg-surface transition-transform duration-300 ${
          collapsed ? "-translate-x-full" : "translate-x-0"
        }`}
      >
        <div className="shrink-0 border-b border-sand-border p-6">
          <div className="flex items-start justify-between gap-2">
            <Link href="/admin" className="flex items-center gap-2">
              <span className="font-serif text-xl font-bold tracking-tight text-deep-ink">
                SnehaVrinda
              </span>
              <span className="font-serif text-xl font-bold tracking-tight text-terracotta">
                Kala
              </span>
            </Link>
            <NotificationBell
              audience={role === "super_admin" ? "admin" : role}
            />
          </div>
          <p className="mt-2 font-sans text-xs text-muted-ink">Admin Panel</p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {visibleItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setCollapsed(false)}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 font-sans text-sm font-medium transition-colors ${
                  isActive
                    ? "border border-sindoor/20 bg-sindoor/10 text-sindoor"
                    : "text-muted-ink hover:bg-rang-paper/50 hover:text-terracotta"
                }`}
              >
                <Icon
                  name={item.icon}
                  size={18}
                  className={isActive ? "text-sindoor" : "text-muted-ink"}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-sand-border p-6">
          <div className="font-sans text-xs text-muted-ink">
            <div className="font-medium text-deep-ink">{email}</div>
            <div className="font-medium capitalize text-terracotta">{role}</div>
          </div>
          <button
            onClick={() => router.push("/admin/logout")}
            className="mt-4 w-full rounded-md border border-sindoor px-4 py-2 text-sm font-medium text-sindoor transition-colors hover:bg-sindoor hover:text-rang-paper"
          >
            Sign Out
          </button>
        </div>
      </aside>

      <main
        className={`min-h-0 transition-all duration-300 md:pl-64 ${
          collapsed ? "md:pl-0" : ""
        }`}
      >
        <Suspense
          fallback={<div className="p-8 font-sans text-muted-ink">Loading…</div>}
        >
          {children}
        </Suspense>
      </main>
    </div>
  );
}
