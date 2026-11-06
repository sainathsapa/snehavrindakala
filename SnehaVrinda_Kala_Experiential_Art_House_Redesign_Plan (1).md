# SnehaVrinda Kala — Experiential Indian Art House Website Redesign

**Full UX, brand, content, design-system, and phased implementation blueprint**  
**Prepared:** 6 November 2026  
**Business mode now:** Single-brand commerce — SnehaVrinda Kala sells and fulfils its own catalogue  
**Future mode:** Artist/partner marketplace remains dormant behind the existing platform-mode toggle  
**Existing commerce foundation:** Next.js + TypeScript + Medusa v2 + PostgreSQL (with the existing repository and integrations retained)

---

## 0. The brief in one sentence

Transform SnehaVrinda Kala from a conventional grid-led e-commerce storefront into a **living digital Indian art house**: an editorial, sensory, culturally grounded destination where people discover art, explore its context, meet the people and processes behind it, experience curated collections, and then shop naturally.

This is a redesign of the **whole customer experience**, not a colour refresh and not a rebuild of commerce from scratch.

## 1. Executive direction

### 1.1 What the current experience must stop feeling like

The website must not resemble:

- A generic technology-company website with a commerce tab added later.
- A standard Shopify-style theme where every section is a row of identical product cards.
- A catalogue that asks visitors to know the exact product they want before they can enjoy the brand.
- A decorative “Indian theme” made by scattering paisleys, mandalas, elephants, peacocks, and gold borders everywhere.
- A slow, animation-heavy microsite that makes product discovery, accessibility, or checkout difficult.

### 1.2 What it should feel like

The website should feel like entering a contemporary Indian art house with several rooms:

1. **The Gallery** — curated artworks, collections, visual exhibitions, and new discoveries.
2. **The Archive** — art forms, regions, materials, techniques, motifs, and cultural context.
3. **The Studio** — artists, makers, process films, work-in-progress, and interviews.
4. **The Journal** — essays, visual stories, guides, and cultural observations.
5. **The Shop** — a clear, calm way to bring an artwork home.
6. **The Commission Desk** — a welcoming place to request a custom artwork.

Commerce remains important, but it should feel like a natural extension of the art experience.

### 1.3 Business scope: single-brand first

The business decision is explicit:

- Today, SnehaVrinda Kala is the seller and operator of the catalogue.
- The public website must present one coherent brand, not a marketplace directory.
- Artists and makers may be introduced editorially and credited accurately, but they are not independent sellers in the current release.
- No public “become a seller”, seller onboarding, vendor store, vendor checkout, seller payout, or marketplace navigation should appear in the current customer experience.
- Preserve the existing platform-mode toggle and future marketplace code/architecture. Do not delete it, bypass it, or turn it on as part of the redesign.
- Confirm its current implementation and default state before changing code. The live storefront should remain in single-brand mode.
- Do not build marketplace functionality now merely because the architecture can support it later.

**Current operating rule:** one brand, one customer promise, one catalogue experience, one order-management owner.

---

## 2. Research: competitor and experience benchmarks

The following research separates direct/adjacent commerce references from cultural and museum experience references. They are not all identical competitors. The goal is to learn specific patterns, not copy any site's visual identity.

### 2.1 Relevant Indian brands and platforms

| Reference | What its current experience communicates | What SnehaVrinda Kala should learn | What not to copy |
|---|---|---|---|
| [Gaatha](https://gaatha.com/) | Separates Discover, Experience, Shop, and deeper craft documentation. It frames craft as process, heritage, people, and meaning rather than only product attributes. Its current site also highlights visual narratives and films. | Build a clear non-shopping discovery path; give stories and process equal importance to products; link cultural learning to a curated shop. | Do not recreate a large research archive before the brand has reliable content. Start with a smaller number of excellent stories. |
| [Google Arts & Culture — Crafted in India](https://artsandculture.google.com/project/crafted-in-india) | Explores crafts through color, maker stories, films, regional journeys, quizzes, and close-up visual exhibits. | Let visitors explore by curiosity: color, medium, region, material, motif, and process. Use zoomable details and short interactive learning moments. | Do not overload the site with gimmicks or create game mechanics unrelated to the artwork. |
| [Museum of Art & Photography (MAP), Bengaluru](https://map-india.org/) | Treats exhibitions, collections, digital stories, learning, watching, reading, and digital experiences as parts of one cultural destination. | Add an “Exhibitions” / “Now Showing” editorial layer; make video, reading, guided discovery, and accessibility part of the experience. | Do not imitate a museum's institutional navigation or make the site difficult for a first-time shopper. |
| [Artisera](https://www.artisera.com/) | Combines contemporary art, traditional art, collectibles, artist profiles, exhibitions, client stories, and art advisory. | Give artists and artworks proper context; use curated categories and exhibition-led stories; provide confidence-building information for art purchases. | Avoid a high-end collector-only tone if the brand intends to welcome curious first-time buyers too. |
| [The India Craft House](https://theindiacrafthouse.com/) | Combines craft-form discovery, seasonal curation, product collections, explanatory craft content, and custom/bulk enquiries. | Create meaningful collection concepts and well-structured art-form landing pages; make custom enquiries discoverable. | Avoid making every section another shopping collection with a different title. |
| [Jaypore](https://www.jaypore.com/) | Uses shop-by-craft, seasonal edits, color/occasion discovery, product categories, and stories about Indian design and craft. | Provide several discovery entry points beyond a top-level category list; make the craft-to-modern-life connection clear. | Its broad retail-navigation density is not the desired homepage model for SnehaVrinda Kala. |
| [Okhai](https://okhai.org/pages/about-us) | Explains the relationship between product design, artisans, craft communities, and the social/economic context of handmade work. | Make people and process visible; explain who made or designed an item only when that information is verified. | Do not use impact, sustainability, artisan-count, or livelihood claims unless SnehaVrinda Kala can substantiate them. |
| [Good Earth — Our World](https://www.goodearth.in/our-world/) | Connects products to design philosophy, lifestyle, rituals, community, and editorial stories. | Show how art lives in a home, celebration, everyday ritual, or personal space; build a recognizable editorial voice. | Avoid an overly luxury-coded tone if it does not match the actual price point and customer. |
| [Raw Mango](https://rawmango.com/pages/raw-mango) | Builds a strong point of view around Indian culture, regional realities, craft, film, music, image-making, and events. | Give the brand a clear cultural perspective and consistent art direction across more than product pages. | Do not make the brand story abstract or founder-centric without useful customer-facing content. |
| [Saffronart](https://www.saffronart.com/) | Organizes art through artist profiles, exhibitions, art guides, buying/selling guidance, advisory, and authenticity information. | Make art buying feel informed and trustworthy; explain medium, size, edition, care, provenance, and authenticity where applicable. | Do not imitate an auction-house interface or investment-oriented language for ordinary craft products. |
| [Nappa Dori](https://www.nappadori.com/) | Uses a design philosophy, editorial publication, collaborations, physical spaces, and detailed craft/design point of view. | Treat the website as an expression of a larger creative world, not just a sales channel. | Do not copy a minimalist leather-goods aesthetic; use the lesson of consistency, not the style itself. |

### 2.2 International and digital-cultural experience references

| Reference | Relevant experience pattern | Application to SnehaVrinda Kala |
|---|---|---|
| [Google Arts & Culture](https://artsandculture.google.com/) | Expert-curated digital exhibitions, high-resolution artworks, stories, and cultural institution collections. | Build a few high-quality digital exhibitions and detailed image experiences from real SnehaVrinda Kala content. |
| [MAP digital guide](https://map-india.org/our-digital-guide/) | Audio guides, video, accessible interpretation, exhibition context, and multilingual support. | Consider optional audio stories, transcripts, captions, and accessible interpretation. These should be optional enhancements, not barriers. |
| [Rijksmuseum shop case study](https://www.strix.net/en/case-studies/implementation-of-shopware-for-the-rijksmuseum) | A museum-inspired shopping experience where collection imagery and visual context help the store feel like an extension of the museum. | Make category/collection landing pages feel like curated rooms, while retaining clear stock, price, delivery, and purchase information. |
| [Louisiana Museum digital experience case study](https://www.deptagency.com/case/bringing-art-to-life-in-a-digital-manner/) | Uses video, asymmetric composition, interaction, and restrained interface design to let art remain the main focus. | Use motion and asymmetry to create atmosphere; the interface must frame the artwork rather than compete with it. |

### 2.3 Research conclusions

The strongest opportunity is to combine these patterns into one coherent brand journey:

- **Gaatha:** cultural depth and storytelling.
- **Google Arts & Culture:** playful, visual discovery.
- **MAP:** exhibition and learning experiences.
- **Artisera/Saffronart:** artist context, confidence, and art-buying guidance.
- **Jaypore/The India Craft House:** practical shopping and craft-based discovery.
- **Good Earth/Raw Mango/Nappa Dori:** a distinctive brand worldview and editorial language.

No single reference is the blueprint. SnehaVrinda Kala should build its own visual language and use the patterns selectively.

---

## 3. Brand experience strategy

### 3.1 Positioning direction

**Working positioning:** SnehaVrinda Kala is a contemporary Indian art house bringing together art, craft, creative expression, cultural stories, and objects made to be lived with.

This positioning is intentionally broader than “handicraft store”. It leaves space for painting, illustration, sculpture, textile art, decor, handmade objects, prints, creative gifts, and future forms of art as the actual catalogue grows.

### 3.2 Brand promise

A visitor should leave with at least one of these outcomes:

- “I discovered an art form I did not know.”
- “I understand the story behind this artwork.”
- “I found an artist or style that speaks to me.”
- “I can imagine this artwork in my home or as a gift.”
- “I know how to request something personal.”

### 3.3 Brand personality

| Attribute | Direction |
|---|---|
| Cultural | Rooted, informed, respectful; never costume-like or stereotyped. |
| Artistic | Expressive, curious, visually confident. |
| Contemporary | Fresh layouts and modern usability without erasing heritage. |
| Warm | Human, welcoming, conversational. |
| Curatorial | Selective, thoughtful, able to explain why something matters. |
| Trustworthy | Honest about materials, origin, maker attribution, process, price, and delivery. |

### 3.4 Voice and writing principles

Use evocative but clear language. A cultural story can be poetic; product, payment, delivery, and return information must be plain and precise.

Good direction:
- “Follow the line, colour, and rhythm of this painting.”
- “Made slowly, with a story in every detail.” (Use only if the making process supports the claim.)
- “Explore the technique behind this work.”
- “Bring this artwork home.”

Avoid:
- Empty luxury words such as “iconic”, “exclusive”, “timeless” on every product.
- Unverifiable claims like “ancient”, “100% sustainable”, “fair trade”, “tribal”, “handmade”, or “authentic” without evidence and context.
- Treating all Indian art as one generic tradition.
- Speaking on behalf of an artist without consent or an approved biography.

---

## 4. Visual direction: a contemporary Indian art house

### 4.1 The central art-direction rule

**The artwork is the colour. The interface is the gallery that gives it space.**

The site should be colourful because the artwork, photography, curation, and collection compositions are vivid—not because every UI panel is filled with a different saturated colour.

Use warm, tactile base surfaces and confident pigment accents. Give full-bleed artwork photography room to dominate. Use colour panels as editorial punctuation, not as repeated UI decoration.

### 4.2 Palette evolution

The supplied audit records an existing palette: Ivory `#F4EFE6`, Paper `#F7F2E8`, Surface `#FFFDF8`, Ink `#221F1A`, Madder `#A63D2F`, Indigo `#1F2A44`, Haldi `#D9A441`, Peacock `#1E6F6A`, Rose `#9C3F63`, Sage `#6F7F5B`, Gold `#B8860B`, and Border `#D8CCB8`.

Preserve those usable foundations, but turn them into a deeper role-based system rather than replacing them with random bright colours.

#### Core gallery surfaces

| Token | Suggested value | Role |
|---|---|---|
| `canvas-paper` | `#F7F2E8` | Main warm background |
| `canvas-ivory` | `#F4EFE6` | Alternate editorial surface |
| `canvas-white` | `#FFFDF8` | Product/reading surfaces |
| `ink` | `#221F1A` | Main text |
| `ink-muted` | `#655E54` | Secondary text, subject to contrast checks |
| `line-clay` | `#D8CCB8` | Borders and separators |

#### Pigment accents

| Token | Suggested value | Use |
|---|---|---|
| `madder` | `#A63D2F` | Primary action / key cultural accent |
| `sindoor` | `#B83A32` | Campaign and selected highlight |
| `haldi` | `#D9A441` | Warm highlight; do not use for small low-contrast text |
| `peacock` | `#1E6F6A` | Discovery, links, selected states |
| `indigo` | `#1F2A44` | Deep editorial sections |
| `gulabi` | `#B94F78` | Expressive collection accent |
| `leaf` | `#63764A` | Nature/plant-inspired collections |
| `terracotta` | `#A95F42` | Earth, clay, and material stories |
| `brass` | `#B8860B` | Fine-line ornament, not body text |
| `ultramarine` | `#3D55A6` | Rare, high-energy visual accent |

**Palette rule:** Each page has a dominant surface, one principal accent, and at most one supporting accent. A collection may carry its own accent, but navigation, forms, buttons, and checkout must remain consistent.

### 4.3 Colour by collection, not random decoration

Colour can become a discovery tool. Examples:

- Indigo stories — blue, resist, dye, night, depth.
- Earth and clay — terracotta, ochre, charcoal, natural surfaces.
- Festival colour — marigold, sindoor, pink, leaf green.
- Paper and pigment — ivory, ink, bright pigment details.
- Metal and light — brass, bronze, warm shadow.

These are editorial groupings, not claims that every product in a group uses a particular technique. Connect products only when their metadata supports the grouping.

### 4.4 Typography

The supplied audit records Cormorant Garamond for editorial headings and Manrope for body/UI. Keep the general contrast but refine the hierarchy:

- Display serif: large, expressive, editorial titles.
- Sans-serif: navigation, buttons, forms, product specifications, prices, and body copy.
- Optional Devanagari display/body companion for Hindi or regional-language editorial content. Evaluate Noto Serif Devanagari / Noto Sans Devanagari or a properly licensed alternative after testing.
- Use real typographic scale, not arbitrary oversized headings everywhere.
- Preserve line length and legibility on mobile.

### 4.5 Motifs and graphic vocabulary

Develop a small family of original, subtle graphic assets inspired by actual art practices and materials:

- Hand-drawn line and brush marks.
- Block-print registration imperfections.
- Paper edges and pigment swatches.
- Textile border fragments.
- Rangoli-inspired radial or geometric structures.
- Jaali-inspired grids used sparingly.
- Arch, frame, and gallery-label devices.
- Handwritten annotation marks for editorial captions.

Rules:
- Motifs should support the content, not become a wallpaper on every page.
- Do not use sacred symbols, community motifs, or region-specific forms as generic ornament without research and permission.
- Avoid cliché: repeating elephant, paisley, lotus, peacock, mandala, and temple-bell icons is not an art direction.
- Motif assets must be original or properly licensed.

### 4.6 Logo and identity system

Audit the existing logo before designing a replacement. If the existing wordmark is adequate, refine its use rather than restarting unnecessarily.

Create:
- Primary SnehaVrinda Kala wordmark.
- Compact monogram/seal for favicon, packaging, and social avatars.
- Horizontal and stacked lockups.
- Clear-space and minimum-size rules.
- Single-colour and reversed versions.
- Optional Devanagari lockup only if the spelling and typography are professionally reviewed.
- Small maker/edition labels for product packaging and editorial captions.

### 4.7 Layout language: break the grid habit

Use a flexible editorial composition system:

- One oversized feature image paired with a short text column.
- Asymmetrical 7/5 or 8/4 image/text splits.
- A single hero image interrupted by a caption or vertical title rail.
- Full-bleed visual chapters.
- Overlapping image and paper-colour panels in limited places.
- Curated image sequences with varied ratios.
- Horizontal story rails for optional browsing.
- Large art details and small supporting annotations.
- Salon-style artwork arrangements that feel composed, not like a product tile matrix.
- Occasional full-screen chapter transitions, never on every page.

A product grid is still allowed where it is useful (search results, filtered catalogue, related items), but it must not be the visual structure of the whole brand.

---

## 5. Information architecture: a world, not a catalogue

### 5.1 Main navigation

Recommended primary navigation:

1. **Discover** — curated journeys, art forms, regions, colours, materials, and themes.
2. **Exhibitions** — current and past digital exhibitions/edits.
3. **Artists** — artist and maker profiles with selected works.
4. **Shop** — all available artworks and products.
5. **Stories** — journal, process films, guides, and cultural notes.
6. **Custom Art** — request a commissioned or personalized artwork.

Header utilities:
- Search.
- Account.
- Wishlist only if it is implemented and maintained.
- Cart.

Keep the header light. Avoid exposing future marketplace/vendor navigation in the public interface.

### 5.2 Proposed sitemap

```text
/
├── discover/
│   ├── by-art-form/
│   ├── by-region/
│   ├── by-colour/
│   ├── by-material/
│   ├── by-technique/
│   └── journeys/[slug]/
├── exhibitions/
│   ├── current/
│   ├── archive/
│   └── [slug]/
├── art-forms/
│   └── [slug]/
├── artists/
│   └── [slug]/
├── shop/
│   ├── collections/[slug]/
│   ├── category/[slug]/
│   └── search/
├── products/[handle]/
├── stories/
│   ├── [slug]/
│   └── topics/[slug]/
├── custom-art/
├── about/
├── contact/
├── help/
├── account/
├── cart/
└── checkout/
```

This is a proposed IA. Reuse existing routes and URL patterns where possible. Do not break current indexed URLs without a redirect plan.

### 5.3 The four main discovery modes

Visitors should be able to find art through different kinds of curiosity:

- **I know what I want:** Search, shop categories, filters, product pages.
- **I know what I like:** Discover by colour, mood, material, medium, room, or occasion.
- **I want to learn:** Art forms, regions, techniques, motifs, makers, and stories.
- **I want something personal:** Custom art enquiry.

This avoids forcing every visitor into the same category-to-product-grid path.

---

## 6. The full visitor journey

### 6.1 The intended journey

```text
Arrive
  ↓
Feel the world of SnehaVrinda Kala
  ↓
Choose a curiosity (art form / story / colour / artist / exhibition)
  ↓
Explore an artwork or cultural story
  ↓
Understand its maker, medium, technique, and meaning
  ↓
See related works or a curated collection
  ↓
Save / share / ask / purchase / request custom work
  ↓
Receive the artwork and continue the story after purchase
```

### 6.2 Journey A — curious visitor, not yet shopping

1. Lands on the homepage through a social post or search result.
2. Sees a visually rich exhibition or art-form story rather than a wall of products.
3. Opens “Explore Gond painting” or another verified art-form page.
4. Learns the visual language, materials, artists, and context through photos, captions, and a short film.
5. Explores a curated selection of available works.
6. Saves or shares an artwork, or signs up for stories.

**Success:** the visitor understands what makes the artwork interesting, even if they do not purchase immediately.

### 6.3 Journey B — product-led visitor

1. Enters directly on a product page from Google or Instagram.
2. Understands the artwork at a glance: what it is, dimensions, medium, price, availability, and shipping expectation.
3. Can inspect texture/detail, context, maker/artist, and care.
4. Sees related works and the relevant art-form story.
5. Adds to cart and checks out without a forced editorial detour.

**Success:** story deepens confidence without obstructing buying.

### 6.4 Journey C — custom artwork request

1. Enters via “Custom Art”.
2. Sees examples and the types of work accepted.
3. Chooses request type and shares idea, size, intended use, budget range, deadline, and reference images.
4. Receives a clear explanation of what happens next, when a response is expected, and that a quote is not confirmed until approved.
5. Tracks the request through the customer account or secure reference link.

**Success:** no vague “contact us” dead-end; the customer knows what to provide and what happens next.

### 6.5 Journey D — returning customer

1. Returns through email, social content, a QR code in packaging, or saved item.
2. Finds a new exhibition, story, or related collection.
3. Can view order status, purchase history, and commission requests.
4. Gets product care and follow-on cultural content.

**Success:** the relationship continues after checkout.

---

## 7. Homepage: make it feel like entering an art house

The homepage is the main expression of the new direction. It must not be assembled from repeated three-column cards.

### Section 1 — The opening scene

**Composition:** immersive full-width or near-full-screen image/video, with asymmetrical text placement. Use one real artwork, a studio moment, a material detail, or a tightly edited montage.

Include:
- A concise brand statement.
- One primary CTA: “Enter the world” / “Explore art”.
- One secondary CTA: “Shop the collection”.
- A quiet scroll cue.

Motion:
- Optional muted, short looping video with a static poster image.
- No audio autoplay.
- Provide reduced-motion and low-bandwidth fallbacks.
- Text remains readable and actionable over the image.

### Section 2 — A short invitation

A large editorial line that explains the brand's point of view. Keep it short and specific, not a generic slogan.

### Section 3 — Choose your way in

Create three large, differently composed entry points:

- Discover an art form.
- Meet the hands and minds behind the work.
- Bring an artwork home.

These should look like editorial doors, not equal cards in a generic feature grid.

### Section 4 — Now showing: featured exhibition

One large featured curation with:
- Exhibition title.
- Short curatorial note.
- Featured visual.
- A few linked chapters or works.
- CTA to enter the exhibition.

Use an exhibition-style scroll sequence with varied imagery, captions, and optional close-ups.

### Section 5 — Art in motion

A short process film: paint mixing, carving, weaving, printing, shaping, drawing, or another genuine process from the brand's products. Include captions and a written version.

### Section 6 — Discover by curiosity

Offer visual pathways such as:
- By colour.
- By material.
- By art form.
- By region.
- By feeling or theme.

Only show options backed by real content and product metadata. Do not launch empty discovery pages.

### Section 7 — The artist's world

A large portrait/studio image and a short artist/maker feature. Link to the profile and selected works. Obtain consent and approve the biography.

### Section 8 — A small, curated shop moment

Show 3–5 selected works in an editorial arrangement: one hero work, one detail crop, and a compact selection. Include clear price and availability. This is one shopping moment, not the whole page.

### Section 9 — A story to stay with

Feature an article, visual essay, or cultural note with an expressive image and a meaningful excerpt.

### Section 10 — Commission something personal

Use a real example of a custom artwork, then explain how to request one. Include a clear CTA.

### Section 11 — Social and community layer

Use hand-picked Instagram posts, YouTube films, or embedded content where platform rules and performance allow. Do not make an unreliable third-party feed a dependency for core content.

### Section 12 — A thoughtful closing

Newsletter invitation, brand sign-off, contact, policies, social links, and a well-organized footer.

**Homepage acceptance rule:** If the visitor only sees the homepage, they should understand the brand is an art and culture destination before they are asked to browse products.

---

## 8. Page-by-page experience specification

### 8.1 Discover landing page

Purpose: help a visitor begin exploring without knowing the product name.

Content modules:
- An editorial introduction to discovery.
- Featured paths.
- Large image links for art forms.
- Color/material/region/technique journeys where the catalogue has data.
- “Start anywhere” pathway for new visitors.
- Related stories and exhibitions.

Interaction:
- Optional “What draws you in?” selector: colour, story, texture, form, or place.
- The selector filters suggested paths; it must not block browsing or require login.

### 8.2 Art-form detail page

Each art-form page should feel like a small digital exhibition.

Structure:
1. Hero artwork/process image.
2. Art-form name and short explanation.
3. Region and community attribution where verified.
4. A visual sequence: material → process → detail → finished work.
5. Motifs, symbols, or visual grammar with researched explanation.
6. Artist/maker profile.
7. Related stories.
8. Available SnehaVrinda Kala works associated with the art form.
9. Related art forms or journeys.

Do not publish cultural history that has not been researched and reviewed. Mark modern interpretations as modern interpretations.

### 8.3 Exhibition page

An exhibition is a curated digital experience, not a filter page.

Required elements:
- Strong title and curatorial statement.
- Date or status: Now Showing / From the Archive.
- Hero image or film.
- Curatorial chapters.
- Full-width visuals interspersed with short interpretation.
- Featured artworks with purchase links where available.
- Artist/maker credits.
- Related stories.
- Shareable exhibition URL and social preview.

Keep exhibitions manageable in the CMS. A curated exhibition can contain 4–12 chapters; do not force every product into every exhibition.

### 8.4 Artist / maker profile

Structure:
- Portrait or studio image.
- Name and location (only if approved and accurate).
- Artist statement or approved biography.
- Art form/medium tags.
- Short process film or photo sequence.
- Selected works.
- Related cultural stories.
- Credit and consent information internally.

Current business rule: the profile is editorial. It does not imply that the person has a seller account or manages orders independently.

### 8.5 Shop landing page

The shop should feel like entering a curated gallery shop, not a large data table.

Top of page:
- Clear shop title and short description.
- Featured collection or current edit.
- Discovery by product category, art form, or use case.
- Search.

Below:
- Product listings with filters and sorting.
- Editorial banners between product groups only where useful.
- Product count and active filter chips.
- Empty-state guidance and clear reset filters.

Use product grids where users expect catalogue browsing. Keep the visual treatment distinctive through image ratios, typography, captions, background, and editorial interruptions.

### 8.6 Collection landing page

A collection page needs a story before its product list:
- Collection name and curatorial note.
- Hero image/visual.
- Why these works belong together.
- Optional art-form or mood context.
- Curated works.
- Related story/exhibition.

Collections may be based on a technique, theme, colour, season, room, gift purpose, or artistic idea. Do not create hundreds of thin collections.

### 8.7 Product detail page — “the story of the object”

This page is critical. It must balance art appreciation and purchase clarity.

Above the fold:
- High-quality image gallery, with one strong dominant image.
- Product title.
- Price, stock/availability, variant selection, quantity, and add-to-cart.
- Short factual summary.
- Dimensions and material/medium preview.
- Delivery/dispatch expectation.

Below the fold, in this order where data exists:
1. **Look closer:** zoomable detail images or short process clip.
2. **The story:** an approved short narrative about the artwork.
3. **Made by / created by:** artist or maker profile and credit.
4. **The process:** technique, medium, material, time, or process detail.
5. **Details:** size, weight, finish, colour variation, edition, framing, care, and what is included.
6. **In a space:** real product-in-context imagery, not fake AI placement presented as reality.
7. **Delivery and returns:** clear, accessible policies.
8. **Related works:** curated rather than a huge generic carousel.

Commerce rules:
- Variant, price, stock, and shipping information must stay accurate from Medusa.
- Do not show “only one left” unless inventory confirms it.
- Distinguish ready-to-ship, made-to-order, and custom-request-only.
- Explain natural variation for handmade items where relevant.
- Keep add-to-cart visible on mobile without covering the art.

### 8.8 Stories / journal

Organize by useful editorial topics:
- The Art Form.
- Hands at Work.
- Places and Traditions.
- Materials and Techniques.
- Artists' Notes.
- Living With Art.
- Collecting and Caring.

Article templates should support long-form images, captions, pull quotes, embedded video, footnotes/credits, related artworks, and related artists.

### 8.9 Custom Art page

Make the request feel creative and approachable.

Include:
- Examples of completed commissions (with permission).
- Types of request accepted.
- What can be personalized.
- Clear process: tell us → discuss → quote → approve → create → deliver.
- Request form with reference upload.
- Budget range and deadline expectations.
- Clear privacy notice for uploaded references.

Do not promise a quote, turnaround, or capability until the operations team confirms it.

### 8.10 About page

Tell the story of SnehaVrinda Kala as a brand:
- What the name and brand represent (only as approved by the owner).
- What the brand chooses to celebrate.
- How products are selected, made, or curated.
- What customers can expect.
- The people behind the brand, if they agree to be featured.
- A clear link to explore art and shop.

Avoid generic mission statements without tangible evidence.

### 8.11 Account, cart, and checkout

These pages should be visually consistent but intentionally calmer and more functional than editorial pages.

Maintain:
- Clear forms and validation.
- Transparent price, shipping, tax, and total.
- Secure payment flow.
- Order confirmation and tracking.
- Saved addresses and order history where implemented.
- Accessible error handling.

Do not add slow animations or long storytelling between cart and payment.

---

## 9. Experiences and interactions that make people feel the art

Prioritize meaningful experiences. Do not add interactions merely to make the website look technically impressive.

### 9.1 Phase-one experiences

| Experience | What it does | Why it matters | Complexity |
|---|---|---|---|
| Visual art-form journeys | Large visual paths into selected art forms | Discovery begins with curiosity, not SKU filters | Medium |
| Exhibition chapters | A story-led sequence of image, text, video, and selected works | Makes the website feel like a gallery | Medium |
| Look closer image viewer | High-resolution zoom/detail photographs | Lets people appreciate brushwork, texture, and material | Medium |
| Maker/process film | Short muted video with captions and text alternative | Shows the human process behind the work | Low–Medium |
| Related story links | Links product → artist → process → exhibition | Creates a connected cultural experience | Low |
| Curated collection pages | Editorial context before product selection | Gives shopping a reason and point of view | Medium |
| Custom-art journey | Guided commission request | Converts inspiration into a personal enquiry | Medium |

### 9.2 Phase-two experiences

- Explore by colour or palette.
- Explore by material and technique.
- Optional regional discovery map with fact-checked origins.
- Short audio stories, always user-initiated, with transcripts.
- Motif/painting annotations with tap-to-reveal explanations.
- “In a space” lookbook with real lifestyle images.
- Wishlist and save-a-story, once account UX is solid.
- QR code in package that opens the artwork's story page.
- A seasonal digital exhibition with a shareable chapter link.

### 9.3 Later experiments, not launch requirements

- WebAR or room placement previews.
- 360-degree object views.
- Personalized discovery recommendations.
- Interactive quizzes that teach art knowledge.
- Live workshops or guided online events.
- Multilingual audio/visual tours.

Only build AR/3D after there is a real image/3D asset pipeline and enough product data. A broken room-viewer is worse than good product photography.

### 9.4 Motion and sound principles

- Motion should reveal, guide, or clarify—not delay.
- No forced scroll-jacking.
- No autoplay sound.
- Use short transitions and restrained parallax.
- Respect `prefers-reduced-motion`.
- Provide a static image fallback for motion content.
- Ensure every interaction works with keyboard and touch.
- Do not make hover the only way to reveal important content.

---

## 10. Photography, video, and content production

The greatest design improvement will come from real visual assets. More CSS cannot compensate for weak product and editorial photography.

### 10.1 Required image types

For each priority product:
- Main clean product image.
- Alternate angle.
- Detail/texture close-up.
- Scale/context image.
- Packaging or what-is-included image where useful.
- Optional process image/video.

For each featured artist or art form:
- Portrait or workspace image.
- Hands/process image.
- Material/tools image.
- Finished artwork image.
- One wide hero or environment image.

For exhibitions:
- Cover image.
- Chapter images.
- Detail crops.
- Optional film.

### 10.2 Photography art direction

- Photograph the real artwork and materials accurately.
- Use natural directional light, texture, and considered shadows.
- Mix clean object documentation with editorial lifestyle imagery.
- Include scale references for items where size is hard to understand.
- Use a consistent image grading workflow, but do not erase the real colour of the artwork.
- Avoid stock images that imply a maker, location, or process that is not associated with the product.
- Never generate a fake artisan or cultural process with AI and publish it as documentary evidence.
- AI-generated visuals may be used for abstract concept exploration or clearly labeled campaign artwork, not as a substitute for product truth or real cultural documentation.

### 10.3 Video format library

- 5–10 second loop: visual texture or movement for hero/supporting blocks.
- 20–45 second process clip: one technique or making stage.
- 60–120 second artist/maker introduction.
- 2–4 minute feature: deeper exhibition/story content.

All videos should have captions, transcripts or accessible text alternatives. Host optimized, poster-backed video; do not load multiple videos on initial page load.

### 10.4 Content integrity and permissions

Before publication, record:
- Creator/artist name and preferred credit.
- Permission for portrait, studio, process, and artwork use.
- Image/video usage rights and channels covered.
- Art-form name and spelling.
- Place/region attribution and its source.
- Material and technique details.
- Translation review if multilingual.
- Whether a claim is documented, artist-supplied, or brand interpretation.

A cultural claim should have an internal source note. Do not overstate the age, origin, ritual role, community identity, or social impact of an art form.

---

## 11. Content model and CMS plan

Retain the existing Sanity CMS if it is already wired and suitable. Do not add a second CMS simply for the redesign.

### 11.1 Recommended Sanity content types

| Content type | Important fields |
|---|---|
| `exhibition` | Title, slug, subtitle, hero, curatorial note, status, dates, chapters, related products, artists, SEO |
| `exhibitionChapter` | Title, sequence, rich text, images, video, captions, linked art forms/products/artists |
| `artForm` | Name, slug, short intro, long story, region, medium, process, motifs, images, video, artist references, related products, sources/reviewer |
| `artistProfile` | Name, slug, portrait, approved bio, statement, location (optional), mediums, process media, selected products, credits/consent status |
| `story` | Title, slug, dek, author, date, hero, body, topic, art-form links, artist links, product links, citations/source notes, SEO |
| `collectionEditorial` | Title, slug, curatorial copy, hero, visual layout, selected products, related stories, accent palette |
| `journey` | Title, slug, path type (colour/material/region/mood/technique), chapters, visuals, linked art forms/products/stories |
| `campaign` | Name, date range, hero, theme, featured collection, promotional copy, CTA |
| `siteSettings` | Navigation, footer, announcement, social links, brand copy, SEO defaults |

### 11.2 Commerce data remains in Medusa

Do not duplicate product, price, cart, inventory, order, payment, or fulfilment records in Sanity.

Medusa remains source of truth for:
- Products and variants.
- Pricing and promotions.
- Inventory and availability.
- Carts and checkout.
- Orders and payments.
- Fulfilment and returns where implemented.

Sanity provides editorial context and references Medusa products through stable IDs/handles. Build validation so CMS editors cannot publish broken product links.

### 11.3 CMS editor experience

Editors should be able to:
- Publish an exhibition without a developer.
- Add/reorder chapters.
- Link current products to stories.
- Feature an artist and selected works.
- Change homepage feature order.
- Set campaign date windows.
- Preview on desktop and mobile.
- See warnings for missing alt text, missing credits, or empty required fields.

Do not expose raw complex JSON to a non-technical editor.

---

## 12. Technical strategy: redesign the existing product, do not restart unnecessarily

### 12.1 Keep the established stack

The design project should not trigger a technology rewrite.

| Layer | Existing / selected technology | Redesign responsibility |
|---|---|---|
| Storefront | Next.js + React + TypeScript | New visual composition, templates, editorial routes, responsive interactions |
| Commerce backend | Medusa v2 | Preserve existing commerce APIs and order source of truth |
| Database | PostgreSQL | Keep product/order data in Medusa; use migrations for any new custom fields/modules |
| Cache/jobs | Redis | Preserve existing configuration and use for appropriate cache/job tasks |
| CMS | Sanity | Expand content schemas and preview/editor workflows |
| Media | Existing media storage / S3-compatible pipeline | Add optimized responsive images, video delivery, alt text, and image metadata |
| UI packages | Existing shared UI packages | Evolve into tokens and editorial components; do not force every layout into generic cards |
| Hosting | Current Vercel/AWS approach if already operational | Confirm environment, cache, secrets, CDN, and observability before changing infra |

### 12.2 Existing repository baseline from the supplied audit

The supplied audit dated 6 November 2026 described:
- A monorepo with `apps/backend`, `apps/storefront`, `apps/studio`, `packages/ui`, `packages/types`, and `packages/config-tailwind`.
- The storefront already connected to Medusa.
- Existing routes for home, shop, art forms, artists, custom art, sell, seller, account, cart, checkout, design system, journal, about, and policies.
- A current palette and reusable UI primitives.
- A clean storefront build and successful typechecks at the time of audit.
- Important unresolved production gaps: empty catalogue/region data in the audited database, runtime failures in custom artist/commission modules, incomplete Razorpay payment flow, missing SEO coverage, unoptimized images, lint/CI issues, and serious dependency audit findings.

These are **audit-time findings**, not guaranteed current facts. Re-run the relevant checks against the present branch before implementation. Do not assume the fixes are still outstanding, and do not assume they are complete without evidence.

### 12.3 Refactor strategy

- Audit the current components before replacing them.
- Preserve working Medusa cart, product, account, and checkout integrations.
- Introduce editorial page templates and content modules in the existing Next.js app.
- Refactor the shared UI package into a proper design-system foundation.
- Keep commerce logic out of purely visual components.
- Keep CMS query/data-mapping code separate from presentation.
- Use server rendering for SEO-critical public content.
- Use caching/revalidation for public art-form, artist, exhibition, story, and product content when safe.
- Keep cart, checkout, account, and private request status pages appropriately private/dynamic.
- Add feature flags for optional experience modules, but do not create a second platform-mode switch.

### 12.4 Component architecture

Suggested UI/component groups:

```text
packages/ui/
  foundations/
    colors
    typography
    spacing
    radii
    shadows
    motion
  primitives/
    Button
    IconButton
    Link
    Input
    Select
    Textarea
    Modal
    Drawer
    Tabs
    Accordion
    Badge
    Price
    Skeleton
  editorial/
    DisplayHeading
    ChapterIntro
    EditorialSplit
    FullBleedVisual
    ImageSequence
    PullQuote
    CaptionedMedia
    ImageDetailViewer
    StoryRail
    ExhibitionHero
    ArtistFeature
    CuratedArtworkFeature
  commerce/
    ProductPrice
    ProductGallery
    ProductCard
    ProductRail
    ProductFilters
    VariantSelector
    AvailabilityNote
    AddToCart
    CartSummary
  navigation/
    SiteHeader
    MegaMenu
    MobileNavigation
    Breadcrumbs
    Footer
```

Do not turn every editorial layout into a configurable generic block with dozens of boolean props. Prefer a small set of well-designed compositions that are easy to understand and compose.

### 12.5 Performance architecture

- Use `next/image` or an equivalent controlled image pipeline for responsive images.
- Serve AVIF/WebP where supported, with suitable fallbacks.
- Define image widths and aspect ratios to reduce layout shift.
- Lazy-load below-the-fold media.
- Use a poster image for video and load video only when needed.
- Use responsive `sizes` and avoid shipping desktop-size files to mobile.
- Cache public CMS and catalogue content with explicit invalidation/revalidation.
- Keep account, cart, checkout, and customer-specific data out of shared caches.
- Avoid giant animation libraries and multiple heavy third-party embeds.
- Measure Core Web Vitals on real mobile devices and throttled networks.

### 12.6 SEO architecture

- Use descriptive URLs and canonical URLs.
- Unique title and meta description for each public page.
- Open Graph/Twitter metadata for exhibitions, products, art forms, artists, and stories.
- Product structured data only for actual purchasable product pages with accurate price/availability.
- Breadcrumb structured data where appropriate.
- Organization and website schema.
- Article schema for genuine editorial stories.
- Dynamic XML sitemap for indexable products, art forms, artists, exhibitions, and stories.
- Robots rules that exclude private account/checkout/cart and staging.
- Alt text that describes the actual image, not keyword stuffing.
- Internal links between product ↔ art form ↔ artist ↔ exhibition ↔ story.
- Do not index duplicate filters, empty query pages, or thin collections.

---

## 13. Single-brand mode and future platform toggle

This section is a non-negotiable scope guard.

### 13.1 Current mode

- SnehaVrinda Kala is the only seller/merchant shown to customers.
- Customer-facing product pages use the SnehaVrinda Kala brand voice.
- Artist profiles provide editorial attribution, not seller storefronts.
- Orders, customer support, refunds, shipping, and order communication are managed by the brand.
- The public site must not show seller onboarding or marketplace marketing.

### 13.2 Preserve the future toggle

- Inspect and document the existing portal toggle before any refactor.
- Preserve its meaning, current stored value, permissions, and audit trail.
- In the live configuration, keep platform/marketplace mode disabled until the owner explicitly activates it after growth.
- Do not infer permission to activate the marketplace from the existence of the toggle.
- Keep future seller/partner code isolated and unexposed in the current public routes.
- Write tests proving that disabled mode hides marketplace routes and prevents seller-specific public flows.

### 13.3 Future activation criteria

Do not activate platform mode until all of the following are approved:
- Seller/artist agreement and onboarding policy.
- KYC and business verification process.
- Product moderation and intellectual-property review.
- Commission and fee model.
- GST, TCS, invoicing, and marketplace legal review.
- Payment split/settlement provider and reconciliation process.
- Returns, cancellations, disputes, and customer-support ownership.
- Seller permissions and data isolation tests.
- Marketplace-specific fraud, risk, and audit controls.

The current redesign must not delay or attempt to solve all of these future requirements.

---

## 14. Phased redesign and implementation roadmap

The phases are ordered by dependency. They are not arbitrary page-count milestones. Each phase has a goal, workstream, deliverables, and exit criteria.

### Phase 0 — Repository, product, and experience audit

**Goal:** know exactly what exists before redesigning it.

Work:
- Checkout current `main` branch and record commit hash.
- Review the current homepage and all public routes on desktop, tablet, and mobile.
- Capture a page inventory and screenshots.
- Identify every repeated grid/card pattern and its real job.
- Inspect the current platform-mode toggle and verify it remains disabled for current brand-only operation.
- Audit current CMS schemas, content, media, product data, and editorial completeness.
- Audit current Medusa APIs, custom modules, payment flow, shipping flow, and order lifecycle.
- Re-run typecheck, tests, lint, production build, dependency audit, and route smoke tests.
- Review analytics/search performance if data is available.
- List known bugs separately from design issues.

Deliverables:
- Current-state route and component inventory.
- “Keep / improve / replace / remove” component matrix.
- Current design-system audit.
- Media/content gap list.
- Production blockers list.
- Platform-mode toggle behavior note.

Exit criteria:
- No one is redesigning around an assumed feature that does not exist.
- Every public route has an owner and an intended purpose.
- Existing working commerce flows are identified for regression protection.

### Phase 1 — Brand strategy and art direction

**Goal:** define what SnehaVrinda Kala should look and sound like before drawing page layouts.

Work:
- Confirm brand positioning and audience.
- Confirm the brand's actual catalogue and art categories.
- Define visual references and anti-references.
- Refine the role-based pigment palette.
- Finalize typography pairings and language support direction.
- Create logo usage rules and supporting brand marks.
- Define photography/video style and image rights policy.
- Define voice, tone, product-story style, and cultural-accuracy rules.

Deliverables:
- Brand direction board.
- Visual moodboard with real reference images and notes.
- Colour token sheet with contrast values.
- Typography scale.
- Logo usage page.
- Motif/graphic asset family.
- Photo/video shot list and production plan.
- Writing/voice guide.

Exit criteria:
- The team can describe the brand in one paragraph.
- The visual direction is recognizably Indian and contemporary without relying on clichés.
- The design direction works with actual products and photography, not only abstract mockups.

### Phase 2 — Information architecture and content strategy

**Goal:** design the visitor's journey before designing the visual pages.

Work:
- Approve primary navigation.
- Define Discover, Exhibitions, Art Forms, Artists, Shop, Stories, Custom Art.
- Map current routes to proposed routes.
- Define user journeys for curious visitor, product buyer, custom-art requester, and returning customer.
- Design taxonomy and internal linking.
- Select the first 3–5 art forms and stories to publish deeply, based on actual products and reliable sources.
- Select the first exhibition/collection theme.
- Create editorial and product metadata rules.

Deliverables:
- Sitemap.
- Navigation prototype.
- User journey maps.
- Page template inventory.
- Content inventory and gaps.
- Initial editorial calendar.
- URL migration/redirect map.

Exit criteria:
- Every page has one primary purpose.
- Visitors can enter via learning, discovery, shopping, or custom request.
- No new route is created without an owner and enough content to populate it.

### Phase 3 — UX wireframes and interaction prototypes

**Goal:** solve the layout and interaction before final visual polish.

Work:
- Wireframe homepage and core templates.
- Prototype desktop and mobile navigation.
- Prototype exhibition chapter flow.
- Prototype art-form discovery.
- Prototype product detail story structure.
- Prototype custom-art request flow.
- Prototype search and shop filters.
- Test with 5–8 representative users if possible, including people who have never purchased art online.
- Check whether people understand that the site is a brand/art house and where to shop.

Deliverables:
- Low/mid-fidelity page flows.
- Clickable prototype.
- Interaction notes.
- Accessibility/keyboard review notes.
- Usability findings and revised wireframes.

Exit criteria:
- A first-time visitor can reach an art form, artwork, story, or shop without help.
- A buyer can locate price, dimensions, availability, delivery, and purchase action.
- The homepage does not look like a generic e-commerce template even in greyscale wireframes.

### Phase 4 — Design system and high-fidelity art direction

**Goal:** build the reusable visual language and prove the system across different page types.

Work:
- Implement refined tokens in the existing UI package.
- Create typography, spacing, colour, responsive, and motion foundations.
- Design buttons, forms, navigation, image captions, product metadata, gallery controls, editorial blocks, and commerce components.
- Create at least five distinct layout compositions.
- Create high-fidelity prototypes for: homepage, exhibition, art-form page, product page, and shop landing.
- Test mobile/tablet/desktop.
- Validate color contrast and focus visibility.

Deliverables:
- Figma/design source of truth.
- Token documentation.
- Component library.
- Responsive specifications.
- Motion and image behavior guide.
- Updated `/design-system` page in the product.

Exit criteria:
- The design system supports editorial and commerce layouts without forcing both into the same card pattern.
- Text, UI, and colour pass accessibility contrast checks.
- The site is recognizably SnehaVrinda Kala across all key templates.

### Phase 5 — Build the editorial art-house shell and homepage

**Goal:** make the brand experience visible in the actual website.

Work:
- Rebuild the global header/footer.
- Implement the homepage opening scene and editorial composition.
- Build “Choose your way in” discovery paths.
- Build the featured exhibition component.
- Build maker/process visual block.
- Build curated artwork feature.
- Build story feature and custom-art CTA.
- Connect CMS content and preview.
- Keep search, account, cart, and shop access easy to find.

Deliverables:
- New homepage.
- New site shell and responsive navigation.
- CMS-driven homepage sections.
- Initial real visual assets.

Exit criteria:
- The homepage communicates art and culture before commerce.
- Content can be reordered/updated through the CMS where planned.
- No core feature depends on a fragile hardcoded feed.

### Phase 6 — Build Discover, Art Forms, Exhibitions, Artists, and Stories

**Goal:** create the cultural depth that distinguishes the brand.

Work:
- Implement Discover landing.
- Implement art-form index and detailed art-form template.
- Implement exhibition index, current exhibition, archive, and chapter pages.
- Implement artist/maker profiles.
- Implement journal/story templates.
- Link content to actual products and art forms.
- Add optional image zoom, process video, and related-content modules.
- Add CMS validation for credits, image alt text, required content, and links.

Deliverables:
- Editorial discovery section.
- Art-form archive and detail template.
- Exhibition system.
- Artist profile system.
- Journal/story system.
- Initial 3–5 substantial content experiences.

Exit criteria:
- A visitor can move naturally between an artwork, its art form, its artist, and a related story.
- At least three deeply populated art-form experiences exist before promoting the discovery section heavily.
- Empty or placeholder archive pages are not published.

### Phase 7 — Redesign commerce as part of the art journey

**Goal:** upgrade shopping without losing reliability or clarity.

Work:
- Redesign shop landing and collection pages.
- Improve product card image composition and metadata.
- Add/verify filters, sorting, search, and empty states.
- Redesign product page with Look Closer, The Story, Maker, Process, Details, and Delivery sections.
- Implement related works based on product/art-form/collection relationships.
- Confirm variant selection and personalization where the product supports it.
- Keep cart and checkout focused and fast.
- Verify Razorpay payment lifecycle and webhooks.
- Verify shipping/fulfilment status sync through Shiprocket.
- Test cancellations, refunds, failed payments, duplicate webhooks, and order confirmation.

Deliverables:
- New shop and collection templates.
- New product detail template.
- Updated cart/checkout visual system.
- Payment/shipping regression evidence.

Exit criteria:
- Every purchasable product has accurate images, title, price, stock, dimensions, material, shipping expectation, and policy details as applicable.
- A test order can complete end-to-end in the supported payment environment.
- Editorial additions do not slow or obstruct checkout.

### Phase 8 — Custom art, account, social, and after-purchase experience

**Goal:** help customers turn inspiration into a request and continue the relationship after purchase.

Work:
- Redesign custom-art landing and enquiry flow.
- Add request confirmation and status experience using existing backend capability only after it is stable.
- Upgrade account pages for order history, order details, and addresses where implemented.
- Add social content blocks using approved embeds or curated CMS selections.
- Add QR-ready story URLs for packaging inserts.
- Add order emails with clear brand presentation and accurate status.
- Add product care/story follow-up content where appropriate.

Deliverables:
- Custom-art journey.
- Customer account improvements.
- Social content pattern.
- Post-purchase story/QR pattern.

Exit criteria:
- Customers know what happens after submitting a custom request.
- Account and order pages are secure and do not expose private data.
- Social embeds do not break when an external platform fails.

### Phase 9 — Content production, SEO, accessibility, performance, and QA

**Goal:** ensure the beautiful site is accurate, discoverable, fast, and usable.

Work:
- Complete photo and media production for launch products and editorial content.
- Populate all page metadata and canonical URLs.
- Add product/article/organization/breadcrumb structured data as appropriate.
- Generate dynamic sitemap and verify robots rules.
- Optimize images and video.
- Test mobile performance on mid-range devices and constrained connections.
- Run accessibility audits and keyboard-only journeys.
- Run visual regression and cross-browser tests.
- Check content rights, cultural attribution, spelling, translations, and alt text.
- Fix all critical/high security and dependency issues before production deployment.

Deliverables:
- Complete launch content set.
- SEO checklist and sitemap.
- Accessibility report.
- Lighthouse/Core Web Vitals report.
- Visual QA report.
- Security/dependency remediation summary.

Exit criteria:
- No critical checkout, security, accessibility, or content-truth defects remain.
- Public pages have useful metadata and indexable content.
- All important interactions work with keyboard, touch, and screen reader support.

### Phase 10 — Soft launch, learn, and refine

**Goal:** launch safely and improve based on actual behavior.

Work:
- Release to staging for owner and invited-user review.
- Verify product and content data in production environment.
- Run real low-value/test purchases using the approved payment procedure.
- Confirm fulfilment, tracking, notifications, returns, and customer-support ownership.
- Release gradually if the deployment setup supports it.
- Monitor errors, search behavior, conversion funnels, and page performance.
- Gather qualitative feedback on whether the site feels like an art house.
- Refine the highest-friction journeys first.

Deliverables:
- Launch checklist sign-off.
- Production release notes.
- Monitoring dashboard.
- First-month improvement backlog.

Exit criteria:
- Customers can browse, buy, request, pay, and receive status updates reliably.
- The owner/team can publish a story, collection, or exhibition without a developer.
- Support and fulfilment teams understand the new order and enquiry experience.

### Phase 11 — Future platform activation (not part of this redesign release)

This phase is intentionally future-only. Keep the toggle and architecture ready, but do not implement the marketplace now.

When growth justifies it, scope:
- Vendor/artist onboarding and KYC.
- Seller catalogues and listing permissions.
- Moderation and intellectual-property review.
- Commission/fee rules.
- Order splitting and fulfilment ownership.
- Settlements and reconciliation.
- GST/TCS/legal review.
- Seller analytics and customer service model.
- New platform-mode UX.

This work requires a separate business and technical approval.

---

## 15. Detailed task backlog by workstream

### 15.1 Brand and design

- [ ] Approve positioning and tone.
- [ ] Refine palette and contrast tokens.
- [ ] Finalize display/body/Devanagari typography.
- [ ] Finalize logo/monogram usage.
- [ ] Create motif library and usage rules.
- [ ] Create image ratio and photography standards.
- [ ] Create editorial caption and label styles.
- [ ] Create exhibition visual template.
- [ ] Create product-story template.
- [ ] Create mobile-specific layout rules.

### 15.2 UX and content

- [ ] Confirm top-level navigation.
- [ ] Approve sitemap and URL map.
- [ ] Create 4 key visitor journeys.
- [ ] Define art-form taxonomy and metadata.
- [ ] Define artist credit/consent workflow.
- [ ] Define story/exhibition CMS types.
- [ ] Write first exhibition.
- [ ] Write first 3–5 art-form features.
- [ ] Prepare first artist/maker profiles.
- [ ] Write product stories for priority SKUs.
- [ ] Write custom-art request guidance.

### 15.3 Frontend

- [ ] Audit existing shared components.
- [ ] Update tokens and design-system page.
- [ ] Rebuild header/footer.
- [ ] Build editorial section components.
- [ ] Build exhibition template.
- [ ] Build art-form template.
- [ ] Build artist profile template.
- [ ] Build story template.
- [ ] Redesign shop and collection.
- [ ] Redesign product page.
- [ ] Redesign custom-art form.
- [ ] Add responsive image handling.
- [ ] Add motion and reduced-motion behavior.

### 15.4 Backend and integrations

- [ ] Preserve Medusa product/order source of truth.
- [ ] Verify product-to-CMS reference strategy.
- [ ] Verify customer/cart/checkout behavior.
- [ ] Verify Razorpay session/verification/webhook/complete flow.
- [ ] Verify Shiprocket order/shipment/tracking sync.
- [ ] Verify custom-art submission and notification flow.
- [ ] Confirm admin-only access to platform-mode toggle.
- [ ] Test single-brand mode routes and permissions.

### 15.5 Quality, SEO, and launch

- [ ] Restore/verify lint and root scripts.
- [ ] Run dependency audit and remediate critical/high issues.
- [ ] Rotate any previously committed secrets.
- [ ] Add page-level metadata.
- [ ] Add structured data.
- [ ] Add dynamic sitemap and robots checks.
- [ ] Add image optimization.
- [ ] Add Playwright smoke and core journey tests.
- [ ] Add visual regression tests for key templates.
- [ ] Run accessibility audit.
- [ ] Run performance audit.
- [ ] Complete launch content audit.

---

## 16. Quality and acceptance standards

### 16.1 Brand-feel acceptance

Ask these questions on every key template:

- Does this look like an art house before it looks like a store?
- Is there a distinct composition, or is it another repeated card section?
- Is the artwork the visual focus?
- Does the page have a clear narrative or reason to exist?
- Is the Indian cultural context specific and credible rather than decorative?
- Does the content create curiosity without making shopping confusing?

### 16.2 UX acceptance

- Main navigation is understandable within seconds.
- Every page has one dominant purpose.
- Users can always find Shop, Search, Account, and Cart.
- Product details are never hidden behind decorative interactions.
- Filter state is visible and resettable.
- Custom request forms explain what information is required and why.
- No important action is hover-only.
- Mobile layouts are designed, not merely compressed desktop layouts.

### 16.3 Accessibility acceptance

- Semantic heading order.
- Keyboard access for menus, dialogs, galleries, filters, and forms.
- Visible focus states.
- Correct labels and error messages.
- Sufficient text/control contrast.
- Alt text for informative images; decorative imagery uses empty alt where appropriate.
- Captions/transcripts for video/audio.
- Reduced motion respected.
- Touch targets are comfortably sized.
- No colour-only status communication.

### 16.4 Performance targets

Use Core Web Vitals as the operating target, measured at the 75th percentile for real users when sufficient traffic is available:
- LCP: 2.5 seconds or less.
- INP: 200 milliseconds or less.
- CLS: 0.1 or less.

These are targets, not guarantees. Set page-specific budgets for JavaScript, image weight, and third-party scripts. Test on mid-range mobile devices and realistic Indian mobile network conditions.

### 16.5 Commerce acceptance

- Product and variant price is accurate.
- Inventory and availability are accurate.
- Cart survives supported navigation/session behavior.
- Checkout has clear totals, taxes, shipping, and payment state.
- Payment failures and retries do not create duplicate orders/charges.
- Webhooks are verified and idempotent.
- Shipment status is synchronized and customer-visible.
- Customer PII is not exposed in public pages or logs.

---

## 17. Analytics and learning loops

Track experience quality, not just sales.

### Discovery events

- `discover_path_opened`
- `art_form_viewed`
- `exhibition_opened`
- `exhibition_chapter_viewed`
- `artist_profile_viewed`
- `story_viewed`
- `video_started`
- `artwork_zoomed`
- `related_story_clicked`

### Commerce events

- `shop_viewed`
- `search_submitted`
- `filter_applied`
- `product_viewed`
- `variant_selected`
- `add_to_cart`
- `checkout_started`
- `purchase_completed`

### Custom art events

- `custom_art_page_viewed`
- `custom_art_form_started`
- `custom_art_request_submitted`

### Quality indicators

- Share of visitors entering via editorial/discovery paths.
- Progression from art-form/story to related product.
- Product detail engagement with story/process modules.
- Search no-result rate.
- Product-to-cart and checkout completion.
- Custom-art request completion.
- Returning visitor rate.
- Newsletter signup quality.
- Mobile performance and error rates.

Do not use intrusive analytics or collect sensitive information unnecessarily. Respect consent and applicable privacy requirements.

---

## 18. SEO and content growth strategy

Build search visibility around genuine art knowledge and real available products.

### 18.1 Topic clusters

For each art form where the brand has reliable information and relevant products, create a connected cluster:

- Main art-form page.
- One or more process/technique stories.
- Artist/maker profile.
- Relevant exhibition/collection.
- Product pages.
- Care or collecting guide where useful.

### 18.2 Search intent groups

- Informational: What is this art form? How is it made? What does this motif mean?
- Discovery: Indian art forms, regional art, handmade wall art, traditional painting styles.
- Commercial: buy [specific artwork/art form/product type], gifts, wall art, decor.
- Navigational: SnehaVrinda Kala, artist name, collection name.

Use natural language and accurate page titles. Do not mass-produce thin SEO pages for every colour/region/category combination.

### 18.3 Social-to-site continuity

- Instagram posts should link to a meaningful story, exhibition, or product—not only the homepage.
- YouTube descriptions should link to the relevant artist, art form, or process page.
- Social campaigns should use consistent campaign imagery and landing pages.
- Use UTM conventions for campaign measurement.
- Curate content in the CMS when external embeds are unstable.

---

## 19. Risks and how to control them

| Risk | Control |
|---|---|
| Redesign becomes another colour refresh | Require wireframes and distinct editorial compositions before coding. |
| Site becomes beautiful but hard to shop | Keep product price, availability, search, cart, and checkout clear and tested. |
| Cultural content is inaccurate | Record sources, obtain artist review where appropriate, and avoid unsupported claims. |
| Website looks like an Indian-theme template | Use specific artwork, material, artist, and visual research; avoid generic motifs. |
| Heavy video/animation slows mobile | Use poster images, lazy loading, reduced-motion fallbacks, and performance budgets. |
| Too many empty content pages | Launch only pages with meaningful content and real links. |
| CMS becomes difficult for the team | Provide structured schemas, previews, validation, and short editor instructions. |
| Existing commerce regressions | Preserve Medusa flows and add automated regression tests before replacing components. |
| Marketplace features leak into current UX | Test the existing platform-mode toggle and single-brand route/permission behavior. |
| Asset rights are unclear | Maintain a media rights/consent register. |
| AI visuals misrepresent culture or product | Use real photography for products and documentary claims; label conceptual artwork clearly. |

---

## 20. What not to build in the first redesign

Do not spend the first redesign cycle on:

- Multi-vendor seller dashboards.
- Seller payouts or split-payment workflows.
- Public marketplace onboarding.
- Complex AR room placement.
- 3D product configurators for every SKU.
- A custom social network/community feed.
- A giant art-history archive with hundreds of thin pages.
- Autoplay sound or scroll-jacking.
- An AI chatbot that cannot answer from accurate product/CMS data.
- A large recommendation engine before enough interaction data exists.

Build the art-house feeling through strong art direction, real content, great photography, and meaningful navigation first.

---

## 21. Definition of done

The redesign is complete when:

1. The homepage reads as an Indian art house and cultural destination, not a generic shop.
2. Key pages use varied editorial compositions rather than repeating product grids.
3. Visitors can explore real art forms, exhibitions, artists, and stories.
4. Product pages communicate the artwork's story and practical buying details.
5. Shop, cart, checkout, payment, and shipping continue to work.
6. Custom-art enquiries have a complete, understandable journey.
7. The owner/team can create exhibitions, stories, artist features, and collections through the CMS.
8. The website is responsive, accessible, performant, SEO-ready, and secure.
9. The current single-brand selling mode is preserved.
10. The existing platform-mode toggle and future marketplace architecture remain intact but inactive.
11. No public page implies that independent artists currently sell directly through the site.
12. The first set of content is genuine, credited, and visually strong.

---

## 22. Master implementation brief for the development team / coding agent

Use the following as the governing instruction when implementing this plan against the existing repository.

> You are redesigning the existing SnehaVrinda Kala production-bound application into a contemporary Indian art-house experience. Do not create a generic e-commerce template, do not make every section a product grid, and do not replace the existing stack or rewrite working commerce flows without evidence that this is necessary.
>
> First inspect the repository, current branch, actual routes, shared UI components, Sanity schemas, Medusa integration, customer/cart/checkout behavior, and the existing platform-mode toggle. Produce a short implementation map of what will be preserved, refactored, and replaced. Re-run the existing build/typecheck/test/lint and route checks so the baseline is factual.
>
> The immediate business model is single-brand commerce: SnehaVrinda Kala alone sells and fulfils the current catalogue. Preserve the existing platform-mode toggle and future marketplace architecture, keep the current mode single-brand, and do not expose seller onboarding, vendor storefronts, seller payouts, or marketplace language in the customer-facing experience.
>
> Create the visual identity of a living contemporary Indian art house. Use a warm tactile foundation, a sophisticated pigment palette, expressive editorial typography, original culturally informed motifs, real artwork photography, and varied asymmetrical compositions. The artwork must lead; the interface must frame it. Do not cover every surface with saturated colour or generic Indian decorative clichés.
>
> Build an experience with distinct destinations: Discover, Exhibitions, Art Forms, Artists, Shop, Stories, and Custom Art. The homepage should open with an immersive art-led scene, invite visitors into different discovery paths, feature a curated exhibition, show genuine process content, introduce an artist/maker, include a small curated shopping moment, and give custom art a clear path. It must not be a repeated sequence of equal card grids.
>
> Create page templates for art-form stories, digital exhibitions and chapters, artist/maker profiles, editorial stories, collections, shop browsing, product detail, and custom-art requests. A product detail page must include strong image inspection, accurate purchase information, story, maker/artist credit where verified, process, materials, dimensions, care, availability, delivery, and related works. Preserve clear and fast cart/checkout behavior.
>
> Retain Next.js, React, TypeScript, Medusa v2, PostgreSQL, the existing shared UI packages, and Sanity if the current repository confirms they are in use and healthy. Medusa remains the source of truth for products, variants, price, inventory, carts, orders, payments, and fulfilment. Sanity manages editorial content and links to Medusa products by stable identifiers. Do not duplicate commerce records in the CMS.
>
> Optimize all visual assets. Use responsive image delivery, explicit aspect ratios, lazy loading below the fold, poster-backed video, captions/transcripts, reduced-motion behavior, keyboard support, visible focus states, and accessible contrast. Do not autoplay audio or hijack scrolling. Ensure the design works on mobile and constrained connections.
>
> Use real, rights-cleared product and cultural imagery. Never invent an artist, place, origin, process, social impact, or cultural meaning. Maintain credits and permissions. Empty pages and placeholder content must not be published as finished experiences.
>
> Implement in phases: repository audit; brand and art direction; information architecture/content strategy; wireframes/prototypes; design system; homepage/shell; Discover/Art Forms/Exhibitions/Artists/Stories; Shop/Product; Custom Art/Account/Social; SEO/Performance/Accessibility/QA; staged launch. Each phase must have tests and acceptance criteria.
>
> Preserve existing working backend functionality and add regression coverage before changing it. Do not silently weaken security or dependency controls. Verify Razorpay and Shiprocket end-to-end in the appropriate test environment. Do not call the project production-ready until the catalogue, payments, fulfilment, security, SEO, accessibility, and monitoring checks have passed.
>
> Before declaring completion, demonstrate the actual site at desktop, tablet, and mobile sizes. Show at least the homepage, one art-form page, one exhibition, one artist profile, one product detail page, shop, custom-art flow, cart, and checkout. The result must clearly feel like an Indian art and culture destination, while remaining a reliable single-brand commerce website.

---

## 23. Research links and source notes

The observations in Section 2 are based on these public references reviewed on 6 November 2026. Sites change frequently; revisit them during visual design, and treat the notes as patterns observed at research time rather than permanent descriptions.

### Indian art, craft, and commerce references

- [Gaatha — Stories of Indian Handicrafts](https://gaatha.com/)
- [Google Arts & Culture — Crafted in India](https://artsandculture.google.com/project/crafted-in-india)
- [Google Arts & Culture — Indian Crafts in Brief](https://artsandculture.google.com/project/indian-crafts-in-brief)
- [Museum of Art & Photography, Bengaluru](https://map-india.org/)
- [MAP — Exhibitions](https://map-india.org/exhibitions/)
- [MAP — Digital Guide](https://map-india.org/our-digital-guide/)
- [Artisera](https://www.artisera.com/)
- [Artisera — About](https://www.artisera.com/pages/about)
- [The India Craft House](https://theindiacrafthouse.com/)
- [Jaypore](https://www.jaypore.com/)
- [Jaypore — About](https://www.jaypore.com/content/about)
- [Okhai — About Us](https://okhai.org/pages/about-us)
- [Good Earth — Our World](https://www.goodearth.in/our-world/)
- [Raw Mango — About](https://rawmango.com/pages/raw-mango)
- [Saffronart](https://www.saffronart.com/)
- [Nappa Dori — About](https://www.nappadori.com/pages/about-us)
- [Nappa Dori — Dori Chronicles](https://www.nappadori.com/pages/dori-chronicles)

### Digital experience references

- [Google Arts & Culture](https://artsandculture.google.com/)
- [Rijksmuseum webshop experience case study](https://www.strix.net/en/case-studies/implementation-of-shopware-for-the-rijksmuseum)
- [Louisiana Museum digital experience case study](https://www.deptagency.com/case/bringing-art-to-life-in-a-digital-manner/)

### Notes on interpretation

- This document does not claim SnehaVrinda Kala has the same scale, artisan network, inventory depth, or institutional authority as any reference brand.
- The strategy is to learn from their experience patterns while building a distinct identity around the actual SnehaVrinda Kala catalogue, team, artists, makers, and content.
- The current repository audit supplied in the conversation is the baseline for technical remediation. Re-check its findings against the latest commit before acting on them.

---

## Final recommendation

Do not redesign SnehaVrinda Kala as “a more colourful e-commerce website”. Redesign it as **an art house with a shop inside it**.

The first release should invest in three things above everything else:

1. **A distinctive visual world** — strong art direction, authentic imagery, varied compositions, and a consistent identity.
2. **A real cultural discovery experience** — art-form stories, exhibitions, artist/maker profiles, process, and connected editorial content.
3. **A frictionless shop** — accurate product information, dependable checkout, clear fulfilment, and a thoughtful custom-art enquiry path.

If these three parts work together, visitors will not only see products. They will experience the world of SnehaVrinda Kala and have a reason to return.
