import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE } from "@/lib/auth";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-session";

export async function GET() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  cookieStore.delete(AUTH_COOKIE);
  redirect("/admin/login");
}
