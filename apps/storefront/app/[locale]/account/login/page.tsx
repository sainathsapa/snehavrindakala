import Link from "next/link";
import { loginAction } from "../actions";
import { getTranslations } from "next-intl/server";
import { LotusMark } from "@/components/grounds";
import { Card, CardContent, CardHeader, CardTitle } from "@snehavrinda-kala/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const t = await getTranslations("authPage");

  return (
    <main className="relative overflow-hidden py-10">
      <LotusMark className="absolute -right-16 -top-10 hidden h-64 w-64 lg:block" />
      <div className="mx-auto max-w-md px-4 sm:px-6">
        <Card elevated>
          <CardHeader>
            <CardTitle>{t("loginTitle")}</CardTitle>
            <p className="mt-2 text-sm text-muted-ink font-sans">
              {t("loginIntro")}
            </p>
          </CardHeader>
          <CardContent>
            {error && (
              <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {error === "missing"
                  ? t("needMissing")
                  : t("needFailed")}
              </p>
            )}
            <form action={loginAction} className="space-y-4">
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
                  autoComplete="current-password"
                  required
                  className="w-full rounded-md border border-sand-border bg-surface px-3 py-2 text-sm text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-sindoor text-white rounded-md font-medium hover:bg-sindoor/90 transition-colors"
              >
                {t("signIn")}
              </button>
            </form>
            <p className="mt-6 text-sm text-muted-ink font-sans">
              {t("newHere")}{" "}
              <Link href="/account/register" className="text-sindoor underline">
                {t("createAccount")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
