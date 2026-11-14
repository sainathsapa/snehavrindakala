import Link from "next/link";
import { registerAction } from "../actions";
import { Card, CardContent, CardHeader, CardTitle } from "@snehavrinda-kala/ui";

export default async function RegisterPage({
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
            <CardTitle>Create your account</CardTitle>
            <p className="mt-2 text-sm text-muted font-sans">
              Save addresses, track orders, and request custom art.
            </p>
          </CardHeader>
          <CardContent>
            {error && (
              <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {error === "missing"
                  ? "Email and password are required."
                  : "We could not create your account. The email may already be in use."}
              </p>
            )}
            <form action={registerAction} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="first_name" className="block text-sm font-medium text-ink mb-1">
                    First name
                  </label>
                  <input
                    id="first_name"
                    name="first_name"
                    type="text"
                    autoComplete="given-name"
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-madder"
                  />
                </div>
                <div>
                  <label htmlFor="last_name" className="block text-sm font-medium text-ink mb-1">
                    Last name
                  </label>
                  <input
                    id="last_name"
                    name="last_name"
                    type="text"
                    autoComplete="family-name"
                    className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-madder"
                  />
                </div>
              </div>
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
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-madder"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-madder text-white rounded-md font-medium hover:bg-madder/90 transition-colors"
              >
                Create account
              </button>
            </form>
            <p className="mt-6 text-sm text-muted font-sans">
              Already have an account?{" "}
              <Link href="/account/login" className="text-madder underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
