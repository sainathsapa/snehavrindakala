"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import { Icon, type IconName } from "@snehavrinda-kala/ui";

const NAV_ITEMS: { href: string; label: string; icon: IconName; role: "super_admin" | "manager" | "support" | "viewer" }[] = [
  { href: "/admin", label: "Dashboard", icon: "dashboard", role: "viewer" },
  { href: "/admin/orders", label: "Orders", icon: "orders", role: "viewer" as const },
  {
    href: "/admin/products",
    label: "Products",
    icon: "products",
    role: "viewer" as const,
  },
  {
    href: "/admin/categories",
    label: "Categories",
    icon: "categories",
    role: "viewer" as const,
  },
  {
    href: "/admin/customers",
    label: "Customers",
    icon: "customers",
    role: "viewer" as const,
  },
  {
    href: "/admin/partners",
    label: "Partners",
    icon: "partners",
    role: "viewer" as const,
  },
  {
    href: "/admin/tickets",
    label: "Support Tickets",
    icon: "tickets",
    role: "viewer" as const,
  },
  {
    href: "/admin/users",
    label: "Users & Roles",
    icon: "users",
    role: "super_admin" as const,
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: "settings",
    role: "super_admin" as const,
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    icon: "analytics",
    role: "viewer" as const,
  },
  {
    href: "/admin/discounts",
    label: "Discounts",
    icon: "discounts",
    role: "manager" as const,
  },
  {
    href: "/admin/commissions",
    label: "Commissions",
    icon: "commissions",
    role: "manager" as const,
  },
  {
    href: "/admin/tax",
    label: "Tax (GST)",
    icon: "tax",
    role: "manager" as const,
  },
  {
    href: "/admin/audit-log",
    label: "Audit Log",
    icon: "audit-log",
    role: "super_admin" as const,
  },
  {
    href: "/admin/notifications",
    label: "Notifications",
    icon: "notifications",
    role: "manager" as const,
  },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({
  children,
}: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);
  const [checking, setChecking] = useState(true);

  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginPage) {
      setChecking(false);
      return;
    }

    let cancelled = false;
    setChecking(true);

    fetch("/api/admin/session", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("unauthorized");
        return res.json();
      })
      .then((data: { email: string; role: string }) => {
        if (cancelled) return;
        setUser({ email: data.email, role: data.role });
        setChecking(false);
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setChecking(false);
        router.replace("/admin/login");
      });

    return () => {
      cancelled = true;
    };
  }, [isLoginPage, router]);

  const canAccess = (role: string) => {
    const roleOrder: Record<string, number> = {
      super_admin: 4,
      manager: 3,
      support: 2,
      viewer: 1,
    };
    return (roleOrder[user?.role ?? "viewer"] ?? 0) >= (roleOrder[role] ?? 0);
  };

  // The login page must render standalone, without the admin sidebar chrome.
  if (isLoginPage) {
    return <>{children}</>;
  }

  if (checking || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-rang-paper">
        <p className="text-muted-ink font-sans">Checking access…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-rang-paper relative">
      {/* Mobile sidebar toggle - fixed top-left, mobile only */}
      <div className="md:hidden fixed top-4 left-4 z-60">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="px-4 py-3 bg-sindoor text-rang-paper rounded-md font-medium hover:bg-sindoor/90"
        >
          <Icon
            name={collapsed ? "close" : "menu"}
            size={20}
            className="mr-1"
          />
          {collapsed ? "Close" : "Menu"}
        </button>
      </div>

      {/* Sidebar - fixed on left edge, slides over content on mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-surface border-r border-sand-border transition-transform duration-300 flex flex-col ${
          collapsed ? "-translate-x-full" : "translate-x-0"
        }`}
      >
        <div className="p-6 border-b border-sand-border shrink-0">
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

        <nav className="p-4 space-y-1 shrink-0 overflow-y-auto">
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
                <Icon
                  name={item.icon}
                  size={18}
                  className={
                    isActive ? "text-sindoor" : "text-muted-ink"
                  }
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-sand-border shrink-0">
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

      {/* Main content - left padding on desktop for sidebar */}
      <main
        className={`min-h-0 md:pl-64 transition-all duration-300 ${
          collapsed ? "md:pl-0" : ""
        }`}
      >
        <Suspense
          fallback={
            <div className="p-8 font-sans text-muted-ink">Loading…</div>
          }
        >
          {children}
        </Suspense>
      </main>
    </div>
  );
}
