import { getCart } from "@/lib/cart";
import { formatPrice } from "@/lib/medusa";
import { removeCartItemAction, updateCartItemAction } from "./actions";
import { PromoCode } from "@/components/promo-code";
import { KalashMark } from "@/components/grounds";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const t = await getTranslations("cart");
  const cart = await getCart();
  const items = cart?.items ?? [];

  return (
    <main className="relative overflow-hidden py-10">
      <KalashMark className="absolute -right-6 -top-4 hidden h-48 w-48 lg:block" />
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl md:text-4xl font-serif font-semibold text-deep-ink mb-8">
          {t("title")}
        </h1>

        {items.length === 0 ? (
          <div className="rounded-xl border border-sand-border bg-surface p-8 text-center">
            <p className="text-lg text-muted-ink font-sans mb-6">
              {t("empty")}.
            </p>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 text-sm font-medium text-sindoor hover:underline"
            >
              {t("browse")} →
            </Link>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-sand-border bg-surface p-8">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-sand-border">
                    <th className="py-4 text-muted-ink font-sans">{t("item")}</th>
                    <th className="py-4 text-muted-ink font-sans text-right">
                      {t("price")}
                    </th>
                    <th className="py-4 text-muted-ink font-sans text-center">
                      {t("qty")}
                    </th>
                    <th className="py-4 text-muted-ink font-sans text-right">
                      {t("total")}
                    </th>
                    <th className="py-4" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-sand-border">
                      <td className="py-4 text-muted-ink font-sans">
                        {item.product_title || item.title || "Product"}
                        {item.variant_title && (
                          <span className="block text-xs text-muted-ink">
                            {item.variant_title}
                          </span>
                        )}
                      </td>
                      <td className="py-4 text-muted-ink font-sans text-right">
                        {formatPrice(item.unit_price, cart?.currency_code)}
                      </td>
                      <td className="py-4">
                        <div className="flex items-center justify-center gap-2">
                          <form action={updateCartItemAction}>
                            <input
                              type="hidden"
                              name="line_id"
                              value={item.id}
                            />
                            <input
                              type="hidden"
                              name="quantity"
                              value={Math.max(1, item.quantity - 1)}
                            />
                            <button
                              type="submit"
                              aria-label="Decrease quantity"
                              className="h-8 w-8 rounded border border-sand-border text-muted-ink hover:text-sindoor"
                            >
                              −
                            </button>
                          </form>
                          <span className="w-6 text-center text-sm text-deep-ink">
                            {item.quantity}
                          </span>
                          <form action={updateCartItemAction}>
                            <input
                              type="hidden"
                              name="line_id"
                              value={item.id}
                            />
                            <input
                              type="hidden"
                              name="quantity"
                              value={item.quantity + 1}
                            />
                            <button
                              type="submit"
                              aria-label="Increase quantity"
                              className="h-8 w-8 rounded border border-sand-border text-muted-ink hover:text-sindoor"
                            >
                              +
                            </button>
                          </form>
                        </div>
                      </td>
                      <td className="py-4 text-muted-ink font-sans text-right">
                        {formatPrice(
                          item.total ?? item.unit_price * item.quantity,
                          cart?.currency_code
                        )}
                      </td>
                      <td className="py-4 text-right">
                        <form action={removeCartItemAction}>
                          <input type="hidden" name="line_id" value={item.id} />
                          <button
                            type="submit"
                            className="text-xs text-muted-ink hover:text-sindoor"
                          >
                            {t("remove")}
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <PromoCode
              applied={(cart?.promotions ?? [])
                .map((promotion) => promotion.code)
                .filter((code): code is string => Boolean(code))}
            />

            <div className="mt-6 space-y-2 border-t border-sand-border pt-4 font-sans text-sm">
              <div className="flex justify-between gap-4 text-muted-ink">
                <span>{t("subtotal")}</span>
                <span className="whitespace-nowrap text-deep-ink">
                  {formatPrice(
                    (cart?.original_total ?? cart?.subtotal ?? 0) +
                      (cart?.discount_total ?? 0),
                    cart?.currency_code
                  )}
                </span>
              </div>
              {(cart?.discount_total ?? 0) > 0 && (
                <div className="flex justify-between gap-4 text-leaf">
                  <span>{t("discount")}</span>
                  <span className="whitespace-nowrap font-medium">
                    −{formatPrice(cart?.discount_total ?? 0, cart?.currency_code)}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
              <div className="text-lg font-serif font-semibold text-deep-ink">
                {t("total")}:
                <span className="ml-2 text-sindoor font-bold">
                  {formatPrice(cart?.total ?? 0, cart?.currency_code)}
                </span>
              </div>
              <Link
                href="/checkout"
                className="px-6 py-3 bg-sindoor text-rang-paper rounded-xl font-semibold hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2 transition-colors"
              >
                {t("checkout")}
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
