# SnehaVrinda Kala — Indian-Authentic Brand Website & Full Platform Build Plan

**Document type:** Brand strategy, visual direction, website experience, commerce product requirements, engineering architecture, operations, launch plan, and implementation brief  
**Prepared:** 6 November 2026  
**Brand:** SnehaVrinda Kala  
**Primary market:** India-first; domestic shipping and INR checkout first  
**Platform direction:** Next.js + TypeScript + Medusa v2 + PostgreSQL  
**Document status:** Master blueprint for transforming the existing project into a distinctive, production-ready Indian art and creative-commerce brand.

> **The central direction:** SnehaVrinda Kala must feel like a vibrant Indian art house with the reliability of a modern commerce brand. It must not look like a generic monochrome SaaS dashboard, a plain white Shopify template, or a random collection of ethnic motifs. The brand should feel colourful, tactile, warm, editorial, contemporary, and unmistakably connected to the people and practices behind Indian art.

---

## 1. Executive direction

SnehaVrinda Kala is an art-first creative-commerce brand: a place to discover, buy, commission, learn about, and collaborate around art in many forms.

The website must perform four jobs at once:

1. **Create desire:** communicate a recognisable brand world through colour, art direction, product photography, typography, illustration, and editorial storytelling.
2. **Make discovery easy:** help people explore products by art form, artist, material, region, colour, occasion, and use.
3. **Convert and serve:** support product variants, cart, checkout, payment, fulfilment, shipment tracking, returns, customer accounts, and order support.
4. **Grow a creator network:** let artists and partners apply, show their work, receive approved commissions, submit products, and eventually manage marketplace activity.

### 1.1 What success should look and feel like

A first-time visitor should understand within a few seconds that:

- SnehaVrinda Kala is about art in many forms—not only paintings or only handicrafts.
- The brand values Indian visual culture, regional art practices, contemporary creators, and handmade work.
- They can shop ready-made pieces, ask for something personal, discover artists, or explore stories.
- The site is trustworthy enough to place an order: clear prices, shipping, delivery estimates, policies, payment, and support.

The brand must be visually rich throughout the entire journey, not just on the homepage. Shop, product, artist, custom-art, journal, account, cart, checkout, and seller pages must all use the same designed system.

### 1.2 Confirmed technology direction

| Layer | Selected technology | Responsibility |
|---|---|---|
| Storefront | Next.js App Router + React + TypeScript | Public website, SEO pages, customer account, cart and checkout experience |
| Commerce backend | Medusa v2 | Catalog, pricing, cart, promotions, customers, orders, inventory, payment and fulfillment abstractions |
| Custom business modules | Medusa custom modules, workflows, API routes, subscribers and admin extensions | Artist, partner, commission, review, production, and future marketplace workflows |
| Database | PostgreSQL | Durable system of record |
| Cache / background work | Redis-compatible service | Cache, locks, queue/workflow support as appropriate to the deployment design |
| Editorial CMS | Sanity | Journal, craft stories, artist features, campaign pages and editorial homepage sections |
| Media storage | Amazon S3 + CloudFront | Product and artist images, public media, private commission reference uploads |
| Payments | Razorpay integration | UPI, cards, net banking, refunds and payment status; validate current provider compatibility and merchant eligibility |
| Shipping | Shiprocket API integration | Shipment booking, labels, tracking, NDR and returns where available to the account |
| Hosting | Vercel for storefront; AWS for backend/data/workers | Production runtime and delivery |
| Source control / CI | GitHub + GitHub Actions | Version control, automated checks and deployment |
| Infrastructure | Terraform | Repeatable cloud resources |
| Monitoring | Sentry + AWS CloudWatch | Errors, logs, metrics and alerting |
| Analytics / SEO | GA4, Search Console, Merchant Center | Acquisition, conversion, product discovery and organic-search measurement |

Use current supported stable versions at implementation time. Do not hardcode version numbers into the long-term architecture document; record exact versions in the repository lockfile and an architecture decision record.

### 1.3 Current project status that this plan assumes

The supplied 6 November 2026 audit describes an existing monorepo with `apps/backend`, `apps/storefront`, `apps/studio`, `packages/ui`, `packages/types`, and `packages/config-tailwind`. The storefront already has routes for home, shop, art forms, artists, custom art, seller, account, cart, checkout, journal, about, policies, and a design-system page. Docker Compose starts the backend, storefront, PostgreSQL, and Redis; the existing Medusa backend is connected.

This is therefore a **brand and product transformation of the existing application**, not an instruction to throw away the codebase and start a disconnected demo. Preserve working routes and infrastructure where sound, but do not preserve broken patterns merely to avoid refactoring.

The audit also reports important launch blockers: empty products and regions in the database, runtime failures in artist/commission modules, no completed Razorpay checkout, incomplete shipping integration, lint setup failures, a dependency audit with 95 findings including 9 critical at the time of the audit, a previously committed secret that must be treated as exposed, incomplete product/artist/article SEO, unoptimized images, and a seller portal that is only an MVP. These are explicit remediation items in this plan—not details to hide behind a visual redesign.

---

## 2. Brand positioning and personality

### 2.1 Brand idea

**SnehaVrinda Kala is a welcoming home for art in all its forms—made, curated, personalized, and shared by creators.**

The brand should connect Indian artistic heritage with present-day life. It should celebrate traditional and regional practices without treating them as museum objects, and welcome contemporary illustration, painting, sculpture, fibre art, craft, mixed media, creative kits, and custom work without diluting cultural context.

### 2.2 Working tagline directions

Choose one after owner review and test it in the logo, hero, packaging, and social bio. These are creative directions, not already-approved claims:

- **Art in every form. Stories in every piece.**
- **A little art. A lot of soul.**
- **Rooted in art. Made for living.**
- **Where every art finds a home.**

Avoid claims such as “100% handmade”, “sustainably made”, “direct from artisans”, “fair trade”, “GI-certified”, or “supports thousands of artists” unless the specific product, partner, and evidence support that claim.

### 2.3 Personality

- Warm and expressive, never loud for its own sake.
- Rooted in Indian visual culture, never costume-like or stereotyped.
- Contemporary and easy to use, not overly traditional or difficult to navigate.
- Artist-first and respectful, not patronising.
- Curious, educational, and welcoming to beginners.
- Premium in presentation, but not cold or inaccessible.

### 2.4 Brand voice

Use human, sensory, specific language. Explain what a piece is, who made it, how it was made, what makes it special, and how it can live with the customer.

**Use:** “Painted by hand in layers of indigo and mineral-inspired colour”; “Made to order; allow approximately 10–14 working days”; “Meet the artist behind this collection.”  
**Avoid:** “Ethnic vibes”; “exotic tribal art”; generic “Indian culture at its best”; fake urgency; invented artisan biographies; unverifiable sustainability or livelihood claims.

For regional or community-specific craft, use the accepted name, location, community attribution where appropriate, technique, material, and source of information. Have knowledgeable practitioners review descriptions before publishing. Do not casually mix sacred, ritual, or community motifs into unrelated decorative patterns.

---

## 3. Competitor research and strategic opportunity

This is a qualitative review of public-facing brand positioning, navigation, merchandising, and storytelling. It is not a private analytics audit or conversion-rate study. Public websites and catalogues change; revisit them before final design sign-off.

| Reference | Visible strength / pattern | Lesson for SnehaVrinda Kala | Our opportunity |
|---|---|---|---|
| [Zwende](https://www.zwende.com/) | Artist-created products, personalization, occasion-led shopping, creator visibility | Make customisation and the maker easy to discover | Support many art forms, not only giftable home/lifestyle products; create a complete commission journey with request, quote, proof, production, and tracking |
| [iTokri](https://itokri.com/) | Craft- and textile-led discovery, browse by craft/material/colour, product trust, visible operational details | Category architecture and craft metadata matter; explain real product differences and service policies | Extend craft storytelling into fine art, contemporary art, custom requests, kits, and creative experiences |
| [Okhai](https://okhai.org/) | Artisan-community story, contemporary handcrafted lifestyle collections, craft discovery | Explain the people and partnerships behind the range | Tell individual maker stories across multiple disciplines and provide a direct route from artist profile to product or commission |
| [Gaatha](https://gaatha.com/) and [Gaatha Shop](https://shop.gaatha.com/) | Research, craft documentation, films, artisan narratives, and commerce | Editorial content can teach, build trust, and create discovery beyond product grids | Create a tightly linked journey: story → art form → artist → product → commission/workshop |
| [Jaypore](https://www.jaypore.com/) | Curated lifestyle merchandising, collection-led visual storytelling | Use seasonal edits and curated collections to make large catalogues approachable | Lead with art and maker identity while still providing familiar shop categories |
| [Direct Create](https://www.directcreate.com/) | Collaboration between makers, designers, and buyers | Collaboration can be a product feature, not only a contact page | Build a clear collaboration brief and partner workflow, with status and scope management |
| [Chumbak](https://www.chumbak.com/) | Distinctive lifestyle identity, strong colour and recognizable product presentation | Build a consistent and memorable design language across every channel | Make the visual world more art-led, region-aware, and artist-attributed |

### 3.1 Design and product principles to borrow—not copy

1. From Zwende: personalization, occasion-led discovery, and creator attribution.
2. From iTokri: clear craft taxonomy, product-level details, transparency about handmade variations, and service reassurance.
3. From Okhai: a coherent story about makers and the way collections are developed.
4. From Gaatha: long-form craft stories, short films, and educational context.
5. From Jaypore and Chumbak: memorable campaigns, strong collection hierarchy, and visual merchandising.
6. From Direct Create: a structured route for collaboration and co-creation.

### 3.2 The positioning gap to own

Build a distinctive platform at the intersection of:

- a colourful Indian art and craft brand;
- a curated multi-discipline shop;
- a custom-art commission studio;
- an artist discovery and collaboration platform;
- an educational journal and creative community.

Do not try to compete on the number of SKUs in the first release. Compete on curation, strong visuals, useful information, maker credibility, customization, and dependable fulfilment.

---

## 4. Visual identity: the non-negotiable design direction

### 4.1 Creative concept: “The Living Indian Art House”

The website should feel like stepping into a contemporary Indian art house: layered paper, painted colour, textile borders, hand-drawn details, art displayed like a gallery, and warm editorial typography. Traditional visual cues should be used with restraint and contextual intelligence—not as a wallpaper pasted on every section.

**Visual adjectives:** colourful, joyful, tactile, curated, expressive, artisanal, warm, modern, editorial, human, rooted, premium.

**Do not design:** monochrome black-and-white pages; plain white cards on white backgrounds; default SaaS dashboard aesthetics; generic beige minimalism; random gradients; excessive drop shadows; generic mandala wallpaper; indiscriminate use of paisley/lotus/temple imagery; or a homepage that is only a row of identical product cards.

### 4.2 Colour system

The brand palette must be visible across the full site. Use a warm paper base, deep readable text, and rich accents. Each section should have a clear colour role; do not use every colour in every component.

#### Core brand palette

| Token | Hex | Role |
|---|---|---|
| `rang-paper` | `#FFF7E8` | Warm primary canvas, like handmade paper |
| `marigold` | `#E6A72E` | Optimistic highlight, campaign band, badge accent |
| `sindoor` | `#C84636` | Primary action, important emphasis, warm red sections |
| `kumkum` | `#9F2947` | Deep rose/wine accent for editorial or festive moments |
| `peacock` | `#176D6A` | Teal section, trust/availability accent, secondary action |
| `indigo` | `#263A63` | Deep blue section, footer, editorial contrast |
| `leaf` | `#557447` | Nature/green accent and craft storytelling |
| `haldi` | `#F0C45B` | Bright warm yellow for feature blocks and highlights |
| `gulabi` | `#D98291` | Rose-pink decorative accent and collection tile |
| `terracotta` | `#B96E4B` | Earthy section accent and craft material storytelling |
| `deep-ink` | `#2B211E` | Main text on light backgrounds |
| `muted-ink` | `#675A52` | Supporting text on light backgrounds |
| `sand-border` | `#DCCBB4` | Borders, dividers, restrained outlines |
| `surface` | `#FFFCF5` | Product and form surfaces where needed |

#### Colour application rules

- The homepage must use at least four distinct visual colour moments: hero, collection/art-form blocks, feature/story band, and footer/newsletter or closing CTA.
- Use coloured section backgrounds deliberately: marigold, peacock, indigo, sindoor, leaf, rose, or terracotta. Alternate them with warm paper, not with endless white.
- Product cards may use warm paper or a quiet surface so the artwork remains the focus, but category tiles and editorial blocks should be visibly colourful.
- Keep primary buttons high-contrast and consistent. `sindoor` can be the primary action colour on light surfaces; use warm paper/white text only when contrast passes.
- Never put small low-contrast text over busy art photography. Add a solid/gradient overlay only when tested for readability.
- Do not use colour alone to communicate status. Pair status colour with a label and/or icon.
- Check all text/button combinations against WCAG 2.2 AA contrast targets. Adjust tokens only through the design system, not one-off page overrides.

### 4.3 Typography

Use a maximum of two main type families plus a script accent only if it remains readable and is used sparingly.

- **Display/editorial:** Cormorant Garamond (or a similarly expressive serif with good web performance) for large headings, collection titles, and editorial pull-quotes.
- **Body/UI:** Manrope for product information, navigation, labels, forms, and utility text.
- **Regional scripts:** Noto Sans Devanagari or the relevant Noto family only for regional-language content after language review. Do not use decorative scripts for body copy.
- **Optional logo detail:** custom lettering or a small hand-drawn emblem; do not use a novelty script font for the entire brand name.

Typography hierarchy should be editorial and generous: large expressive H1s, clear H2s, short readable paragraphs, carefully spaced captions, and strongly legible product specifications.

### 4.4 Logo and identity assets

Create a real identity system, not just styled text in a header:

1. Primary horizontal wordmark: `SnehaVrinda Kala`.
2. Compact monogram/emblem for favicon, social avatar, packaging seal, and small UI locations.
3. Single-colour variants for stamps and packaging.
4. Light and dark-background logo variants.
5. Clear-space and minimum-size rules.
6. A subtle supporting mark based on a hand, petal, brushstroke, or abstract form—but not a literal collage of sacred symbols.

Do not invent a Devanagari spelling for the brand without native-language confirmation. The English wordmark is the approved working form until the owner signs off on regional-script lockups.

### 4.5 Indian craft motifs and pattern language

Use a small, carefully art-directed set of patterns:

- block-print-inspired repeat borders;
- jaali-inspired geometric lattice;
- rangoli-inspired radial geometry;
- hand-painted floral/vine linework;
- woven stripe or textile selvedge details;
- abstract brush and pigment textures;
- paper grain and hand-cut collage edges.

**Rules:**

- Commission or create original SVG patterns for the brand wherever possible.
- Use motifs as borders, section transitions, labels, and background details—not as distracting wallpaper behind product text.
- If a pattern references a specific regional art tradition, identify it accurately and have the design reviewed. Do not label a generic geometric pattern as Madhubani, Warli, Kalamkari, Gond, or another named tradition.
- Respect sacred/community-owned imagery and avoid using motifs without appropriate permissions or context.
- Keep decorative assets lightweight, responsive, and accessible (`aria-hidden` when purely decorative).

### 4.6 Photography and image art direction

Photography is the most important ingredient in making the site feel like a real art brand. A palette alone will not solve a generic-looking website.

#### Image types required

- Product images: clear front/primary view, detail close-up, scale/context, back/side if relevant, packaging, and variant images.
- Artist portraits: natural, respectful, consistent crop, permission recorded.
- Process photography: hands making, tools/materials, work in progress, studio/environment.
- Editorial images: collections, art-in-living spaces, festive settings, art-making moments, workshops.
- Art-form illustrations: only where photography is not available; label them as illustrations, not as product photographs.

#### Photography rules

- Use actual product/artist images for real catalogue and maker pages. Never represent generated stock imagery as a real artist, community, workshop, or product.
- Keep the artwork colour-accurate. Avoid filters that distort the actual product.
- Prefer natural window light, tactile surfaces, and lived-in settings over sterile cut-outs alone.
- Use a mix of close details and full context. Show scale with a hand, person, wall, table, or other reference where suitable.
- Obtain usage permission and model/property releases where needed. Record the image credit, artist, source, usage rights, and alt text in the media workflow.
- Use descriptive alt text for informative images; empty alt for purely decorative elements.
- Use responsive AVIF/WebP variants and `next/image`; keep originals in S3.

#### Homepage hero art direction

Use a vivid, art-led, full-width composition. The image must show real, approved artwork or a real creative scene. Do not use a generic stock photo of an Indian-looking room with a vague ethnic object. The headline and CTA must remain legible on mobile. A split layout is acceptable: large hero artwork on one side and a confident colour field with brand message on the other. A full-bleed image with an accessible overlay is also acceptable.

### 4.7 Component design language

- Buttons: confident, rounded or softly squared, with clear hierarchy and tactile hover/focus states.
- Cards: curated and varied; use image-first cards, editorial cards, artist cards, art-form tiles, and product cards as separate patterns.
- Badges: “Ready to ship”, “Made to order”, “One of a kind”, “Custom commission”, “New” with text and accessible colour.
- Section headings: editorial serif heading, short explanatory line, clear “Explore all” link.
- Borders: occasional hand-drawn, textile-edge, or fine warm border; avoid heavy generic shadows.
- Icons: one consistent icon family (Lucide or equivalent); combine with labels where meaning is not obvious.
- Buttons and links must have visible hover, pressed, disabled, loading, and keyboard-focus states.

### 4.8 Motion and interactions

Motion should make the brand feel alive without slowing shopping:

- gentle reveal on scroll (respect `prefers-reduced-motion`);
- subtle image scale on hover;
- smooth but quick menu and filter transitions;
- cart drawer with clear focus management;
- soft animated brush/line detail only in a few brand moments;
- no autoplay audio, no aggressive parallax, no long intro animation, no essential information hidden until animation completes.

### 4.9 Required visual acceptance rule

A reviewer must be able to scroll through the whole website and see a consistent branded experience. If the first fold is colourful but product, artist, custom-art, account, checkout, and journal pages revert to plain black text on blank white screens, the redesign is not complete.

---

## 5. Site architecture and navigation

### 5.1 Main navigation

- **Shop**
- **Art Forms**
- **Artists**
- **Custom Art**
- **Journal**
- **About**
- Primary header actions: Search, Account, Wishlist (when implemented), Cart.

A small announcement strip may be used for a real operational message such as dispatch cut-off, a new collection, or a confirmed festive campaign. Do not keep fake urgency or permanent countdowns.

### 5.2 Shop mega-menu

**Shop by category:** Painting & Drawing; Home & Decor; Textile & Fibre; Jewellery & Accessories; Paper & Stationery; Wearable Art; DIY & Kits; Gifts.  
**Shop by art form:** Madhubani, Gond, Kalamkari, Warli, Pattachitra, miniature painting, block printing, embroidery, weaving, pottery, sculpture, illustration, calligraphy, mixed media—only activate a specific art form when accurate product inventory and reviewed content exist.  
**Shop by:** Artist; Material; Colour; Occasion; Price; New arrivals; One-of-a-kind; Ready to ship.

### 5.3 Responsive navigation

- Desktop: full navigation with a designed mega-menu and featured art-form tile.
- Tablet: simplified nav with accessible drawer.
- Mobile: clear top bar and compact menu; consider bottom quick navigation for Home, Explore, Custom Art, Account, and Cart if it improves usability.
- Menu must support Escape, focus management, screen readers, and touch.

### 5.4 URL plan

Use stable, readable, lowercase URLs. Examples:

```text
/
/shop
/shop/painting-drawing
/shop/home-decor
/art-forms
/art-forms/madhubani
/art-forms/kalamkari
/artists
/artists/{artist-slug}
/products/{product-slug}
/collections/{collection-slug}
/custom-art
/custom-art/request
/commission-status/{reference}
/journal
/journal/{article-slug}
/workshops
/about
/our-story
/partner-with-us
/sell
/account
/cart
/checkout
/contact
/shipping-returns
/faqs
```

Avoid multiple indexable URLs for the same filtered catalogue. Define canonical rules for sort/filter/query combinations.

---

## 6. Full page-by-page website experience

### 6.1 Homepage

The homepage is the main brand statement. It must be visually rich and editorial, not a basic set of product rows.

Recommended section order:

1. **Announcement bar:** one current, factual message.
2. **Branded header:** wordmark, mega-menu, search, account, cart.
3. **Hero:** full-width approved artwork/artist scene, expressive headline, short statement, two CTAs—`Explore the collection` and `Request custom art`.
4. **Art forms we love:** colourful image tiles, each with name and short descriptor. Use different tile sizes/asymmetry to create visual rhythm.
5. **Curated collection feature:** e.g. “The Colourful Home Edit”, “Made by Hand”, “Little Art, Big Joy”, or a seasonal edit; only publish collections with real products.
6. **Shop by intention:** Gifts, Home, Wearable, Collectibles, Creative Kits, Custom Art.
7. **Meet the artists:** large portrait cards with discipline, location if approved, and links to profiles.
8. **The story behind the art:** a visual storytelling band with process images and a journal link.
9. **Custom art studio:** clear three/four-step explanation and a strong CTA.
10. **Fresh from the journal:** articles, artist interviews, craft explainers, video stories.
11. **Social gallery:** approved Instagram/YouTube content, not a dependency for page load.
12. **Trust and service strip:** secure payments, shipping, customer support, return policy—only state policies that are active.
13. **Newsletter:** invite visitors to receive new collections, artist stories, and workshops.
14. **Rich footer:** navigation, contact, policies, social links, newsletter status, payment and shipping information.

At least four major sections should use visible colour fields. Avoid repeating the same white product grid section again and again.

### 6.2 Shop landing page

- Strong shop heading and editorial intro.
- Category tiles before product listing.
- Search input and useful filter/sort controls.
- Filters: category, art form, artist, price range, availability, material, colour, occasion, size/format, ready-to-ship vs made-to-order.
- Sort: featured, newest, price low-high, price high-low, best-selling only if reliable sales data exists.
- Product cards: image, title, price, artist/creator where approved, type/status badge, optional short material/craft descriptor.
- Empty state with related art-form links, not a blank screen.
- Pagination or crawlable pagination with clear URLs. Do not hide all products behind client-only search.

### 6.3 Art-form landing page

Every art-form landing page should be a useful destination, not merely a filtered category.

Include:

- Name, concise description, and accurate region/community context.
- A strong approved image or illustration.
- How the process works (reviewed and sourced).
- Materials/tools and visual characteristics.
- Artists practicing or interpreting the form, with their consent and accurate attribution.
- Products/collections related to the form.
- Journal/video links.
- FAQ or care guidance where useful.

Do not create dozens of thin pages with copied descriptions. Publish only pages with genuine content and relevant inventory or educational value.

### 6.4 Product detail page

Product page content should make the artwork desirable and answer buyer questions before checkout.

Required elements:

- Image gallery: primary image, detail shots, scale/context, variant-specific images; zoom/lightbox with keyboard support.
- Product name, price, availability, SKU where appropriate, artist/maker attribution.
- Short summary and long description.
- Product type: ready to ship / made to order / one of a kind / customisable.
- Variant selectors: size, colour, material, frame, finish, etc. as configured.
- Personalization inputs: text/photo/reference upload with safe validation and consent.
- Production/dispatch estimate, shipping estimate where calculable, and return/cancellation summary.
- Materials, dimensions, technique, origin, care instructions, and what is included.
- Handmade variation note where applicable.
- Artist card and maker story.
- Add to cart, quantity, wishlist, and clear error/success states.
- Related products, related art form, and “You may also like”.
- Product structured data in the initial server-rendered HTML.

Do not claim that a product is handmade, original, signed, certified, or made in a named region unless the product record contains verified data.

### 6.5 Artist directory and artist profile

**Artist directory:** filter by discipline/art form, available-for-commission status, and region when publicly approved. Use portrait-led cards and short bios.

**Artist detail page:**

- Portrait and artist name.
- Short bio in the artist's own/approved words.
- Disciplines and selected work.
- Process and materials.
- Region/location only with consent and at a safe level of precision.
- Products and available commissions.
- Social links only if explicitly supplied and approved.
- Clear commission CTA.

Do not show private contact details, home addresses, payout data, application documents, or non-public identity information.

### 6.6 Custom Art / Commission studio

This is a key differentiator and must not be a generic `Contact us` form.

Landing page:

- Explain what can be requested: portraits, paintings, illustration, personalized gifts, décor, event artwork, murals, corporate projects, and other supported categories.
- Show real examples and indicative “starting from” prices only when approved and maintained.
- Explain the process: share idea → review and quote → approve scope/payment → preview/progress → final creation → dispatch/delivery.
- Explain typical timelines and revision terms.
- FAQ about reference photos, copyright, revisions, deposits, cancellation, and delivery.
- CTA to start a request.

Request form fields:

- Name, email, mobile/WhatsApp (with consent), preferred contact method.
- Request category and art form.
- Description/brief.
- Reference images/files (private upload, type/size limit, signed URL).
- Intended use/occasion and recipient details if relevant.
- Preferred size/material/colour/style.
- Budget range and target date.
- Shipping city/pincode (full delivery address only when needed later).
- Consent to use submitted materials for the commission; separate optional consent for public portfolio use.

Workflow statuses:

`submitted → under_review → needs_information → accepted_for_quote → quote_sent → awaiting_customer_approval → awaiting_payment → scheduled → in_progress → proof_ready → revision_requested → approved → completed → packed → shipped → delivered`

Alternative terminal states: `declined`, `cancelled`, `expired`, `refunded`, `disputed`.

Every transition should record who changed it, when, the reason, customer-visible note, internal note, and relevant files. Make the customer-facing status understandable; do not expose internal notes.

### 6.7 Journal / Stories

Editorial areas:

- Artist interviews and studio visits.
- Art-form explainers and process stories.
- Material and care guides.
- Gift guides and seasonal edits.
- Behind-the-scenes videos.
- Workshops and creative learning.

Each article needs author/editor, publish date, reviewed facts, hero image and credits, SEO title/description, canonical URL, internal links, art-form/artist references, and optional related products. Use Sanity for editorial structure.

### 6.8 About / Our story

Tell why SnehaVrinda Kala exists, what “all art forms” means, how artists are selected, how quality is reviewed, and how customers can collaborate. Use real team/artist imagery. Avoid exaggerated impact metrics.

### 6.9 Partner with us / Sell with us

Explain:

- who can apply;
- acceptable art/product categories;
- review/selection process;
- quality and authenticity requirements;
- photo and description standards;
- pricing/commission or commercial structure at a high level;
- production, dispatch, packaging, returns, and communication expectations;
- rights, attribution, and content permissions;
- payout process after the commercial/legal model is approved.

Application fields: identity/business details, portfolio links, art disciplines, location at an appropriate level, product examples, production capacity, material/technique information, preferred collaboration type, and consent to terms. Uploaded documents are private.

### 6.10 Customer account

- Register/login/logout.
- Email verification and password reset.
- Profile and address book.
- Orders and order detail pages.
- Shipment tracking.
- Commission requests and status.
- Wishlist (once implemented).
- Preferences and notification opt-ins.
- Support/contact options.

### 6.11 Cart and checkout

- Persistent cart with server-side validation.
- Revalidate prices, stock, product availability, and custom options on the server.
- Clear ready-to-ship vs made-to-order dispatch messaging.
- Address validation and pincode serviceability where supported.
- Shipping charge and tax transparency before payment.
- Razorpay payment flow with verified server-side state.
- Guest checkout only if operationally supported and safe; account creation should not be forced unnecessarily.
- Order confirmation page, email/WhatsApp notification with opt-in, and next-step information.
- Clear failure/retry path; no false order-success message before backend confirmation.

### 6.12 Support, policy, and utility pages

Create real, reviewed content for:

- Contact/support.
- FAQs.
- Shipping and delivery.
- Returns, refunds, and cancellations.
- Privacy notice.
- Terms of use.
- Seller/artist agreement and submission terms.
- Custom commission terms.
- Payment and tax/invoice information.
- Accessibility statement or contact route for assistance.

Do not publish generic placeholder legal copy as a substitute for India-specific legal review.

---

## 7. E-commerce functionality and operational requirements

### 7.1 Catalogue model

Every product must support a deliberate product type and consistent required fields.

**Shared product fields:** title, handle, SKU, description, category, collection, media, status, price, tax configuration, inventory policy, weight/dimensions, SEO fields, artist/partner attribution, tags, and timestamps.

**Art-specific fields:**

- art form / discipline;
- maker/artist;
- technique;
- material;
- region or origin (only when verified);
- year/edition/numbered status if applicable;
- one-of-a-kind or reproducible status;
- dimensions/format;
- framing/finish options;
- care instructions;
- authenticity/provenance evidence where applicable;
- image credits and permission record.

**Fulfilment-specific fields:** ready stock quantity, production lead time, dispatch SLA, made-to-order capacity, package size/weight, fragile handling, shipping restrictions, and return eligibility.

### 7.2 Product lifecycle

`draft → content_review → quality_review → approved → published → archived`

Do not let a product become publicly purchasable until it has an approved price, image rights, description, inventory/production model, fulfilment promise, category, seller model, and tax configuration.

### 7.3 Order operations

Admin order workspace should show:

- order number and customer;
- payment status and transaction reference;
- line items and variants;
- stock vs made-to-order status;
- artist/partner assignment;
- dispatch deadline and production due date;
- shipping label, AWB, courier, and tracking;
- customer communication timeline;
- cancellation/refund state;
- exception flags (address issue, delay, NDR, damage, missing stock).

### 7.4 Inventory and production

- Track physical stock for ready-to-ship goods.
- Track production capacity and lead time for made-to-order work.
- Prevent overselling where stock is limited.
- Reserve stock during checkout according to the Medusa inventory strategy.
- Reconcile cancellations, returns, replacements, and damaged goods.
- Store a committed dispatch date separately from a marketing estimate.

### 7.5 Promotions and gifting

Support coupon codes, collection promotions, free-shipping thresholds, gift wrap, gift notes, and seasonal campaigns. Keep promotional rules clear; do not let discount logic override artist payout or margin rules without approval.

### 7.6 Reviews and UGC

Add verified-purchase reviews only after order records can validate the purchaser. Moderate photo/video submissions and obtain permission before using them in marketing. Do not fabricate star ratings, testimonials, or review counts.

---

## 8. Artist, partner, and marketplace modules

### 8.1 Artist module

Owns artist profile, disciplines, portfolio, biography, approved public links, consent, availability, verification status, and publication status.

Suggested profile states:

`application_submitted → under_review → more_information_requested → approved → active → paused → suspended → rejected`

### 8.2 Partner module

Owns legal/business identity record, agreements, commercial model, operational contacts, tax/invoice details under restricted access, capability tags, production capacity, service levels, and relationship status.

### 8.3 Product submission and moderation

Partner submission should create a draft submission, not a public product directly. Admin reviews title, content, media rights, material/technique, pricing, SKU, stock, lead time, packaging, and claims before publishing.

### 8.4 Commission assignment

Operations can:

- review requests;
- request missing information;
- shortlist qualified artists;
- assign work;
- agree scope and deadline;
- issue quote/draft order/payment request;
- record proofs and customer approvals;
- track changes and final delivery.

### 8.5 Marketplace expansion

Only after the central model is stable, evaluate independent vendor checkout and settlement. The future marketplace design must handle:

- vendor-specific products and inventory;
- customer cart lines from multiple vendors;
- parent order and child/vendor orders;
- separate fulfilment and delivery status;
- partial shipment;
- partial cancellation and refunds;
- marketplace commission and tax ledger;
- seller statements and disputes;
- settlement reconciliation;
- permissions and access isolation.

Razorpay Route may be evaluated for split transfers, but availability, onboarding, account requirements, fees, and compliance must be confirmed directly with Razorpay before promising automated seller payouts. See [Razorpay Route](https://razorpay.com/route/).

---

## 9. Admin and internal operating studio

Use Medusa Admin as the commerce base and extend it with custom admin routes/widgets where appropriate. The existing `apps/studio` can remain the internal operating interface if it has a clear reason to exist; avoid building two competing admin systems.

### 9.1 Admin roles

- Owner / Super Admin.
- Catalogue Manager.
- Order Operations.
- Commission Manager.
- Artist/Partner Manager.
- Content Editor.
- Customer Support.
- Finance / Reconciliation (restricted).

Apply least privilege. Finance details, customer reference uploads, identity documents, and payout information require tighter permissions than product content.

### 9.2 Admin navigation

- Overview / daily work queue.
- Products and collections.
- Orders and fulfilment.
- Custom commissions.
- Artists.
- Partners / applications.
- Product submissions and quality review.
- Inventory and production capacity.
- Refunds and payment reconciliation.
- Content publishing links / Sanity.
- Social connections and import queue.
- Reports and audit log.
- Settings and staff permissions.

### 9.3 Operational dashboard widgets

- Orders awaiting action.
- Payments needing reconciliation.
- Shipments delayed / NDR.
- Commissions awaiting quote or customer approval.
- Artist applications awaiting review.
- Product submissions pending approval.
- Low stock / production-capacity warnings.
- Refunds awaiting action.

Every metric must come from real data and include the time window. Never use hardcoded demo numbers in a production dashboard.

---

## 10. Social media and content integrations

Social content should enrich the website but must never be a dependency for the site to load.

### 10.1 Instagram

Use supported Meta/Instagram APIs or approved embed mechanisms for eligible public business content. Store credentials server-side. Cache imported content. Provide manual selection/approval before a post appears on the website. Do not scrape private endpoints or bypass platform limits.

### 10.2 YouTube

Use YouTube Data API for approved channel/video information and standard YouTube embeds for playback. Cache video metadata and thumbnails. Store channel ID and API key server-side. Do not let an API quota failure break the Journal or homepage.

### 10.3 X (Twitter)

Use official embeds or the current X API only if the commercial value justifies its access and pricing. Keep a manual announcement fallback. X API costs and terms can change; verify current plan and rate limits before implementation.

### 10.4 Social publishing workflow

Admin should choose which posts/videos are featured, add a short caption, select a collection/artist/article destination, set display order, and approve or remove the item. The site should show only approved content, not every post automatically.

### 10.5 Newsletter

Use a dedicated email marketing provider only after comparing consent, deliverability, data location, pricing, and integration needs. Store subscription consent and unsubscribe state. No pre-ticked opt-in boxes.

---

## 11. Content management and brand operations

### 11.1 Sanity content types

- Homepage campaign/section.
- Journal article.
- Art-form editorial page.
- Artist story reference (public display data can be synchronized from the backend; avoid conflicting master records).
- Collection editorial intro.
- FAQ entry.
- Workshop/experience page.
- Announcement/promo strip.
- Testimonial/review display only from verified/consented source.

### 11.2 Content workflow

`draft → editorial_review → fact/attribution_review → approved → scheduled/published → archived`

The editor should be able to change page content, order of homepage sections, collection features, hero media, CTA text, journal articles, and campaign banners without a developer. The editor should not be able to change business-critical prices, payment status, artist payout amounts, or shipping state through the CMS.

### 11.3 Editorial calendar

Build a manageable calendar around:

- new artist introductions;
- art-form explainers;
- behind-the-scenes/process stories;
- seasonal/festival collections;
- gifting guides;
- creative tutorials;
- new product launches;
- workshop announcements.

Festival content should be culturally reviewed, timed accurately, and relevant to the products available. Avoid using every Indian festival as a generic sales theme.

---

## 12. Technical architecture

### 12.1 System overview

```text
Customer / Artist / Admin
          |
          v
Next.js App Router (public storefront + account + artist portal)
          |
          | HTTPS / server actions / API client
          v
Medusa v2 backend (commerce + custom modules + workflows)
          |
   +------+-------------------+-------------------+
   |                          |                   |
   v                          v                   v
PostgreSQL                 Redis              S3 / CloudFront
   |                          |                   |
   +--------------------------+-------------------+
          |
          +---- Razorpay payment provider / webhooks
          +---- Shiprocket fulfilment adapter / webhooks
          +---- Sanity CMS (editorial content)
          +---- Meta / YouTube / X adapters
          +---- Email / WhatsApp notification provider

Admin users -> Medusa Admin + custom admin extensions / internal Studio
```

### 12.2 Backend domain boundaries

Keep a modular monolith. Suggested modules:

1. **Commerce:** Medusa core products, variants, pricing, cart, promotions, customers, orders, inventory, payment, fulfilment.
2. **Artists:** profiles, disciplines, portfolio, availability, application state, consent.
3. **Partners:** agreements, capabilities, terms, operational records, restricted commercial data.
4. **Commissions:** request, attachments, quote, scope, milestones, proofs, revisions, status history.
5. **Catalogue governance:** submission, review, approval, provenance and media-rights records.
6. **Marketplace (later):** vendor ownership, seller roles, order allocation, vendor statements and settlement data.
7. **Integrations:** provider credentials, webhook events, delivery attempts, idempotency records and reconciliation.
8. **Notifications:** templates, events, preferences, delivery attempts and unsubscribe/consent.
9. **Social content:** connected channels, imported metadata, approved feed items and cache state.

### 12.3 Database ownership

- Medusa owns commerce data.
- Custom Medusa modules own artists, partners, commissions, and internal workflow data.
- Sanity owns editorial content.
- S3 stores binaries; the database stores metadata, ownership, permissions, and references.
- Redis is ephemeral infrastructure, not the system of record.

Do not create a second independent products/orders/customers database in the storefront. Do not copy payment card data into our database. Use provider tokens and references only.

### 12.4 Frontend rendering strategy

- Server-render public product, category, art-form, artist, and journal pages for crawlability.
- Use cached/revalidated data for public catalogue and editorial pages.
- Keep customer-specific account, cart, checkout, and commission status pages private/dynamic.
- Use client components only where interaction needs them: filters, gallery, cart drawer, variant selectors, form steps, and dashboard widgets.
- Use explicit cache tags/revalidation after product/content updates.
- Never make live API calls to Instagram/YouTube/X in the critical render path.

### 12.5 Search

Launch with robust server-side catalogue search and filters using the commerce backend/database. Add a dedicated search engine such as Meilisearch or Typesense only when catalogue size, typo tolerance, faceting, or query performance justifies it. Keep search indexing asynchronous and rebuildable from source records.

### 12.6 Image delivery

- Store original uploads in S3.
- Generate responsive AVIF/WebP renditions and thumbnails.
- Use `next/image` with explicit remote allow-list and correct dimensions.
- Use CDN caching and sensible immutable filenames for transformed assets.
- Separate public product media from private commission and seller-application files.
- Never expose permanent public URLs for private reference uploads.

### 12.7 API conventions

- Validate requests with schemas at the boundary.
- Use typed domain services; avoid `any` in core business logic.
- Apply authentication and authorization at the server/API boundary.
- Use stable error codes and customer-safe messages.
- Add pagination, sorting, and filter limits to list endpoints.
- Rate-limit login, password reset, uploads, commission submission, and public forms.
- Version custom public APIs where breaking changes are possible.

---

## 13. Proposed repository structure

Preserve the existing monorepo where practical; align names without creating unnecessary package churn.

```text
snehavrinda-kala/
├── apps/
│   ├── backend/                 # Medusa v2 backend
│   │   ├── src/modules/         # artists, partners, commissions, etc.
│   │   ├── src/workflows/
│   │   ├── src/api/
│   │   ├── src/subscribers/
│   │   ├── src/links/
│   │   ├── src/jobs/
│   │   └── src/admin/           # admin widgets and UI routes
│   ├── storefront/              # Next.js public site + account + artist portal
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── lib/
│   │   ├── styles/
│   │   └── public/
│   └── studio/                  # only if a distinct internal workbench is justified
├── packages/
│   ├── ui/                      # shared brand components and tokens
│   ├── types/                   # shared API/domain types
│   ├── config-tailwind/         # shared design tokens / Tailwind config
│   ├── eslint-config/
│   └── tsconfig/
├── docs/
│   ├── brand/
│   ├── design-system/
│   ├── architecture/
│   ├── adr/
│   ├── operations/
│   └── launch/
├── infra/                       # Terraform and deployment definitions
├── scripts/                     # seed, sync, migration utilities
├── .github/workflows/
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── docker-compose.yml
└── README.md
```

Root workspace commands must work consistently:

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm audit
```

Document app-specific commands as well. The root package manifest and CI scripts must be non-interactive.

---

## 14. Existing audit remediation: what must be fixed before production

This section converts the supplied project audit into an implementation order.

### P0 — production blockers

1. **Rotate exposed secrets:** revoke/rotate the token that appeared in Git history and any related secrets. Treat all previously committed secrets as compromised. Use a secrets manager; never re-add them to code or docs.
2. **Fix custom Medusa runtime modules:** artist and commission endpoints currently return 500 due to module/service resolution and model metadata failures. Implement them with supported Medusa v2 module/data-model/service patterns, register the modules correctly, create migrations, and test runtime resolution. Do not stop at TypeScript compilation.
3. **Create a deterministic seed process:** create the INR region, sales channel, publishable API key link, categories, sample products, artists, and commission test records in local/staging environments. Production seed should be intentional and idempotent.
4. **Complete checkout:** implement Razorpay payment session/order creation, server-side payment verification, Medusa order completion, failure/retry handling, duplicate callback protection, and webhooks. Never mark an order paid from a browser redirect alone.
5. **Complete fulfilment integration:** implement shipment booking and tracking sync only after payment/order states are correct. Handle failed booking, label failure, NDR, cancellation, and returns.
6. **Triage dependency vulnerabilities:** audit the lockfile, investigate the 9 critical and 34 high findings reported on 6 November 2026, upgrade/replace packages, and rerun audit. Do not assume all findings are exploitable, but do not ignore them.
7. **Fix root developer workflow:** add root `package.json`, workspace scripts, consistent dependency installation, and non-interactive lint/typecheck/build/test commands.
8. **Fix lint and CI:** add maintained ESLint configuration and dependencies for backend and storefront; make lint run without prompts.
9. **Fix product/artist media mapping:** remove invalid artist URL construction and ensure every image reference resolves to a public asset or authorized private file.
10. **Verify legal, tax, policy, and seller model:** complete CA/legal review before collecting live orders or onboarding independent sellers.

### P1 — before public beta

1. Add page-specific SEO metadata for product, collection, artist, art form, and journal routes.
2. Add dynamic sitemap entries for all indexable products, artists, collections, art forms, and articles.
3. Add Product/Offer, Organization, BreadcrumbList, Article, and relevant structured data.
4. Convert raw `<img>` usage to `next/image` or a documented optimized image pipeline.
5. Add cache/revalidation for public catalogue and CMS pages; retain dynamic rendering for private pages.
6. Add Content Security Policy after reviewing trusted scripts, embeds, fonts, and analytics.
7. Replace `console.log` with structured logging; tighten weak `any` usage in custom modules.
8. Complete email verification, password reset, customer address book, order detail, and tracking.
9. Complete seller application review and commission workflow.
10. Add Playwright smoke tests and accessibility checks.
11. Implement the complete visual design system and apply it to all public and transactional pages.

### P2 — growth capabilities

- Wishlist and verified reviews.
- Search autocomplete and advanced filters.
- Artist self-service portal.
- Product submission and approval queue.
- Workshops/experiences.
- Corporate gifting and bulk enquiries.
- More languages and regional content.
- Vendor order splitting and payout workflows after legal/financial design.
- Advanced recommendations and analytics.

---

## 15. Security, privacy, and compliance

### 15.1 Authentication and authorization

- Secure, httpOnly, sameSite cookies for session/token handling as appropriate.
- Email verification and password reset.
- Rate limiting and account-abuse protections.
- MFA for administrative users; role-based permissions.
- Server-side authorization for every private customer/artist/partner record.
- Session revocation and logout behavior.
- Never trust user-supplied IDs without checking ownership/permissions.

### 15.2 Payments and webhooks

- Verify provider signatures.
- Store unique provider event IDs and enforce idempotency.
- Handle out-of-order and duplicate webhook events.
- Reconcile provider settlement reports with order/payment records.
- Never store card PAN/CVV or other prohibited payment credentials.
- Restrict refunds and payout actions to authorized roles with audit records.

### 15.3 File uploads

- Signed upload URLs with short expiry.
- Type, size, and content validation.
- Malware scanning where practical.
- Randomized storage keys; no user-controlled path traversal.
- Private object ACLs for customer/artist application files.
- Retention and deletion policy for unused commission references.
- Consent and ownership statement for uploaded reference images.

### 15.4 Privacy and Indian compliance review

Before launch, obtain qualified advice on applicable Indian privacy/data-protection requirements, consumer protection and e-commerce rules, GST registration/invoicing/TCS where relevant, payment-provider onboarding, advertising claims, intellectual-property rights, artist agreements, and cross-border shipping/customs. Build systems that can record consent, purpose, data access, retention, and deletion requests. Do not treat this blueprint as legal advice.

### 15.5 Security headers and operations

- HTTPS everywhere; HSTS in production.
- Content Security Policy.
- `X-Content-Type-Options`, `Referrer-Policy`, permissions policy, framing protection.
- WAF/rate limiting at edge where appropriate.
- Secrets in a managed secrets store.
- Dependency scanning and secret scanning in CI.
- Encrypted database backups and tested restores.
- Audit trail for admin and financial actions.
- Production/staging/local environments isolated.

---

## 16. SEO and discoverability plan

SEO must be built into page templates, content operations, and catalogue data—not added as a single plugin at the end.

### 16.1 Technical SEO

- Server-rendered public pages.
- Unique title and meta description for every indexable product, artist, category, art-form, collection, and article.
- Canonical URLs and consistent URL strategy.
- Dynamic XML sitemap and robots rules.
- Crawlable `<a href>` links for primary navigation and product links.
- Breadcrumbs on product/category/artist/article pages.
- Correct 404/410 behavior for removed pages; redirect only when a meaningful replacement exists.
- Noindex for cart, checkout, account, internal search results where appropriate, and staging.
- Open Graph/social metadata with approved images.
- Mobile-first responsive pages and clean pagination.

### 16.2 Structured data

Implement and validate:

- `Organization` / `WebSite` for the brand.
- `Product` and `Offer` on purchasable product detail pages using accurate price, currency, availability, image, brand, SKU, and shipping/return information where eligible.
- `BreadcrumbList` where breadcrumb navigation exists.
- `Article` for journal content.
- `Person` for artist profiles only where the public profile is appropriate and consented.
- `LocalBusiness` only if a real eligible business location exists and details are verified.

Do not add fake reviews, ratings, stock, availability, or prices. Validate with Google Rich Results Test and Search Console after release.

### 16.3 Content SEO

Build helpful pages around:

- Indian art forms and their processes;
- materials, techniques, and care;
- original artwork and handmade gift categories;
- custom art and commission guides;
- artist interviews and studio stories;
- occasion-led art and gifting;
- workshops and creative learning.

Create genuinely useful, reviewed content; avoid scaled thin pages that simply repeat a craft name and a few keywords.

### 16.4 Image SEO

- descriptive filenames (for example `madhubani-hand-painted-fish-artwork.jpg` only if that description is accurate);
- informative alt text;
- crawlable image URLs;
- responsive image sizes and high-quality source images;
- image sitemap if needed;
- accurate image context on the landing page.

### 16.5 Merchant Center

Prepare a product feed with current price, availability, image, product identifiers where applicable, shipping and returns. Keep feed values aligned with the product page and structured data. Google recommends combining product structured data with a Merchant Center feed where appropriate.

---

## 17. Accessibility, performance, and quality standards

### 17.1 Accessibility

Target WCAG 2.2 AA as the working standard:

- keyboard access to every function;
- visible focus;
- semantic headings and landmarks;
- labelled form fields and useful validation errors;
- screen-reader status for cart and checkout updates;
- sufficient contrast for text and controls;
- accessible menus, dialogs, filters, carousels, and galleries;
- reduced-motion support;
- captions/transcripts for video content where appropriate;
- meaningful alt text and decorative image handling.

### 17.2 Performance

- Use AVIF/WebP renditions, responsive `sizes`, lazy loading below the fold, and priority only for the true LCP image.
- Minimize client JavaScript and avoid shipping large animation or icon libraries unnecessarily.
- Cache public pages and catalogue data safely.
- Paginate product grids and avoid loading the entire catalogue.
- Use CDN delivery for images and static assets.
- Avoid third-party scripts until they are needed; load consent-aware analytics/marketing tags.
- Monitor Core Web Vitals on real devices and networks.

### 17.3 Suggested performance targets

Treat these as engineering targets, not guaranteed scores:

- Mobile LCP: aim for 2.5 seconds or better at the 75th percentile.
- INP: aim for 200 ms or better at the 75th percentile.
- CLS: aim for 0.1 or better at the 75th percentile.
- No oversized hero images or layout shifts caused by missing image dimensions.
- Product listing should remain usable on a mid-range Android device and variable mobile network.

### 17.4 Testing layers

- Unit tests for price calculations, commissions, statuses, and business rules.
- Integration tests for Medusa modules, DB migrations, payment provider, shipping provider, and webhook handling.
- API tests for auth/permissions, products, commissions, and orders.
- Playwright E2E for browse → product → cart → checkout → payment → order tracking.
- E2E for custom request → quote → approval → payment → progress → completion.
- Visual regression for homepage, shop, product, artist, custom art, account, and checkout.
- Accessibility tests and manual keyboard/screen reader spot checks.
- Load tests for product listing, search, checkout, and webhook bursts.
- Backup restore and incident recovery drills.

---

## 18. Analytics and measurement

Track business events in a privacy-conscious manner:

- `view_item_list`, `select_item`, `view_item`;
- `search` and `filter_applied`;
- `add_to_cart`, `remove_from_cart`, `view_cart`;
- `begin_checkout`, `add_shipping_info`, `add_payment_info`, `purchase`;
- `commission_request_submitted`, `commission_quote_approved`;
- `artist_application_submitted`;
- `newsletter_subscribed`;
- `content_view`, `video_engaged` where appropriate.

Key business measures:

- visitor-to-product-view rate;
- product-view-to-cart rate;
- checkout completion rate;
- revenue and average order value;
- returns/refunds and cancellation rate;
- fulfilment time and late-dispatch rate;
- commission request-to-quote and quote-to-paid conversion;
- artist application approval and active-partner rate;
- organic landing pages and revenue attributed to organic search;
- content-assisted product discovery.

Never send sensitive personal data, private upload names, payment details, or free-form commission briefs to analytics tools.

---

## 19. Infrastructure and environments

### 19.1 Environment strategy

- **Local:** Docker Compose with backend, storefront, PostgreSQL, Redis, and test integrations/mocks.
- **Preview:** pull-request previews with non-production data and provider sandbox keys.
- **Staging:** production-like AWS resources, test payments, test shipping, protected access, and noindex.
- **Production:** isolated secrets, database, storage, monitoring, WAF/edge protections, and approved payment/shipping accounts.

### 19.2 Production deployment model

- Next.js storefront hosted on Vercel or an equivalent managed platform.
- Medusa API and background worker deployed as separate ECS services/tasks where appropriate.
- PostgreSQL on managed RDS with backups and Multi-AZ after production sizing.
- Redis/Valkey managed service.
- S3 private/public buckets with CloudFront distribution and policies.
- Secrets Manager or equivalent for runtime secrets.
- CloudWatch logs/alarms and Sentry for application errors.
- Terraform for repeatable infrastructure.

Confirm provider-region availability, data-transfer charges, and actual product pricing before choosing final AWS resources. Avoid high fixed infrastructure commitments before traffic and catalogue requirements are known.

### 19.3 CI/CD quality gates

Every pull request must run:

1. install from lockfile;
2. format check;
3. lint;
4. typecheck;
5. unit tests;
6. backend integration tests where practical;
7. storefront build;
8. dependency/secret scans;
9. migration validation;
10. E2E smoke tests on preview/staging before production promotion.

Production deployment must include a controlled migration step, health checks, rollback plan, and post-deploy smoke tests. Do not run schema-changing migrations manually without recording the change and rollback considerations.

---

## 20. Phased build plan from day zero to production

The sequence below is dependency-led. Calendar duration depends on team capacity, content readiness, partner agreements, product photography, and payment/shipping account approval. Do not promise a launch date until the P0 issues and content supply are understood.

### Phase 0 — Product, brand, and operational decisions

**Deliverables**

- approved positioning and tagline;
- signed-off colour, typography, logo, motif and photography direction;
- first-release category list;
- product/fulfilment types;
- launch seller-of-record model;
- return, cancellation, shipping, and custom-commission rules;
- initial product and artist content inventory;
- role and operational ownership map.

**Acceptance:** no unsupported authenticity, impact, or delivery claims; actual launch catalogue can be photographed and fulfilled.

### Phase 1 — Repository and technical stabilization

**Tasks**

- preserve working monorepo and existing Medusa/storefront connection;
- add root workspace scripts and non-interactive lint;
- rotate exposed secrets;
- dependency triage and upgrades;
- resolve Medusa custom module runtime registration errors;
- add correct migration-backed models and module registration;
- add reliable seed script for INR region, sales channel, keys, collections, products, artists;
- verify health, typecheck, tests, lint, build, Docker Compose.

**Acceptance:** clean local setup from README; artist and commission endpoints return correct non-500 responses; test data can be seeded repeatably; no exposed secrets.

### Phase 2 — Brand design system and visual rebuild

**Tasks**

- create brand tokens in shared UI package;
- implement logo variants and favicon;
- build type scale, spacing, grids, button/input/card/badge/section systems;
- define colourful backgrounds, art-form card variants, editorial layouts, textile/pattern accents;
- create desktop/tablet/mobile breakpoints;
- create page templates and responsive navigation;
- implement reduced-motion and contrast checks;
- create design-system route as a real reference page with live components and colour swatches.

**Acceptance:** home, shop, product, artist, custom art, journal, account, cart, and checkout all look like the same richly branded Indian art house. No plain black-and-white fallback page remains for a major route.

### Phase 3 — Media and content foundation

**Tasks**

- build S3 media upload and rendition pipeline;
- create image metadata/rights record;
- fix artist portrait and product image mapping;
- set up Sanity schemas for articles, campaigns, art-form stories, homepage blocks, and FAQs;
- author real brand story, first art-form stories, artist profiles, and policies;
- add content review and publish process.

**Acceptance:** all visible imagery is licensed/approved; no broken image URLs; content editors can update homepage sections and articles without code changes.

### Phase 4 — Complete catalogue and shopping journey

**Tasks**

- configure product taxonomy and required fields;
- import/seed real launch catalogue;
- implement shop filters/sorting/search;
- implement product variant and personalization UI;
- add product gallery and image zoom;
- add related products and collection merchandising;
- add wishlist if launch scope permits;
- implement stock/made-to-order status and lead-time display.

**Acceptance:** a customer can discover, understand, choose, and add a real product; all price/stock information is server-validated.

### Phase 5 — Customer accounts, payment, and checkout

**Tasks**

- finish secure auth, email verification, password reset;
- add addresses and customer order detail;
- implement Razorpay sandbox integration;
- implement server-side payment verification and webhook idempotency;
- implement order confirmation and notification templates;
- test success, failure, timeout, duplicate callback, cancellation, and refund paths.

**Acceptance:** successful test payment creates exactly one correct Medusa order; failures do not create a paid order; customer can see order status.

### Phase 6 — Shipping, returns, and operational studio

**Tasks**

- implement Shiprocket integration adapter;
- serviceability and shipping charge logic where supported;
- shipment booking, label, tracking and delivery webhooks;
- NDR and return workflow;
- admin order work queue;
- reconciliation and exception reports;
- customer shipment notifications.

**Acceptance:** test order moves from paid → shipment created → shipped → delivered with auditable event history; failed booking can be retried safely.

### Phase 7 — Custom artwork commission system

**Tasks**

- public commission landing page and brief form;
- private file upload and consent;
- Medusa custom commission module and workflows;
- admin quote creation and draft-order/payment link path;
- assignment to approved artist/partner;
- proof/revision/approval records;
- customer status page and notifications.

**Acceptance:** full request-to-delivery process works with sample artists and test customer; internal notes are not visible to customers.

### Phase 8 — Artist and partner programme

**Tasks**

- artist application and review pipeline;
- partner agreements and restricted records;
- artist profiles and portfolio;
- product submission and admin approval;
- artist portal MVP: profile, submitted work, assigned commission and status;
- role-based access and activity log.

**Acceptance:** an artist can apply, be reviewed, and receive approved work without accessing another artist's/customer's private data.

### Phase 9 — Social content, SEO, and growth

**Tasks**

- Instagram/Meta content connection where eligible;
- YouTube channel/video integration;
- optional X API or official embeds;
- admin curation queue and cached social blocks;
- page metadata, canonical tags, structured data, sitemap, robots;
- Merchant Center feed and Search Console verification;
- newsletter signup with consent;
- GA4 and conversion events;
- launch editorial calendar.

**Acceptance:** social outages do not break the site; product data is consistent across page/schema/feed; all indexable public pages have useful unique metadata.

### Phase 10 — Production hardening and launch

**Tasks**

- complete vulnerability remediation;
- security and privacy review;
- backup restore test;
- load and soak tests;
- mobile device checks;
- accessibility audit;
- visual regression checks;
- real shipment and payment rehearsal;
- admin/support SOP and escalation contacts;
- legal/policy signoff;
- launch checklist and rollback plan.

**Acceptance:** no P0 blocker; checkout, refund, shipping, commission, and support operations have been rehearsed; the owner has signed off on the visual brand and real catalogue.

### Phase 11 — Marketplace evolution

Only after the first operating cycles show stable fulfilment, returns, customer support, artist capacity, bookkeeping, and partner economics:

- design vendor-owned product/inventory model;
- split parent orders into seller fulfilment orders;
- define tax and invoice responsibilities;
- add vendor portal and permission model;
- implement settlement ledger and provider transfers if approved;
- add dispute/chargeback/refund allocation;
- reconcile every payout against orders, returns, fees, and tax treatment.

**Acceptance:** seller onboarding and payout are legally reviewed, auditable, reconciled, and tested against partial refunds and cancellations before being enabled for live sellers.

---

## 21. Production launch checklist

### Brand and content

- [ ] Approved logo and variants are used consistently.
- [ ] Rich colour system is visible across every major route.
- [ ] Homepage features genuine brand/product/artist imagery.
- [ ] No placeholder content, broken links, or fake testimonials.
- [ ] Art-form descriptions are reviewed for accuracy and attribution.
- [ ] Image rights and artist permissions are recorded.
- [ ] Product images are colour-accurate and responsive.

### Commerce

- [ ] INR region and sales channel configured.
- [ ] Real product catalogue, variants, price and tax rules loaded.
- [ ] Inventory and lead times verified.
- [ ] Razorpay live account and webhook endpoints approved/tested.
- [ ] Shiprocket account and courier settings tested.
- [ ] Shipping, returns, cancellation, and refund policies published.
- [ ] COD decision and risk controls documented if offered.
- [ ] Test orders and refunds reconciled.

### Custom work and partners

- [ ] Commission form and private upload tested.
- [ ] Quote/approval/payment/proof/revision flow tested.
- [ ] Artist and partner permissions verified.
- [ ] Partner terms and payout model signed off.
- [ ] No private information is exposed publicly.

### Technical and SEO

- [ ] No critical/high untriaged dependency vulnerability.
- [ ] Secret scanning passes; old tokens rotated.
- [ ] Lint, typecheck, tests, and build pass in CI.
- [ ] Database backups and restore tested.
- [ ] Monitoring/alerts and error reporting active.
- [ ] Security headers and CSP reviewed.
- [ ] Sitemap, robots, canonical, metadata, Product schema validated.
- [ ] Merchant Center feed values match the live catalogue.
- [ ] Mobile Core Web Vitals and accessibility reviewed.

### Operations

- [ ] Admin users and roles configured.
- [ ] Support email/phone/WhatsApp routes staffed and tested.
- [ ] Order exception, NDR, refund, and cancellation procedures documented.
- [ ] Commission review and delay escalation procedures documented.
- [ ] Daily reconciliation ownership assigned.
- [ ] Incident and rollback contact list ready.

---

## 22. Design review scorecard

Score every major page from 1–5. A page is not approved if it looks like an unstyled fallback or if it misses accessibility/commerce requirements.

| Area | Approval question |
|---|---|
| Brand recognition | Does this page clearly feel like SnehaVrinda Kala? |
| Colour | Does it use the brand palette intentionally and confidently? |
| Indian authenticity | Are the craft references accurate, respectful, and specific rather than generic decoration? |
| Art direction | Are images real/approved, visually strong, and colour-accurate? |
| Typography | Is the hierarchy expressive but readable? |
| Layout | Does the page have rhythm, whitespace, contrast, and varied section patterns? |
| Navigation | Can users find shop, art forms, artists, custom art, support, and account? |
| Mobile | Is it equally considered on a small Android screen? |
| Accessibility | Can it be used with keyboard and assistive technology? |
| Conversion | Is the next action obvious without pressure or confusion? |
| Content quality | Are claims, maker credits, prices, stock, and timelines accurate? |

### Mandatory visual rejection conditions

Reject the design pass if:

- the whole site is white/black with one tiny accent colour;
- all sections are identical white cards;
- the site relies on generic AI/stock images instead of the actual art catalogue;
- traditional motifs are repeated indiscriminately without cultural context;
- text is placed on busy imagery without contrast;
- desktop looks polished but mobile is merely stacked columns;
- checkout/account pages lose the brand identity or become difficult to read;
- a decorative animation delays access to content or controls.

---

## 23. Risks and decisions to keep visible

| Risk | Why it matters | Mitigation |
|---|---|---|
| Broad “all art” promise becomes unfocused | Customers cannot understand the shop | Launch with selected disciplines and expand via evidence-based taxonomy |
| Brand looks colourful but not authentic | Decoration without real craft knowledge weakens trust | Use real artist/product media, reviewed stories, specific attribution, and original visual assets |
| Empty catalogue | Beautiful site cannot sell | Secure a launch-ready product and artist inventory before public launch |
| Custom modules compile but fail at runtime | Core artist/commission journeys break | Runtime integration tests, migrations, and end-to-end workflow tests |
| Payment/shipping integration is incomplete | Orders cannot be fulfilled reliably | Sandbox and real test cycles before launch; idempotent webhooks and reconciliation |
| Unclear marketplace legal model | Tax, invoice, refund and seller obligations become risky | Start centrally managed; obtain professional review before vendor settlements |
| Social API restrictions/change | Feed widgets stop working | Cache approved content; manual curation fallback; never block rendering |
| Unlicensed art imagery or motif usage | Intellectual-property and trust risk | Record rights/consent and commission original assets |
| Too much custom software too early | Expensive, slow operations | Use Medusa for commerce; build only differentiating modules; defer microservices |

---

## 24. Master implementation prompt for the development team or coding agent

Use the following as the top-level brief when assigning implementation work. It is not permission to ignore the existing repository, tests, or audit findings.

> **Build SnehaVrinda Kala as a distinctive, production-grade Indian art and creative-commerce brand—not a generic e-commerce template and not a monochrome SaaS interface.**
>
> First inspect the existing monorepo, its current routes, components, Medusa v2 configuration, database migrations, Docker Compose, environment variables, and the supplied production audit. Preserve sound working functionality. Do not create a second backend, a duplicate database, or a disconnected demo. Write down existing problems before changing them.
>
> **Brand direction:** “The Living Indian Art House”. Make the entire customer journey vibrant, expressive, warm, tactile, editorial, and contemporary. Use the signed-off brand palette: warm rang-paper `#FFF7E8`, marigold `#E6A72E`, sindoor `#C84636`, kumkum `#9F2947`, peacock `#176D6A`, indigo `#263A63`, leaf `#557447`, haldi `#F0C45B`, gulabi `#D98291`, terracotta `#B96E4B`, and readable deep ink `#2B211E`. Apply the colours through purposeful section backgrounds, art-form tiles, editorial bands, buttons, labels, and footer treatments. Do not make every page plain white with black text. Do not use a generic minimal SaaS design. Do not add random gradients or generic cultural motifs.
>
> **Authenticity:** Build around real approved product images, artists, studio/process photography, accurate art-form explanations, and permissioned content. Use Indian craft motifs only when relevant and accurately attributed. Never invent artists, provenance, regional origin, GI claims, handmade claims, reviews, or impact metrics. Use placeholders that are visibly marked as placeholders until genuine assets are supplied.
>
> **Frontend:** Next.js App Router, React, TypeScript, responsive server-rendered public pages, reusable design-system components, optimized images, proper metadata, and accessible interactions. Build a coherent homepage, shop, art-form pages, product detail, artist directory/profile, custom-art request journey, journal, about, partner application, customer account, cart, checkout, and support/policy pages.
>
> **Backend:** Keep Medusa v2 as the commerce foundation. Use its supported module/data-model/service/workflow conventions for artists, partners, commissions, product review, and future marketplace functionality. Fix existing module runtime failures; do not settle for typecheck-only success. Keep PostgreSQL as the system of record and Redis for cache/queue infrastructure. Use Sanity for editorial content and S3/CloudFront for public and private media.
>
> **Commerce:** Implement server-validated product/variant/pricing/stock, INR checkout, Razorpay payment creation and verification, idempotent signed webhooks, order completion, refunds, and Shiprocket shipment/label/tracking integration. Make customer-facing order status truthful. Do not claim payment, order, or shipment success before the backend/provider confirms it.
>
> **Commission workflow:** Implement a structured custom-art request with private reference uploads, consent, review, quote, customer approval, payment, artist assignment, milestones, proof/revision tracking, completion, and delivery. Keep internal notes private. Add customer-visible status history.
>
> **Artist/partner workflows:** Build applications, review, agreements, profile/portfolio approval, product submission, quality review, and artist role permissions. Keep self-serve multi-vendor checkout and automated payout behind a later release gate until legal, tax, payment-provider, and accounting design is approved.
>
> **SEO and performance:** Add unique metadata, canonical URLs, crawlable links, dynamic sitemap, correct robots rules, Product/Offer schema, breadcrumbs, article schema, Merchant Center feed preparation, responsive AVIF/WebP imagery, and safe caching/revalidation. Meet practical mobile performance and WCAG 2.2 AA targets.
>
> **Reliability:** Add root workspace scripts; non-interactive lint; formatting, typecheck, unit, integration, E2E, visual and accessibility tests; dependency and secret scanning; migration checks; structured logs; Sentry/CloudWatch; backups and restore drills; staging and production separation; and documented rollback.
>
> Work in small, reviewable phases. Before each phase, state the files/routes/modules being changed and the acceptance criteria. After each phase, run the actual checks and report exact pass/fail results. Never claim a feature is complete because a page renders; verify its runtime flow, data persistence, permissions, provider behavior, mobile layout, accessibility, and error states. If a provider credential or real business asset is missing, implement the safe integration boundary and clearly document the exact configuration still required—do not fake a successful live integration.

---

## 25. Research and reference links

### Competitor and brand references

- [Zwende — artist-made products and personalized gifting](https://www.zwende.com/)
- [iTokri — Indian craft and textile commerce](https://itokri.com/)
- [iTokri FAQ — brand and sourcing claims](https://itokri.com/pages/faq)
- [Okhai — The Okhai Story](https://okhai.org/pages/the-okhai-story)
- [Okhai — storefront](https://okhai.org/)
- [Gaatha — craft stories and documentation](https://gaatha.com/)
- [Gaatha Shop — Indian handicrafts and craft categories](https://shop.gaatha.com/)
- [Jaypore — curated artisanal products](https://www.jaypore.com/)
- [Direct Create — maker/designer collaboration](https://www.directcreate.com/)
- [Chumbak — design-led Indian lifestyle retail](https://www.chumbak.com/)

### Platform and technical references

- [Medusa v2 overview](https://medusajs.com/v2-overview)
- [Medusa documentation](https://docs.medusajs.com/)
- [Medusa marketplace recipe](https://docs.medusajs.com/resources/recipes/marketplace)
- [Next.js documentation](https://nextjs.org/docs)
- [Sanity documentation](https://www.sanity.io/docs)
- [Razorpay Route](https://razorpay.com/route/)
- [Shiprocket developer portal](https://apidocs.shiprocket.in/)

### SEO and search references

- [Google Search Central — ecommerce SEO best practices](https://developers.google.com/search/docs/specialty/ecommerce)
- [Google Search Central — merchant listing structured data](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing)
- [Google Search Central — product structured data](https://developers.google.com/search/docs/appearance/structured-data/product)
- [Google Search Central — ecommerce site structure](https://developers.google.com/search/docs/specialty/ecommerce/help-google-understand-your-ecommerce-site-structure)
- [Google Search Central — ecommerce URL structure](https://developers.google.com/search/docs/specialty/ecommerce/designing-a-url-structure-for-ecommerce-sites)
- [Google Search Central — image SEO](https://developers.google.com/search/docs/appearance/google-images)

---

## 26. Final decisions to carry into implementation

1. **Brand:** SnehaVrinda Kala is a colourful Indian art house and creative-commerce brand—not a generic marketplace template.
2. **Visual system:** Warm paper + vivid Indian pigment palette + editorial typography + accurately used craft-inspired motifs + real artist/product imagery.
3. **Experience:** The entire website, including commerce and account screens, must remain fully branded and mobile-first.
4. **Platform:** Next.js + TypeScript + Medusa v2 + PostgreSQL + Redis + Sanity + S3/CloudFront.
5. **Launch business model:** centrally managed curated brand with artist/partner workflows; marketplace settlement is a later stage.
6. **Trust:** accurate product detail, artist attribution, transparent production times, payment, shipping, returns, and customer support.
7. **Operations:** reliable Razorpay, Shiprocket, commission, fulfilment, refunds, and reconciliation—not simulated flows.
8. **SEO:** structured catalogue, useful editorial content, technical SEO, product schema, Merchant Center feed, and measurable organic growth.
9. **Quality:** fix the existing audit's production blockers before live selling.
10. **Definition of done:** a visitor can discover the brand, explore a real art form, buy a real product, request custom art, trust the maker/story, pay successfully, receive updates, and get support—on a colourful, distinctive, accessible, fast website.

**End of master plan.**
