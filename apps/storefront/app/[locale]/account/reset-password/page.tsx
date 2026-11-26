import { Link } from "@/i18n/routing";
import { resetPasswordAction } from "../reset-actions";
import { LotusMark } from "@/components/grounds";
import { Card, CardContent, CardHeader, CardTitle } from "@snehavrinda-kala/ui";

/**
 * Consumes the link sent by the password_reset email.
 *
 * The token is a credential, so it is read from the query string, posted once by
 * the form, and never rendered into the page source beyond the hidden field the
 * form needs. A missing or spent token shows the expired state rather than a
 * form that is guaranteed to fail.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string; error?: string }>;
}) {
  const { token, email, error } = await searchParams;
  const ready = Boolean(token && email);

  return (
    <main className="relative overflow-hidden py-10">
      <LotusMark className="absolute -right-16 -top-10 hidden h-64 w-64 lg:block" />
      <div className="mx-auto max-w-md px-4 sm:px-6">
        <Card elevated>
          <CardHeader>
            <CardTitle>Choose a new password</CardTitle>
            <p className="mt-2 text-sm text-muted-ink font-sans">
              {ready
                ? "Pick something you have not used here before. You will be signed in again on this device only."
                : "This reset link is incomplete or has already been used."}
            </p>
          </CardHeader>
          <CardContent>
            {error && (
              <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {error === "expired"
                  ? "That link has expired. Request a new one and we will email a fresh link."
                  : error === "short"
                    ? "Use at least 8 characters."
                    : error === "mismatch"
                      ? "The two passwords do not match."
                      : "Something went wrong. Please request a new link."}
              </p>
            )}

            {ready ? (
              <form action={resetPasswordAction} className="space-y-4">
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="email" value={email} />
                <div>
                  <label
                    htmlFor="password"
                    className="mb-1 block text-sm font-medium text-deep-ink"
                  >
                    New password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    className="w-full rounded-md border border-sand-border bg-paper px-3 py-2 text-deep-ink"
                  />
                </div>
                <div>
                  <label
                    htmlFor="confirm"
                    className="mb-1 block text-sm font-medium text-deep-ink"
                  >
                    Confirm new password
                  </label>
                  <input
                    id="confirm"
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    className="w-full rounded-md border border-sand-border bg-paper px-3 py-2 text-deep-ink"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-md bg-sindoor px-4 py-2 font-medium text-paper hover:opacity-90"
                >
                  Save password
                </button>
              </form>
            ) : (
              <Link
                href="/account/forgot-password"
                className="text-sm font-medium text-sindoor underline"
              >
                Request a new reset link
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
