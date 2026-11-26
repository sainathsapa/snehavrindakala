# Flows

Every path a person or a machine can take through this shop, what happens on it,
and how it is known to work. Written so that a gap is visible as a missing row
rather than something discovered by a customer.

Status words mean exactly what they say:

- **verified** — exercised end to end against a running build, this session or a
  recorded one, with the result noted.
- **built** — the code path exists and typechecks, but has not been exercised
  against real money, a real courier or a real inbox.
- **gap** — known missing or blocked, with the reason.

---

## 1. Customer — finding the work

| Flow | Entry | What happens | Status |
| --- | --- | --- | --- |
| Land | `/` | Hero, rooms teaser, featured works, traditions strip | verified |
| Browse catalogue | `/shop`, `/shop/[category]` | Medusa products for the sales channel, filters, sort | verified |
| Search | header field, `/search` | Debounced 250 ms query → `/api/store/search` → products, categories, makers, art forms, journal, **rooms**, **newsroom**, glossary, pages | verified (Hindi: `मिट्टी` → terracotta) |
| Open a work | `/products/[handle]` | Gallery, specs (dimensions or "to be confirmed"), story, certificate note, add to cart | verified |
| Learn | `/learn`, `/learn/[plate]`, `/learn/[plate]/[slug]` | Three plates, 38 entries, glossary, search inside a plate | verified en + hi |
| Rooms | `/rooms`, `/rooms/[slug]` | Editorial rooms; hidden from nav until one is published | verified |
| Newsroom | `/newsroom`, `/newsroom/[slug]` | Studio announcements, no invented press | verified |
| Journal | `/journal`, `/journal/[slug]` | Essays | verified |
| Makers / artists | `/artists` ⇄ `/makers` | One page per mode; single-brand forwards to makers | verified |
| Art forms | `/art-forms/[slug]` | Tradition page with Hindi | verified |
| Wishlist | heart on a product, `/wishlist` | Stored per account, visible to admin as demand signal | verified |

## 2. Customer — buying

| Flow | Entry | What happens | Status |
| --- | --- | --- | --- |
| Add to cart | product page | Medusa cart; cookie `cart_id`; quantity limits against stock | verified |
| Cart | `/cart` | Lines, shipping estimate, free-shipping promotion shown then discounted | verified |
| Checkout — address | `/checkout` step 1 | Country/state/city comboboxes, PIN suggests state, saved addresses for signed-in buyers | verified |
| Checkout — delivery | step 2 | Courier rates from the shipping options; the ₹149 rate appears and is then discounted to ₹0 by the promotion | verified |
| Checkout — payment | step 3 | Razorpay order created for the live total; modal prefilled with the name/email/phone already given | built (modal reached; card not yet paid) |
| Payment handshake | `/api/store/payment/verify` | HMAC signature verified server-side | verified |
| Complete order | `/api/store/checkout/complete` | Verifies the Razorpay payment, completes the cart, issues certificates, mints the track reference, sends the confirmation with the invoice PDF, creates the Shiprocket shipment, links or creates the account | built |
| Confirmation | `/order/[id]`, `?t=` guest token | Items, totals, gift note, certificates, track reference, invoice download | verified |
| Invoice | `/api/orders/[id]/invoice` | PDF with GST lines when the studio is registered, otherwise no GST claim | verified |
| Certificates | issued at completion, `/verify/[code]` | One per work, 80-bit Crockford code, public proof page that shows no buyer data | verified |
| Free shipping | automatic promotion | Visible rate, then a 100% shipping discount — never a silent zero | verified |
| Coupons | cart | Promotion codes applied and validated server-side | verified |

## 3. Customer — after buying

| Flow | Entry | What happens | Status |
| --- | --- | --- | --- |
| Track an order | `/track` | Random reference (`SV-7Q4-K2M-9DR-X3P`) or AWB plus the order email; deliberately refuses display counters | verified |
| Account — register | `/account/register` | Medusa customer, session cookie, welcome email | verified |
| Account — login | `/account/login` | Session; `next` honoured | verified |
| Forgot password | `/account/forgot-password` | Reset request recorded, Medusa token minted, subscriber emails it | verified (Resend accepted) |
| Reset password | `/account/reset-password?token=` | Single-use token, password set, confirmation email | built |
| Guest orders in account | `/account` | A guest order with the same email and no customer_id is merged into the list — strict match, no `+alias` equivalence | verified |
| Addresses | `/account/addresses` | Saved addresses, default address | verified |
| Support | `/account/support`, `/account/support/[id]` | Ticket list and thread; signs out → redirect to login | verified |
| Returns | `/account/returns` | Claim form: damaged/incorrect/not-as-described within 48 h, photos, studio decision | built (no general returns by policy) |
| Commission status | `/commission-status/[ref]` | Public progress page for a custom commission | built |
| Newsletter | footer letter form | Subscriber row, consent recorded | verified |
| Cookie/analytics consent | banner | Zoho and GA load only after consent | verified |

## 4. Partner

| Flow | Entry | What happens | Status |
| --- | --- | --- | --- |
| Apply | `/partner/apply` | Trade application with auto-slug; lands in admin | built |
| Check status | `/partner/status` | Lookup by email + reference, `noindex` | built |
| Portal login | `/partner/login` | Separate session from customers; `/hi/partner/*` now redirects here instead of 404 | built |
| Portal | `/partner/*` | Catalogue, orders, commissions for that partner | built |
| Sell with us | `/sell`, `/seller` | Public pitch page and seller landing | verified |

## 5. Admin

| Flow | Entry | What happens | Status |
| --- | --- | --- | --- |
| Sign in | `/admin/login` | `admin_users` row (bcrypt via pgcrypto) or env fallback; role → permission set | verified (both owners) |
| Orders | `/admin/orders`, `/admin/orders/[id]` | List, detail, refund, cancel, invoice | verified |
| Shipping | order detail | Create/update a Shiprocket shipment, AWB, courier, tracking URL | built (no API user yet) |
| Products | `/admin/products`, new, edit | Multi-image, dimensions required before publish, sales-channel attach, slug follows title | verified |
| "No size" badge | products list | Flags published work without dimensions | verified |
| Categories | `/admin/categories` | Create, edit, handle = slug | verified |
| Rooms & newsroom | `/admin/rooms`, `/admin/newsroom` | One editor for both kinds, bilingual columns, publish toggle | verified |
| Journal | `/admin/journal` | Posts with slugs | verified |
| Partners | `/admin/partners`, applications | Approve, link artist, commercial terms | built |
| Support tickets | `/admin/tickets` | Reply, status changes; customer sees the reply | verified |
| Users & roles | `/admin/users` | Roles and permission boundaries (support has `products:write`, not delete/settings/refund) | verified |
| Discounts | `/admin/discounts` | Codes, amounts, expiry | verified |
| Settings | `/admin/settings` | Site settings, seller identity, GST presence toggle | verified |
| Audit log | `/admin/audit-log` | Every privileged action recorded | verified |
| Exports | `/admin/export` | CSV of orders/customers/products | verified |
| Password resets | `/admin/password-resets` | Reset requests recorded for the studio | verified |

## 6. Machines

| Flow | Entry | What happens | Status |
| --- | --- | --- | --- |
| Health | `/api/health`, `?deep=1` | Database `SELECT 1`, backend `/health`, mail env pair; 200 only when all ready | verified |
| Razorpay webhook | `/api/webhooks/razorpay` | Signature checked, `payment.captured` / `failed` / `refund.processed` | verified (signature logic) |
| Resend webhook | `/api/webhooks/resend` | Svix HMAC verified by hand, raw body, ±300 s replay window | verified |
| Shiprocket webhook | `/api/webhooks/shiprocket` | Token-checked AWB/status updates → order tracking | verified |
| Seeds | `scripts/seed-launch-content.mjs` | Owners, rooms and newsroom inserted idempotently on every deploy | verified |
| Preflight | `scripts/preflight.mjs` | Secrets, placeholders, live-vs-test Razorpay, data checks, runtime health | verified |
| Backups | cron 02:15 → `scripts/backup-db.sh` | Nightly dump, log, archive check | verified |
| Go-live | `deploy/go-live.sh` | Eight ordered steps, each stopping on failure | built (never run on a real host) |

---

## Known gaps

| Gap | Why it is open | Unblocks when |
| --- | --- | --- |
| No order placed with a real card on the production build | Razorpay's modal needs a human tap; automation reached the card form and stopped | someone pays ₹1 on a test card and reads the confirmation |
| No live Razorpay keys | owner input | live key + secret + webhook secret supplied |
| GST lines unproven | `SELLER_GSTIN` is empty — the studio is below the registration threshold | GSTIN supplied, or confirmed unregistered and the toggle left off |
| Shiprocket is manual | no API user created | owner decides API user vs typing AWBs |
| No uptime alert | needs an external monitor account | point a monitor at `/api/health` |
| No error-tracking service | a log line plus an optional webhook is what ships | an account, or `ERROR_WEBHOOK_URL` set to a Slack/Discord hook |
| Never deployed to a host | no server, DNS or certificate yet | Lightsail box + A records, then `deploy/go-live.sh` |
