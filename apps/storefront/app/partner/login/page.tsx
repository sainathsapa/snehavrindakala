import Link from "next/link";
import LoginForm from "./login-form";

export const metadata = {
  title: "Partner sign in — SnehaVrinda Kala",
};

export default function PartnerLoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-rang-paper px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-xs font-sans uppercase tracking-[0.2em] text-sindoor">
            SnehaVrinda Kala
          </p>
          <h1 className="mt-2 text-3xl font-serif font-semibold text-deep-ink tracking-tight">
            Partner portal
          </h1>
          <p className="mt-2 text-sm font-sans text-muted-ink">
            Manage your catalogue, orders and earnings in one place.
          </p>
        </div>

        <div className="rounded-xl border border-sand-border bg-surface p-6 shadow-lg sm:p-8">
          <h2 className="mb-6 text-xl font-serif font-semibold text-deep-ink">
            Sign in
          </h2>
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-sm font-sans text-muted-ink">
          Can&apos;t sign in?{" "}
          <Link
            href="/partner/reset"
            className="font-medium text-sindoor hover:underline"
          >
            Reset your password
          </Link>
        </p>
      </div>
    </main>
  );
}
