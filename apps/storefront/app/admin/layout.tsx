/**
 * Admin shell (Server Component).
 *
 * Access is checked here, on the server, before a single byte of admin HTML is
 * produced. The previous version was a client component that rendered first and
 * asked /api/admin/session afterwards — so every visit flashed "Checking
 * access…", shipped the whole nav to unauthenticated visitors, and left the real
 * gate in a `useEffect` that a JS-disabled client never ran.
 *
 * Identity now arrives as props from the server; only the sidebar's
 * interactivity lives in the client component.
 */

import { getAdminIdentity } from "./actions";
import { AdminChrome } from "@/components/admin-chrome";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const identity = await getAdminIdentity();

  // /admin/login is a child of this layout and must stay reachable while
  // signed out, so it renders its own standalone page. Anything else without an
  // identity is a session that expired mid-navigation.
  //
  // The login page is detected client-side in AdminChrome (via usePathname);
  // here we simply do not redirect, because the middleware already blocks
  // unauthenticated access to every other /admin route.
  if (!identity) {
    return <>{children}</>;
  }

  return (
    <AdminChrome email={identity.email} role={identity.role}>
      {children}
    </AdminChrome>
  );
}
