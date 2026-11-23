import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePartnerContext } from "@/lib/partner/context";
import { partnerHasPermission } from "@/lib/partner/rbac";
import { listMembers } from "@/lib/partner-portal/team";
import TeamClient from "./team-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Team — SnehaVrinda Kala",
};

function asString(value: unknown): string {
  return value == null ? "" : String(value);
}

export default async function PartnerTeamPage() {
  const ctx = await requirePartnerContext();
  if (!ctx) redirect("/partner/login");

  const members = await listMembers(ctx);
  const serialized = members.map((member) => ({
    id: String(member.id),
    email: String(member.email),
    full_name: String(member.full_name ?? ""),
    role: String(member.role),
    status: String(member.status),
    last_login_at: asString(member.last_login_at),
  }));

  return (
    <main className="min-h-screen bg-rang-paper px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <nav className="mb-6 flex flex-wrap gap-4 text-sm font-sans text-sindoor">
          <Link href="/partner" className="hover:underline">
            Dashboard
          </Link>
          <Link href="/partner/profile" className="hover:underline">
            Business profile
          </Link>
          <Link href="/partner/security" className="hover:underline">
            Security
          </Link>
        </nav>

        <header className="mb-8">
          <p className="text-xs font-sans uppercase tracking-[0.2em] text-sindoor">
            Partner portal
          </p>
          <h1 className="mt-2 text-3xl font-serif font-semibold text-deep-ink">
            Team
          </h1>
          <p className="mt-2 text-sm font-sans text-muted-ink">
            Invite colleagues, assign roles and revoke sessions. Every member can
            only be managed from within your own partner account.
          </p>
        </header>

        <TeamClient
          initialMembers={serialized}
          currentMemberId={ctx.membershipId}
          canWrite={partnerHasPermission(ctx.role, "team:write")}
        />
      </div>
    </main>
  );
}
