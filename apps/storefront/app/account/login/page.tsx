import Link from "next/link";
import { loginAction } from "../actions";
import { Card, CardContent, CardHeader, CardTitle } from "@snehavrinda-kala/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="py-10">
      <div className="mx-auto max-w-md px-4 sm:px-6">
        <Card elevated>
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <p className="mt-2 text-sm text-muted font-sans">
              Sign in to track orders, manage addresses, and follow your commissions.
            </p>
          </CardHeader>
          <CardContent>
            {error && (
              <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {error === "missing"
                  ? "Email and password are required."
                  : "We could not sign you in. Check your details and try again."}
              </p>
            )}
            <form action={loginAction} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-ink mb-1">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-madder"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-ink mb-1">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-madder"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-madder text-white rounded-md font-medium hover:bg-madder/90 transition-colors"
              >
                Sign in
              </button>
            </form>
            <p className="mt-6 text-sm text-muted font-sans">
              New to SnehaVrinda Kala?{" "}
              <Link href="/account/register" className="text-madder underline">
                Create an account
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
