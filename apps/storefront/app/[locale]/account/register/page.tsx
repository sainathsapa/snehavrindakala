import { Link } from "@/i18n/routing";
import { registerAction } from "../actions";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@snehavrinda-kala/ui";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const t = await getTranslations("authPage");

  return (
    <main className="py-10">
      <div className="mx-auto max-w-md px-4 sm:px-6">
        <Card elevated>
          <CardHeader>
            <CardTitle>{t("registerTitle")}</CardTitle>
            <p className="mt-2 text-sm text-muted-ink font-sans">
              {t("registerIntro")}
            </p>
          </CardHeader>
          <CardContent>
            {error && (
              <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {error === "missing"
                  ? t("needMissing")
                  : t("registerFailed")}
              </p>
            )}
            <form action={registerAction} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="first_name" className="block text-sm font-medium text-deep-ink mb-1">
                    {t("firstName")}
                  </label>
                  <input
                    id="first_name"
                    name="first_name"
                    type="text"
                    autoComplete="given-name"
                    className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                  />
                </div>
                <div>
                  <label htmlFor="last_name" className="block text-sm font-medium text-deep-ink mb-1">
                    {t("lastName")}
                  </label>
                  <input
                    id="last_name"
                    name="last_name"
                    type="text"
                    autoComplete="family-name"
                    className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-deep-ink mb-1">
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
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-deep-ink mb-1">
                  {t("password")}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-sindoor text-white rounded-md font-medium hover:bg-sindoor/90 transition-colors"
              >
                {t("createBtn")}
              </button>
            </form>
            <p className="mt-6 text-sm text-muted-ink font-sans">
              {t("haveAccount")}{" "}
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
