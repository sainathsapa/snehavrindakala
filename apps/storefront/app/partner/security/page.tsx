import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePartnerContext } from "@/lib/partner/context";
import SecurityForm from "./security-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Security — SnehaVrinda Kala",
};

export default async function PartnerSecurityPage() {
  const ctx = await requirePartnerContext();
  if (!ctx) redirect("/partner/login");

  return (
    <main className="min-h-screen bg-rang-paper px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <nav className="mb-6 flex flex-wrap gap-4 text-sm font-sans text-sindoor">
          <Link href="/partner" className="hover:underline">
            Dashboard
          </Link>
          <Link href="/partner/profile" className="hover:underline">
            Business profile
          </Link>
          <Link href="/partner/team" className="hover:underline">
            Team
          </Link>
        </nav>

        <header className="mb-8">
          <p className="text-xs font-sans uppercase tracking-[0.2em] text-sindoor">
            Partner portal
          </p>
          <h1 className="mt-2 text-3xl font-serif font-semibold text-deep-ink">
            Security
          </h1>
          <p className="mt-2 text-sm font-sans text-muted-ink">
            Signed in as {ctx.email}. Changing your password revokes every active
            session for this membership.
          </p>
        </header>

        <div className="rounded-xl border border-sand-border bg-surface p-6 shadow-sm sm:p-8">
          <SecurityForm />
        </div>
      </div>
    </main>
  );
}
