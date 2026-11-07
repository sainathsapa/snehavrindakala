"use client";

import { useState, useEffect, useCallback } from "react";
import type { Role } from "@/lib/rbac";
import { hasPermission, can } from "@/lib/rbac";

interface AdminUser {
  email: string;
  role: Role;
}

interface AdminRoleContextType {
  user: AdminUser | null;
  loading: boolean;
  can: (permission: string) => boolean;
  canManage: (resource: string) => boolean;
}

const ADMIN_ROLE_KEY = "svk_admin_role";

export function useAdminRole(): AdminRoleContextType {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/session", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("unauthorized");
        return res.json();
      })
      .then((data: { email: string; role: string }) => {
        setUser({ email: data.email, role: data.role as Role });
        setLoading(false);
      })
      .catch(() => {
        setUser(null);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const can = useCallback(
    (permission: string) => {
      if (!user) return false;
      return hasPermission(user.role as Role, permission as any);
    },
    [user]
  );

  const canManage = useCallback(
    (resource: string) => {
      if (!user) return false;
      const role = user.role as Role;
      return can(`${resource}:write`)(undefined as any) || can(`${resource}:delete`)(undefined as any);
    },
    [user, can]
  );

  return { user, loading, can, canManage };
}
