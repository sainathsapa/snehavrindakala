"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: "📊", role: "viewer" as const },
  { href: "/admin/orders", label: "Orders", icon: "📦", role: "viewer" as const },
  {
    href: "/admin/products",
    label: "Products",
    icon: "🎨",
    role: "viewer" as const,
  },
  {
    href: "/admin/categories",
    label: "Categories",
    icon: "📁",
    role: "viewer" as const,
  },
  {
    href: "/admin/customers",
    label: "Customers",
    icon: "👥",
    role: "viewer" as const,
  },
  {
    href: "/admin/partners",
    label: "Partners",
    icon: "👩‍🎨",
    role: "viewer" as const,
  },
  {
    href: "/admin/tickets",
    label: "Support Tickets",
    icon: "🎫",
    role: "viewer" as const,
  },
  {
    href: "/admin/users",
    label: "Users & Roles",
    icon: "🔐",
    role: "super_admin" as const,
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: "⚙️",
    role: "super_admin" as const,
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    icon: "📈",
    role: "viewer" as const,
  },
  {
    href: "/admin/discounts",
    label: "Discounts",
    icon: "🏷️",
    role: "manager" as const,
  },
  {
    href: "/admin/commissions",
    label: "Commissions",
    icon: "💸",
    role: "manager" as const,
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: "⚙️",
    role: "super_admin" as const,
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    icon: "📈",
    role: "viewer" as const,
  },
  {
    href: "/admin/discounts",
    label: "Discounts",
    icon: "🏷️",
    role: "manager" as const,
  },
  {
    href: "/admin/i18n",
    label: "i18n",
    icon: "🌐",
    role: "super_admin" as const,
  },
  {
    href: "/admin/tax",
    label: "Tax (GST)",
    icon: "🧾",
    role: "manager" as const,
  },
  {
    href: "/admin/audit-log",
    label: "Audit Log",
    icon: "📋",
    role: "super_admin" as const,
  },
  {
    href: "/admin/notifications",
    label: "Notifications",
    icon: "🔔",
    role: "manager" as const,
  },
];

interface AdminLayoutProps {
  children: React.ReactNode;
  user: { email: string; role: string };
}

export default function AdminLayout({
  children,
  user,
}: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const canAccess = (role: string) => {
    const roleOrder: Record<string, number> = {
      super_admin: 4,
      manager: 3,
      support: 2,
      viewer: 1,
    };
    return (roleOrder[user.role] ?? 0) >= (roleOrder[role] ?? 0);
  };

  return (
    <div className="min-h-screen bg-rang-paper">
      {/* Mobile sidebar toggle */}
      <div className="md:hidden">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="px-4 py-3 bg-sindoor text-rang-paper rounded-md font-medium hover:bg-sindoor/90"
        >
          {collapsed ? "☰ Menu" : "✕ Close"}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-surface border-r border-sand-border transition-all duration-300 ${
          collapsed || typeof window === "undefined" ? "-translate-x-full" : "translate-x-0"
        } md:relative md:translate-x-0 md:!-translate-x-full`}
      >
        <div className="p-6 border-b border-sand-border">
          <Link
            href="/admin"
            className="flex items-center gap-2"
          >
            <span className="text-xl font-serif font-bold text-deep-ink tracking-tight">
              SnehaVrinda
            </span>
            <span className="text-xl font-serif font-bold text-terracotta tracking-tight">
              Kala
            </span>
          </Link>
          <p className="mt-2 text-xs text-muted-ink font-sans">
            Admin Panel
          </p>
        </div>

        <nav className="p-4 space-y-1">
          {NAV_ITEMS.filter((item) => canAccess(item.role)).map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setCollapsed(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium font-sans transition-colors ${
                  isActive
                    ? "bg-sindoor/10 text-sindoor border border-sindoor/20"
                    : "text-muted-ink hover:bg-rang-paper/50 hover:text-terracotta"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-sand-border">
          <div className="text-xs font-sans text-muted-ink">
            <div className="font-medium text-deep-ink">{user.email}</div>
            <div className="text-terracotta font-medium capitalize">
              {user.role}
            </div>
          </div>
          <button
            onClick={() => router.push("/admin/logout")}
            className="mt-4 w-full py-2 px-4 rounded-md text-sm font-medium text-sindoor border border-sindoor hover:bg-sindoor hover:text-rang-paper transition-colors"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div
        className={`transition-all duration-300 md:pl-64 ${
          collapsed ? "pl-0" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}
