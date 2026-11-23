import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePartnerContext } from "@/lib/partner/context";
import { readProfile } from "@/lib/partner-portal/team";
import ProfileForm from "./profile-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Business profile — SnehaVrinda Kala",
};

export default async function PartnerProfilePage() {
  const ctx = await requirePartnerContext();
  if (!ctx) redirect("/partner/login");

  const rows = await readProfile(ctx);
  const profile = rows[0];
  if (!profile) redirect("/partner/login");

  return (
    <main className="min-h-screen bg-rang-paper px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <nav className="mb-6 flex flex-wrap gap-4 text-sm font-sans text-sindoor">
          <Link href="/partner" className="hover:underline">
            Dashboard
          </Link>
          <Link href="/partner/team" className="hover:underline">
            Team
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
            Business profile
          </h1>
          <p className="mt-2 text-sm font-sans text-muted-ink">
            Contact and business details are visible to our operations team. Account
            status and verification are managed by the platform and cannot be changed
            here.
          </p>
        </header>

        <div className="rounded-xl border border-sand-border bg-surface p-6 shadow-sm sm:p-8">
          <ProfileForm
            initial={{
              display_name: String(profile.display_name ?? ""),
              contact_email: String(profile.contact_email ?? ""),
              contact_phone: profile.contact_phone == null ? "" : String(profile.contact_phone),
              business_profile:
                profile.business_profile && typeof profile.business_profile === "object"
                  ? (profile.business_profile as Record<string, unknown>)
                  : {},
            }}
            accountStatus={String(profile.account_status ?? "pending")}
            verificationStatus={String(profile.verification_status ?? "unverified")}
          />
        </div>
      </div>
    </main>
  );
}
