/**
 * Partner portal shell (Server Component).
 *
 * Access is checked on the server before any portal HTML is produced. Identity
 * always comes from the verified session context — never from a request param —
 * and is passed down to the client nav/header as props. Without a valid partner
 * session the visitor is sent to /partner/login and sees none of the shell;
 * the sign-in/reset/sign-out screens themselves render standalone.
 */

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requirePartnerContext } from "@/lib/partner/context";
import { PartnerNav } from "./components/partner-nav";
import { PartnerHeader } from "./components/partner-header";

export const dynamic = "force-dynamic";

/**
 * The sign-in/reset/sign-out screens live under /partner but must stay
 * reachable while signed out — redirecting them to /partner/login would loop.
 * The locale middleware stamps the original request path on `x-pathname`.
 */
const PUBLIC_PARTNER_PATHS = [
  "/partner/login",
  "/partner/reset",
  "/partner/logout",
];

async function isPublicPartnerPath(): Promise<boolean> {
  try {
    const store = await headers();
    const raw = store.get("x-pathname") || store.get("x-invoke-path") || "";
    const pathname = raw.split("?")[0].replace(/\/+$/, "") || "/";
    return PUBLIC_PARTNER_PATHS.includes(pathname);
  } catch {
    // No request scope (e.g. a build-time render): treat as protected.
    return false;
  }
}

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requirePartnerContext();
  const publicPath = await isPublicPartnerPath();

  // Auth screens render standalone, exactly like /admin/login does.
  if (publicPath) return <>{children}</>;
  if (!ctx) redirect("/partner/login");

  const displayName = ctx.displayName?.trim() || ctx.email;

  return (
    <div className="min-h-screen bg-rang-paper font-sans text-deep-ink">
      <PartnerNav role={ctx.role} />
      <div className="flex min-h-screen flex-col md:pl-64">
        <PartnerHeader
          displayName={displayName}
          email={ctx.email}
          role={ctx.role}
        />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
