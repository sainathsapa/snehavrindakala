import { Link } from "@/i18n/routing";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentCustomer, getAuthToken } from "@/lib/auth";
import { KalashMark } from "@/components/grounds";
import { medusa, formatPrice } from "@/lib/medusa";
import { logoutAction } from "./actions";
import { changePasswordAction, updateProfileAction } from "./address-actions";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@snehavrinda-kala/ui";

/**
 * The account home.
 *
 * Everything a buyer needs to manage their own side of the shop lives here:
 * editable profile, saved addresses, order history and password. Previously
 * the profile was read-only and there was no address book at all, so a
 * returning customer retyped their address on every order.
 *
 * Edits are Server Actions that redirect back with a status flag in the query
 * string. That keeps the page a plain server component — no client state to
 * drift — and every outcome is visible in the URL, which also makes failures
 * reportable by the buyer without opening dev tools.
 */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const customer = await getCurrentCustomer();
  if (!customer) {
    redirect("/account/login");
  }

  const t = await getTranslations("account");
  const params = (await searchParams) ?? {};

  const token = await getAuthToken();
  let orders: any[] = [];
  let addresses: any[] = [];
  if (token) {
    try {
      const result = await medusa.listCustomerOrders(token, { limit: 20 });
      orders = result.orders ?? [];
    } catch (error) {
      console.error("Failed to load orders", error);
    }
    try {
      addresses = await medusa.listCustomerAddresses(token);
    } catch (error) {
      console.error("Failed to load addresses", error);
    }
  }

  const errorParam = typeof params.error === "string" ? params.error : "";

  return (
    <main className="relative overflow-hidden py-10">
      <KalashMark className="absolute -right-8 -top-6 hidden h-52 w-52 lg:block" opacity={0.1} />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-sans text-sm font-medium uppercase tracking-wider text-sindoor">
              {t("eyebrow")}
            </p>
            <h1 className="mt-1 font-serif text-3xl font-semibold text-deep-ink md:text-4xl">
              {customer.first_name || customer.email}
            </h1>
            <p className="mt-1 font-sans text-muted-ink">{customer.email}</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="font-sans text-sm text-muted-ink transition-colors hover:text-sindoor"
            >
              {t("signOut")}
            </button>
          </form>
        </div>

        {/* Status banners. One place, so no action can silently succeed. */}
        {params.saved === "profile" && (
          <Banner tone="ok">{t("profileSaved")}</Banner>
        )}
        {params.reset === "sent" && (
          <Banner tone="ok">{t("passwordResetSent")}</Banner>
        )}
        {errorParam === "password_wrong" && (
          <Banner tone="bad">{t("errorPasswordWrong")}</Banner>
        )}
        {errorParam === "password_short" && (
          <Banner tone="bad">{t("errorPasswordShort")}</Banner>
        )}
        {errorParam === "password_mismatch" && (
          <Banner tone="bad">{t("errorPasswordMismatch")}</Banner>
        )}
        {errorParam === "profile" && (
          <Banner tone="bad">{t("errorSave")}</Banner>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* ── Profile ─────────────────────────────────────────────── */}
          <Card elevated className="lg:col-span-1">
            <CardHeader>
              <CardTitle>{t("profile")}</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateProfileAction} className="grid gap-3 font-sans text-sm">
                <label className="grid gap-1.5">
                  <span className="text-muted-ink">{t("firstName")}</span>
                  <input
                    name="first_name"
                    defaultValue={customer.first_name ?? ""}
                    className="rounded-md border border-sand-border bg-surface px-3 py-2 text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-muted-ink">{t("lastName")}</span>
                  <input
                    name="last_name"
                    defaultValue={customer.last_name ?? ""}
                    className="rounded-md border border-sand-border bg-surface px-3 py-2 text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-muted-ink">{t("phone")}</span>
                  <input
                    name="phone"
                    type="tel"
                    defaultValue={customer.phone ?? ""}
                    className="rounded-md border border-sand-border bg-surface px-3 py-2 text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                  />
                </label>
                {/* Email is shown but not editable: changing it has to go
                    through verification, otherwise a typo silently detaches the
                    account from its order history and receipts. */}
                <p className="text-xs text-muted-ink">{t("email")}: {customer.email}</p>
                <button
                  type="submit"
                  className="mt-1 rounded-md bg-sindoor px-4 py-2 font-medium text-rang-paper transition-colors hover:bg-sindoor/90"
                >
                  {t("saveChanges")}
                </button>
              </form>
            </CardContent>
          </Card>

          {/* ── Addresses ───────────────────────────────────────────── */}
          <Card elevated className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t("addresses")}</CardTitle>
            </CardHeader>
            <CardContent>
              {addresses.length === 0 ? (
                <p className="font-sans text-sm text-muted-ink">
                  {t("noAddresses")}
                </p>
              ) : (
                <ul className="mb-4 grid gap-3 sm:grid-cols-2">
                  {addresses.map((address: any) => (
                    <li
                      key={address.id}
                      className="rounded-md border border-sand-border bg-surface/60 p-3 font-sans text-sm leading-relaxed text-muted-ink"
                    >
                      <p className="font-medium text-deep-ink">
                        {[address.first_name, address.last_name]
                          .filter(Boolean)
                          .join(" ")}
                        {address.is_default_shipping && (
                          <span className="ml-2 rounded-full bg-leaf/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-leaf">
                            {t("defaultAddress")}
                          </span>
                        )}
                      </p>
                      <p>{address.address_1}</p>
                      <p>
                        {[address.city, address.province, address.postal_code]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      <p className="uppercase">{address.country_code}</p>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/account/addresses"
                className="inline-flex rounded-md border border-sindoor px-4 py-2 font-sans text-sm font-medium text-sindoor transition-colors hover:bg-sindoor hover:text-rang-paper"
              >
                {t("manageAddresses")}
              </Link>
            </CardContent>
          </Card>

          {/* ── Orders ──────────────────────────────────────────────── */}
          <Card elevated className="lg:col-span-2">
            <CardHeader>
              <CardTitle>{t("ordersLink")}</CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <p className="font-sans text-muted-ink">{t("noOrders")}</p>
              ) : (
                <ul className="space-y-4">
                  {orders.map((order: any) => (
                    <li
                      key={order.id}
                      className="flex flex-col gap-2 border-b border-sand-border pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <span className="font-medium text-deep-ink">
                          {order.display_id ?? order.id}
                        </span>
                        <Badge variant="outline">
                          {order.status ?? "processing"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 font-sans text-sm text-muted-ink">
                        <span>
                          {order.items?.length ?? 0} item
                          {(order.items?.length ?? 0) === 1 ? "" : "s"}
                        </span>
                        <span>{formatPrice(order.total, order.currency_code)}</span>
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/order/${order.id}`}
                            className="text-xs font-medium text-sindoor hover:underline"
                          >
                            {t("trackOrder")}
                          </Link>
                          <Link
                            href={`/account/returns?order_id=${order.id}`}
                            className="rounded-md border border-sand-border px-3 py-1 text-xs font-medium text-sindoor transition-colors hover:bg-sindoor/10"
                          >
                            {t("returns")}
                          </Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* ── Password ────────────────────────────────────────────── */}
          <Card elevated className="lg:col-span-1" >
            <CardHeader>
              <CardTitle>{t("password")}</CardTitle>
            </CardHeader>
            <CardContent>
              <form id="password" action={changePasswordAction} className="grid gap-3 font-sans text-sm">
                <label className="grid gap-1.5">
                  <span className="text-muted-ink">{t("currentPassword")}</span>
                  <input
                    name="current_password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="rounded-md border border-sand-border bg-surface px-3 py-2 text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-muted-ink">{t("newPassword")}</span>
                  <input
                    name="new_password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    className="rounded-md border border-sand-border bg-surface px-3 py-2 text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                  />
                </label>
                <label className="grid gap-1.5">
                  <span className="text-muted-ink">{t("confirmPassword")}</span>
                  <input
                    name="confirm_password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    className="rounded-md border border-sand-border bg-surface px-3 py-2 text-deep-ink focus:outline-none focus:ring-2 focus:ring-sindoor"
                  />
                </label>
                <button
                  type="submit"
                  className="mt-1 rounded-md border border-sand-border px-4 py-2 font-medium text-deep-ink transition-colors hover:border-sindoor hover:text-sindoor"
                >
                  {t("changePassword")}
                </button>
                <p className="text-xs leading-relaxed text-muted-ink">
                  {t("passwordNote")}
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "ok" | "bad";
  children: React.ReactNode;
}) {
  const classes =
    tone === "ok"
      ? "border-leaf/40 bg-leaf/5 text-leaf"
      : "border-sindoor/40 bg-sindoor/5 text-sindoor";
  return (
    <p
      role={tone === "ok" ? "status" : "alert"}
      className={`mb-6 rounded-md border px-4 py-3 font-sans text-sm ${classes}`}
    >
      {children}
    </p>
  );
}
