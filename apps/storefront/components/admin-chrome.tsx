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
import { Suspense, useEffect, useState } from "react";
import { Icon, type IconName } from "@snehavrinda-kala/ui";
import { NotificationBell } from "@/components/notification-bell";

type Role = "super_admin" | "manager" | "support" | "viewer";

const NAV_ITEMS: { href: string; label: string; icon: IconName; role: Role }[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard", role: "viewer" },
  // Storefront content sits right under the dashboard: it is the most-used
  // editing surface and drives the public homepage.
  {
    href: "/admin/content",
    label: "Storefront",
    icon: "view",
    role: "manager",
  },
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
  platformMode = "single-brand",
  children,
}: {
  email: string;
  role: string;
  platformMode?: "platform" | "single-brand";
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  // Desktop shows the sidebar; mobile starts closed so the page is visible
  // and the floating Menu button appears. Starting open on a phone covered
  // the whole screen before anyone asked for navigation.
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const apply = () => setCollapsed(!query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  // The login page lives under /admin but must not show the shell.
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!canAccess(role, item.role)) return false;
    // Partner management is meaningless when we are the seller.
    if (item.href === "/admin/partners" && platformMode !== "platform") {
      return false;
    }
    return true;
  });

  return (
    <div className="relative min-h-screen bg-rang-paper">
      {/* Floating menu button, shown only while the sidebar is closed. Once
          open, the sidebar's own close button takes over — a fixed overlay
          button here would sit on top of the brand. `z-[60]` keeps it above
          the sidebar (z-50); a literal `z-60` is not a Tailwind class and
          rendered underneath, leaving the menu impossible to open. */}
      {collapsed && (
        <div className="fixed left-4 top-4 z-[60] md:hidden">
          <button
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

      {/* Dim the page behind the mobile sidebar so it does not compete with
          the nav, and give tapping outside an obvious way to close it. */}
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
            <Link href="/admin" className="flex items-center gap-1.5">
              <span className="font-serif text-lg font-bold tracking-tight text-deep-ink">
                SnehaVrinda
              </span>
              <span className="font-serif text-lg font-bold tracking-tight text-terracotta">
                Kala
              </span>
            </Link>
            <NotificationBell
              audience={role === "super_admin" ? "admin" : role}
            />
            <button
              onClick={() => setCollapsed(true)}
              aria-label="Close menu"
              className="rounded-md p-1.5 text-muted-ink hover:bg-rang-paper hover:text-terracotta md:hidden"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          <p className="mt-1 font-sans text-xs text-muted-ink">Admin Panel</p>
        </div>

        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
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
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-sans text-sm font-medium transition-colors ${
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

        <div className="shrink-0 border-t border-sand-border px-5 py-4">
          <div className="font-sans text-xs text-muted-ink">
            <div className="font-medium text-deep-ink">{email}</div>
            <div className="font-medium capitalize text-terracotta">{role}</div>
          </div>
          <button
            onClick={() => router.push("/admin/logout")}
            className="mt-3 w-full rounded-md border border-sindoor px-4 py-1.5 text-sm font-medium text-sindoor transition-colors hover:bg-sindoor hover:text-rang-paper"
          >
            Sign Out
          </button>
        </div>
      </aside>

      <main
        className={`min-h-0 pt-16 transition-all duration-300 md:pl-64 md:pt-0`}
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
