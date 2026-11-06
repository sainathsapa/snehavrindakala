import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminLayout from "@/components/admin-layout";
import { isAdmin } from "./actions";

export default async function AdminLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const ok = await isAdmin();
  if (!ok) {
    redirect("/admin/login");
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("medusa_auth_token")?.value;

  // Get user info from the customer endpoint
  let user = { email: "admin@snehavrindakala.example", role: "super_admin" as const };
  if (token) {
    try {
      const res = await fetch(
        `${(
          process.env.MEDUSA_BACKEND_URL ||
          process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
          "http://localhost:9000"
        ).replace(/\/+$/, "")}/store/customers/me`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "x-publishable-api-key":
              process.env.MEDUSA_PUBLISHABLE_KEY ||
              process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ||
              "",
            Accept: "application/json",
          },
          cache: "no-store",
        }
      );
      if (res.ok) {
        const data = await res.json();
        const customer = data?.customer ?? data;
        user = {
          email: customer?.email || "admin@example.com",
          role: "super_admin" as const,
        };
      }
    } catch {
      // Use default user
    }
  }

  return <AdminLayout user={user}>{children}</AdminLayout>;
}
