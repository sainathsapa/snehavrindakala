import Link from "next/link";
import { adminLoginAction } from "../actions";
import { Card, CardContent, CardHeader, CardTitle } from "@snehavrinda-kala/ui";
import { Button } from "@snehavrinda-kala/ui";

export const metadata = {
  title: "Admin login",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="py-12">
      <div className="mx-auto max-w-md px-4 sm:px-6">
        <div className="text-center mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sindoor font-sans font-medium hover:underline"
          >
            ← Back to SnehaVrinda Kala
          </Link>
          <h1 className="mt-4 text-3xl md:text-4xl font-serif font-semibold text-deep-ink tracking-tight">
            Admin login
          </h1>
          <p className="mt-2 text-muted-ink font-sans">
            Partner &amp; catalogue administration
          </p>
        </div>

        <Card elevated className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            {error && (
              <p className="mt-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 font-sans">
                {error === "missing"
                  ? "Email and password are required."
                  : error === "not_admin"
                    ? "This email is not authorised for admin access. Contact the store owner."
                    : "We could not sign you in. Check your details and try again."}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <form action={adminLoginAction} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-deep-ink mb-1 font-sans"
                >
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink placeholder:text-muted-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-deep-ink mb-1 font-sans"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink placeholder:text-muted-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-sindoor text-rang-paper rounded-xl font-semibold hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 transition-colors"
              >
                Sign in to admin
              </button>
            </form>
            <p className="mt-6 text-sm text-muted-ink font-sans text-center">
              Not an admin?{" "}
              <Link href="/account/login" className="text-sindoor underline">
                Customer login
              </Link>
            </p>
          </CardContent>
        </Card>

        <p className="mt-8 text-xs text-muted-ink font-sans text-center">
          Sample admin: {process.env.ADMIN_EMAILS ||
            "admin@snehavrindakala.example"}. Set ADMIN_EMAILS in .env and
          create a customer account with that email to access the panel.
        </p>
      </div>
    </main>
  );
}
