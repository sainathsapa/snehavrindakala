/**
 * Partner portal header: business identity, member role and sign out.
 *
 * The sign-out control is a link to the dedicated /partner/logout screen, which
 * clears the signed cookie through the partner auth route and returns to the
 * login page. The layout renders that screen without the portal shell.
 */

import Link from "next/link";
import { Icon } from "@snehavrinda-kala/ui";
import type { PartnerRole } from "@/lib/partner/types";

export function PartnerHeader({
  displayName,
  email,
  role,
}: {
  displayName: string;
  email: string;
  role: PartnerRole;
}) {
  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-sand-border bg-surface px-4 py-4 pt-16 sm:px-6 md:px-8 md:py-5 md:pt-5">
      <div className="min-w-0">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-wider text-terracotta">
          Partner Portal
        </p>
        <p className="truncate font-serif text-lg font-semibold text-deep-ink">
          {displayName}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="font-sans text-sm font-medium text-deep-ink">{email}</p>
          <p className="font-sans text-xs capitalize text-muted-ink">{role}</p>
        </div>
        <span className="rounded-full border border-sindoor/20 bg-sindoor/10 px-3 py-1 font-sans text-xs font-semibold capitalize text-sindoor sm:hidden">
          {role}
        </span>
        <Link
          href="/partner/logout"
          className="inline-flex items-center gap-1.5 rounded-md border border-sindoor px-3 py-1.5 font-sans text-sm font-medium text-sindoor transition-colors hover:bg-sindoor hover:text-rang-paper"
        >
          <Icon name="logout" size={16} />
          Sign out
        </Link>
      </div>
    </header>
  );
}
