import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@snehavrinda-kala/ui";
import { emailStatus } from "@/lib/config-status";
import { STUDIO_EMAIL } from "@/lib/site-content";

export const dynamic = "force-dynamic";

/**
 * Forgot password.
 *
 * This page used to say "Password reset sent" and describe a link that no part
 * of the shop could send. Two honest states now:
 *
 *   - email is configured: we write to you, as promised;
 *   - email is not configured: no link is coming, so the page says the studio
 *     will reset it by hand and gives the address to write from.
 *
 * The distinction depends only on shop configuration, never on whether an
 * account exists for the address, so it cannot be used to discover customers.
 */
export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;
  const t = await getTranslations("authPage");
  const emailReady = emailStatus().level === "ready";

  if (sent) {
    return (
      <main className="py-10">
        <div className="mx-auto max-w-md px-4 sm:px-6">
          <Card elevated>
            <CardHeader>
              <CardTitle>{t("resetSentTitle")}</CardTitle>
              <p className="mt-2 text-sm text-muted-ink font-sans">
                {emailReady ? t("resetSentBody") : t("resetStudioBody")}
              </p>
              {!emailReady && (
                <p className="mt-2 text-sm text-muted-ink font-sans">
                  <a href={`mailto:${STUDIO_EMAIL}`} className="text-sindoor underline">
                    {STUDIO_EMAIL}
                  </a>
                </p>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              <Link
                href="/account/login"
                className="text-sm text-sindoor underline hover:text-sindoor/90 transition-colors"
              >
                {t("backToSignIn")}
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
              {emailReady ? t("forgotIntro") : t("forgotIntroOffline")}
            </p>
          </CardHeader>
          <CardContent>
            {error && (
              <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {t("resetFailed")}
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
                {emailReady ? t("sendReset") : t("requestReset")}
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
