import { getCart } from "@/lib/cart";
import { formatPrice } from "@/lib/medusa";
import { removeCartItemAction, updateCartItemAction } from "./actions";
import { PromoCode } from "@/components/promo-code";
import { KalashMark } from "@/components/grounds";
import { TrustStrip } from "@/components/trust-strip";
import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

/**
 * The cart, as a page someone reads before paying.
 *
 * Deliberately two columns on desktop: the things being bought on the left, and
 * a summary that stays in view while they scroll the left side. The previous
 * version put the total at the bottom of a wide table, so on a long order the
 * buyer had to scroll past everything to find out what it cost.
 *
 * Thumbnails are used when Medusa sends one; a missing image renders nothing at
 * all rather than a grey box, because an empty frame reads as a broken shop.
 */
export default async function CartPage() {
  const t = await getTranslations("cart");
  const cart = await getCart();
  const items = cart?.items ?? [];
  const currency = cart?.currency_code;

  const itemCount = items.reduce((sum, item) => sum + (item.quantity ?? 0), 0);
  const subtotal =
    (cart?.original_total ?? cart?.subtotal ?? 0) + (cart?.discount_total ?? 0);
  const discount = cart?.discount_total ?? 0;

  return (
    <main className="relative overflow-hidden py-10 sm:py-14">
      <KalashMark className="absolute -right-6 -top-4 hidden h-48 w-48 lg:block" />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-wrap items-baseline justify-between gap-3 border-b border-sand-border/70 pb-5">
          <div>
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.24em] text-terracotta">
              Your selection
            </p>
            <h1 className="mt-2 text-3xl font-serif font-semibold tracking-tight text-deep-ink md:text-4xl">
              {t("title")}
            </h1>
          </div>
          {items.length > 0 && (
            <p className="font-sans text-sm text-muted-ink">
              {itemCount} {itemCount === 1 ? "piece" : "pieces"}
            </p>
          )}
        </header>

        {items.length === 0 ? (
          <div className="rounded-xl border border-sand-border bg-surface p-10 text-center">
            <p className="mb-2 font-serif text-xl text-deep-ink">
              Nothing here yet
            </p>
            <p className="mb-6 font-sans text-sm text-muted-ink">
              {t("empty")}.
            </p>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 rounded-lg bg-sindoor px-5 py-2.5 font-sans text-sm font-semibold text-rang-paper transition-opacity hover:opacity-90"
            >
              {t("browse")} →
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
            {/* ── items ─────────────────────────────────────────────── */}
            <div>
              <ul className="divide-y divide-sand-border/70 rounded-xl border border-sand-border bg-surface">
                {items.map((item) => {
                  const thumbnail = (item as { thumbnail?: string | null }).thumbnail;
                  const lineTotal =
                    item.total ?? (item.unit_price ?? 0) * item.quantity;

                  return (
                    <li
                      key={item.id}
                      className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:gap-5 sm:p-5"
                    >
                      {thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumbnail}
                          alt={item.product_title || item.title || "Artwork"}
                          className="h-24 w-20 shrink-0 rounded-lg border border-sand-border object-cover"
                          loading="lazy"
                        />
                      ) : null}

                      <div className="min-w-0 flex-1">
                        <p className="font-serif text-lg leading-snug text-deep-ink">
                          {item.product_title || item.title || "Product"}
                        </p>
                        {item.variant_title && (
                          <p className="mt-0.5 font-sans text-xs uppercase tracking-wide text-muted-ink">
                            {item.variant_title}
                          </p>
                        )}
                        <p className="mt-1 font-sans text-sm text-muted-ink">
                          {formatPrice(item.unit_price, currency)} each
                        </p>

                        <div className="mt-3 flex items-center gap-4">
                          {/* Quantity as one control, not two forms that each
                              reload the page on their own. */}
                          <div className="inline-flex items-center rounded-lg border border-sand-border">
                            <form action={updateCartItemAction}>
                              <input type="hidden" name="line_id" value={item.id} />
                              <input
                                type="hidden"
                                name="quantity"
                                value={Math.max(1, item.quantity - 1)}
                              />
                              <button
                                type="submit"
                                aria-label="Decrease quantity"
                                disabled={item.quantity <= 1}
                                className="h-9 w-9 rounded-l-lg text-muted-ink transition-colors hover:bg-rang-paper hover:text-sindoor disabled:opacity-40"
                              >
                                −
                              </button>
                            </form>
                            <span className="w-9 text-center font-sans text-sm font-medium text-deep-ink">
                              {item.quantity}
                            </span>
                            <form action={updateCartItemAction}>
                              <input type="hidden" name="line_id" value={item.id} />
                              <input
                                type="hidden"
                                name="quantity"
                                value={item.quantity + 1}
                              />
                              <button
                                type="submit"
                                aria-label="Increase quantity"
                                className="h-9 w-9 rounded-r-lg text-muted-ink transition-colors hover:bg-rang-paper hover:text-sindoor"
                              >
                                +
                              </button>
                            </form>
                          </div>

                          <form action={removeCartItemAction}>
                            <input type="hidden" name="line_id" value={item.id} />
                            <button
                              type="submit"
                              className="font-sans text-xs text-muted-ink underline-offset-4 transition-colors hover:text-sindoor hover:underline"
                            >
                              {t("remove")}
                            </button>
                          </form>
                        </div>
                      </div>

                      <p className="shrink-0 font-sans text-base font-medium text-deep-ink sm:text-right">
                        {formatPrice(lineTotal, currency)}
                      </p>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-4">
                <PromoCode
                  applied={(cart?.promotions ?? [])
                    .map((promotion) => promotion.code)
                    .filter((code): code is string => Boolean(code))}
                />
              </div>
            </div>

            {/* ── summary ───────────────────────────────────────────── */}
            <aside className="lg:sticky lg:top-6 lg:self-start">
              <div className="rounded-xl border border-sand-border bg-surface p-6">
                <h2 className="font-serif text-lg font-semibold text-deep-ink">
                  Order summary
                </h2>
                <div className="mt-4 space-y-2 font-sans text-sm">
                  <div className="flex justify-between gap-4 text-muted-ink">
                    <span>{t("subtotal")}</span>
                    <span className="whitespace-nowrap text-deep-ink">
                      {formatPrice(subtotal, currency)}
                    </span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between gap-4 text-leaf">
                      <span>{t("discount")}</span>
                      <span className="whitespace-nowrap font-medium">
                        −{formatPrice(discount, currency)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between gap-4 text-muted-ink">
                    <span>Shipping</span>
                    <span className="text-right text-xs leading-relaxed">
                      <span className="font-medium text-leaf">Free on every order</span>
                      <br />
                      <span className="text-muted-ink">
                        courier rate shown and discounted at checkout
                      </span>
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-baseline justify-between border-t border-sand-border pt-4">
                  <span className="font-sans text-sm text-muted-ink">
                    {t("total")}
                  </span>
                  <span className="font-serif text-2xl font-semibold text-sindoor">
                    {formatPrice(cart?.total ?? 0, currency)}
                  </span>
                </div>

                <Link
                  href="/checkout"
                  className="mt-5 block rounded-xl bg-sindoor px-6 py-3 text-center font-sans font-semibold text-rang-paper transition-colors hover:bg-sindoor/90 focus:outline-none focus:ring-2 focus:ring-sindoor focus:ring-offset-2"
                >
                  {t("checkout")}
                </Link>

                <p className="mt-3 text-center font-sans text-[11px] leading-relaxed text-muted-ink">
                  Insured shipping · Certificate of authenticity with every work
                </p>
              </div>

              <div className="mt-4 rounded-xl border border-sand-border bg-rang-paper/50 p-4">
                <TrustStrip compact />
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
