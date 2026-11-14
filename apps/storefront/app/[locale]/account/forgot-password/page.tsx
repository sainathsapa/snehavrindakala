import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@snehavrinda-kala/ui";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;
  const t = await getTranslations("authPage");

  if (sent) {
    return (
      <main className="py-10">
        <div className="mx-auto max-w-md px-4 sm:px-6">
          <Card elevated>
            <CardHeader>
              <CardTitle>Password reset sent</CardTitle>
              <p className="mt-2 text-sm text-muted-ink font-sans">
                If an account exists for that email, you’ll receive a reset link.
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <Link
                href="/account/login"
                className="text-sm text-sindoor underline hover:text-sindoor/90 transition-colors"
              >
                Back to sign in
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="py-10">
      <div className="mx-auto max-w-md px-4 sm:px-6">
        <Card elevated>
          <CardHeader>
            <CardTitle>{t("forgotTitle")}</CardTitle>
            <p className="mt-2 text-sm text-muted-ink font-sans">
              {t("forgotIntro")}
            </p>
          </CardHeader>
          <CardContent>
            {error && (
              <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {error}
              </p>
            )}
            <form
              action="/api/account/forgot-password"
              method="POST"
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-deep-ink mb-1"
                >
                  {t("email")}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-sindoor text-rang-paper rounded-md font-medium hover:bg-sindoor/90 transition-colors"
              >
                {t("sendReset")}
              </button>
            </form>
            <p className="mt-6 text-sm text-muted-ink font-sans">
              {t("remembered")}{" "}
              <Link href="/account/login" className="text-sindoor underline">
                {t("signInLink")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
