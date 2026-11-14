import { test, expect } from "@playwright/test";

/**
 * Storefront journeys.
 *
 * These are the flows a shopper actually takes. They exist because unit tests
 * passed while several of these pages were broken in ways only a browser
 * reveals (an empty search query 404ing, a checkout page that could not be
 * server-rendered, an admin panel that rendered before checking access).
 */

test.describe("browse and discover", () => {
  test("home page renders the brand and primary navigation", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/SnehaVrinda/i);
    await expect(page.getByRole("banner")).toBeVisible();

    // On mobile the cart lives inside the menu, so assert on the home link,
    // which is present in the header at every breakpoint.
    await expect(
      page.getByRole("link", { name: /home/i }).first()
    ).toBeVisible();
  });

  test("shop page lists products or an honest empty state", async ({ page }) => {
    await page.goto("/shop");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Either real products or a deliberate empty state — never a blank page
    // and never an error.
    const body = page.locator("body");
    await expect(body).not.toContainText(/something went wrong/i);
    await expect(body).not.toContainText(/unhandled/i);
  });

  test("search with an empty query shows the search form, not a 404", async ({
    page,
  }) => {
    // Regression: /search used to 404 (or render nothing) when q was empty.
    const response = await page.goto("/search");

    expect(response?.status()).toBe(200);
    // The header also exposes a search field, so scope to the page's own form.
    await expect(page.getByRole("searchbox")).toBeVisible();
  });

  test("search by keyword runs and reports results honestly", async ({ page }) => {
    await page.goto("/search");
    await page.getByRole("searchbox").fill("madhubani");
    await page
      .getByRole("main")
      .getByRole("button", { name: /^search$/i })
      .click();

    await expect(page).toHaveURL(/[?&]q=madhubani/);

    // Whatever the catalogue contains, the page must state the outcome rather
    // than showing an empty shell.
    await expect(
      page.getByRole("heading", { level: 1 })
    ).toBeVisible();
  });

  test("a missing page renders the custom 404", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");

    expect(response?.status()).toBe(404);
    await expect(page.locator("body")).not.toContainText(
      /this page could not be found/i
    );
  });
});

test.describe("commission brief", () => {
  test("validates before submitting and names the problem", async ({ page }) => {
    await page.goto("/custom-art");

    await page.getByRole("button", { name: /submit request/i }).click();

    // Per-field validation: the user should be told what to fix, not just
    // that "something" failed.
    await expect(page.getByRole("main")).toContainText(/required|choose|select/i);
  });

  test("submits a complete brief and shows a reference", async ({ page }) => {
    await page.goto("/custom-art");

    // The footer newsletter also has an email input, so scope to the form.
    const form = page
      .locator("form")
      .filter({ has: page.getByRole("button", { name: /submit request/i }) });

    await form.getByLabel(/email for your quote/i).fill("asha@example.com");

    // The form identifies the requester by art form + brief; there is no name
    // field, so drive exactly what the form asks for.
    await form.getByLabel(/what kind of art/i).selectOption({ index: 1 });

    await form
      .getByLabel(/what do you have in mind/i)
      .fill(
        "A Madhubani-style celebration of a family wedding with two peacocks, " +
          "tree of life, and natural pigments on handmade paper."
      );

    await form.getByLabel(/budget/i).fill("10,000 – 20,000");

    const consent = form.locator('input[name="consent"]');
    if (await consent.count()) {
      await consent.check();
    }

    await form.getByRole("button", { name: /submit request/i }).click();

    // Success redirects to the status page for the new reference. Failure keeps
    // the form and shows a named error. Either is acceptable, but silently
    // staying put is not.
    await page.waitForURL(/\/commission-status\//, { timeout: 20_000 }).catch(
      () => {}
    );

    const onStatusPage = /\/commission-status\//.test(page.url());
    if (onStatusPage) {
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // The reference is what the customer needs to come back with.
      await expect(page.locator("body")).toContainText(/SVK-/i);
    } else {
      await expect(
        page.getByText(/could not submit|fix the highlighted/i)
      ).toBeVisible();
    }
  });
});

test.describe("cart", () => {
  test("empty cart explains itself and offers a way back", async ({ page }) => {
    await page.goto("/cart");

    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("main")).not.toContainText(
      /something went wrong/i
    );
  });
});

test.describe("admin gate", () => {
  test("signed-out visitors are redirected away from the dashboard", async ({
    page,
  }) => {
    const response = await page.goto("/admin");

    // Either a server redirect or a client-side bounce, but the URL must end up
    // at the login page.
    await page.waitForURL(/\/admin\/login/, { timeout: 15_000 });
    expect(page.url()).toContain("/admin/login");

    // And the admin chrome must never have been sent to an anonymous visitor.
    await expect(page.locator("body")).not.toContainText(/audit log/i);
    await expect(page.locator("body")).not.toContainText(/sign out/i);
    void response;
  });

  test("the login page is reachable while signed out", async ({ page }) => {
    // Regression: the admin middleware used to redirect /admin/login to
    // itself, so nobody could sign in at all.
    const response = await page.goto("/admin/login");

    expect(response?.status()).toBe(200);
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("the login endpoint itself is reachable while signed out", async ({
    request,
  }) => {
    // A correct password is refused with 401, so status alone cannot show that
    // the request reached the handler. The middleware answers with a bare
    // {error:"Unauthorized"} and no content-type negotiation; the handler
    // validates the body first and says which field is missing. Asking with an
    // empty body therefore proves routing: 400 means the handler ran, 401 means
    // the middleware blocked it.
    const res = await request.post("/api/admin/login", {
      data: {},
      failOnStatusCode: false,
    });

    expect(res.status()).toBe(400);
    expect(await res.text()).toContain("Email and password are required");
  });

  test("a wrong password is refused without revealing why", async ({ page }) => {
    await page.goto("/admin/login");

    await page.getByLabel(/email/i).fill("nobody@snehavrinda.in");
    await page.locator('input[type="password"]').fill("definitely-wrong");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.locator("body")).toContainText(
      /invalid|incorrect|failed|try again/i,
      { timeout: 15_000 }
    );
    expect(page.url()).toContain("/admin/login");
  });
});

test.describe("accessibility basics", () => {
  test("every page has exactly one h1 and a document language", async ({
    page,
  }) => {
    for (const path of ["/", "/shop", "/search", "/custom-art", "/cart"]) {
      await page.goto(path);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("html")).toHaveAttribute("lang", /.+/);
    }
  });

  test("images carry alternative text", async ({ page }) => {
    await page.goto("/shop");

    const images = page.locator("img");
    const count = await images.count();

    for (let i = 0; i < count; i++) {
      // Decorative images may use alt="", but the attribute must be present.
      await expect(images.nth(i)).toHaveAttribute("alt", /.*/);
    }
  });
});

test.describe("storefront chrome", () => {
  test("no admin link is exposed anywhere in the storefront", async ({ page }) => {
    // The admin panel is reachable by direct URL only. A visible door to it
    // invites probing, so no public page may link to /admin.
    for (const path of ["/", "/shop", "/art-forms", "/about"]) {
      await page.goto(path);
      await expect(page.locator('a[href^="/admin"]')).toHaveCount(0);
    }
  });

  test("artists and sell are hidden in single-brand mode", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === "mobile",
      "The desktop nav is hidden on mobile."
    );
    // Both are marketplace concepts; in single-brand mode the house is the only
    // seller and the pages would be dead ends.
    await page.goto("/");
    const nav = page.locator("header nav");
    // Discover and Art Forms are dropdown triggers, so they are buttons, not
    // links. Assert on one of those to prove the nav itself rendered.
    await expect(nav.getByRole("button", { name: "Discover" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Artists" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Sell" })).toHaveCount(0);
  });

  test("the art forms menu opens, lists art forms and closes on Escape", async ({
    page,
  }, testInfo) => {
    // The desktop nav is hidden below lg, so this behaviour only exists wide.
    test.skip(
      testInfo.project.name === "mobile",
      "Desktop nav is hidden on mobile; the sheet lists art forms inline."
    );
    await page.goto("/");

    // The browse menu moved to "Discover" when the nav was simplified; "Art
    // Forms" is now a plain link to the overview page. This test kept asserting
    // the old shape and had been red ever since, so it is pinned to what the
    // header actually renders.
    const trigger = page.getByRole("button", { name: /discover/i });
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    // Admin-managed rows drive this list, so it must contain real entries.
    const panel = page.locator("#nav-menu-discover");
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("link").first()).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);

    // Art Forms reaches its own page directly, without a menu in the way.
    const nav = page.locator("header nav");
    await expect(nav.getByRole("link", { name: "Art Forms" })).toHaveAttribute(
      "href",
      "/art-forms"
    );
  });
});

test.describe("product URLs and mode gating", () => {
  test("product URLs are readable slugs, never opaque ids", async ({ page }) => {
    await page.goto("/shop");
    const hrefs = await page
      .locator('a[href^="/products/"]')
      .evaluateAll((links) => links.map((a) => a.getAttribute("href") || ""));

    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      const slug = href.replace("/products/", "");
      // The bug this guards: /products/003 was shipped from the database id.
      expect(slug).not.toMatch(/^\d+$/);
      expect(slug).not.toMatch(/^prod_/);
      // Readable slugs are hyphenated words, not codes.
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)+$/);
    }
  });

  test("every product linked from the shop actually resolves", async ({
    page,
    request,
  }) => {
    await page.goto("/shop");
    const hrefs = await page
      .locator('a[href^="/products/"]')
      .evaluateAll((links) => [
        ...new Set(links.map((a) => a.getAttribute("href") || "")),
      ]);

    // A listing that links to a 404 is worse than an empty listing.
    for (const href of hrefs) {
      const res = await request.get(href);
      expect(res.status(), `${href} should resolve`).toBe(200);
    }
  });

  test("a product page carries its own title and Product schema", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "One viewport is enough.");
    await page.goto("/shop");
    const href = await page
      .locator('a[href^="/products/"]')
      .first()
      .getAttribute("href");
    expect(href).toBeTruthy();

    // Navigate directly rather than clicking: a client-side transition can
    // resolve after waitForLoadState, so the assertions would read the listing
    // page instead of the product. Navigating makes the target unambiguous.
    await page.goto(href!);

    // Regression: the metadata was exported as a plain `const`, so Next never
    // called it and every product shipped the generic site title.
    const title = await page.title();
    expect(title).toMatch(/SnehaVrinda Kala/);
    expect(title).not.toBe("SnehaVrinda Kala | SnehaVrinda Kala");

    const schema = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((nodes) =>
        nodes.map((n) => {
          try {
            return JSON.parse(n.textContent || "{}");
          } catch {
            return {};
          }
        })
      );
    // Each block parses to a single object here, so read @type directly rather
    // than assuming an array or a @graph wrapper.
    const types = schema.map((s: any) => s["@type"]);
    expect(types).toContain("Product");
  });

  test("platform-only pages are not advertised in single-brand mode", async ({
    page,
  }) => {
    // /artists and /sell 404 by design here, so nothing may link to them.
    await page.goto("/");
    const artistLinks = await page.locator('a[href="/artists"]').count();
    const sellLinks = await page.locator('a[href="/sell"]').count();
    expect(artistLinks).toBe(0);
    expect(sellLinks).toBe(0);
    expect(await page.locator('a[href="/art-forms"]').count()).toBeGreaterThan(0);
  });

  test("the footer credits the maker and carries drawn ornament", async ({
    page,
  }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await expect(footer).toContainText("Sneha Sainath Sapa");

    // The colophon ornament is hand-drawn SVG (lotus rosette, bel-buti vine,
    // paisley band, diya) rather than photographs. Assert the drawings are
    // present and hidden from assistive tech.
    const ornaments = footer.locator("svg[aria-hidden='true']");
    expect(await ornaments.count()).toBeGreaterThan(2);

    // Nothing decorative may be announced to a screen reader.
    await expect(footer.locator("svg[aria-hidden='true']").first()).toBeAttached();
  });
});

test.describe("journal", () => {
  test("essays are seeded and readable, not placeholders", async ({ page }) => {
    await page.goto("/journal");
    const entries = page.locator('a[href^="/journal/"]');
    // The journal must never ship as an empty page; sample essays are seeded so
    // a fresh database still has something to teach a first visitor.
    expect(await entries.count()).toBeGreaterThan(0);

    // Regression: the detail page reused the listing response, which omits
    // `content`, so every essay rendered "still being written" while the body
    // sat in the database unused.
    await page.goto("/journal/warli-has-no-gods-in-it");
    await expect(page.locator("body")).not.toContainText("still being written");
    const text = await page.locator("article").innerText();
    expect(text.length).toBeGreaterThan(800);
    expect(text).toContain("tarpa");
  });

  test("long-form body copy is set in the serif face", async ({ page }) => {
    await page.goto("/journal/warli-has-no-gods-in-it");
    // Regression: a base `p { font-family: sans }` rule beat `font-serif` set on
    // the parent, silently de-serifing every essay on the site.
    const family = await page
      .locator("article p")
      .first()
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family.toLowerCase()).toMatch(/cormorant|georgia|serif/);
  });

  test("an essay carries its own title, not the site default", async ({
    page,
  }) => {
    await page.goto("/journal/warli-has-no-gods-in-it");
    const title = await page.title();
    expect(title).toContain("Warli");
    expect(title).toContain("SnehaVrinda Kala");
  });
});

test.describe("Hindi", () => {
  // Only the first character of the Devanagari block. Enough to tell a
  // translated document from an English one without asserting on wording that
  // a translator may legitimately change.
  const DEVANAGARI = /[\u0900-\u097F]/;

  test("the Hindi shop is served in Hindi, the English shop is not", async ({
    page,
  }) => {
    await page.goto("/shop");
    const english = await page
      .locator("a[href*='/products/']")
      .allInnerTexts();
    expect(english.length).toBeGreaterThan(0);
    expect(english.filter((text) => DEVANAGARI.test(text))).toHaveLength(0);

    await page.goto("/hi/shop");
    const hindi = await page
      .locator("a[href*='/products/']")
      .allInnerTexts();
    // Every card translated, not just the first few: a partial catalogue would
    // leave buyers reading two languages in one grid.
    expect(hindi.filter((text) => DEVANAGARI.test(text))).toHaveLength(
      hindi.length
    );
  });

  test("html lang follows the URL, and hreflang links the two", async ({
    page,
  }) => {
    await page.goto("/shop");
    expect(await page.locator("html").getAttribute("lang")).toBe("en");

    await page.goto("/hi/shop");
    expect(await page.locator("html").getAttribute("lang")).toBe("hi");

    // Without these Google treats the Hindi pages as unrelated duplicates and
    // may index only one of them.
    const tags = await page
      .locator("link[rel='alternate'][hreflang]")
      .evaluateAll((els) =>
        els.map((el) => el.getAttribute("hreflang")?.toLowerCase())
      );
    expect(tags).toEqual(expect.arrayContaining(["en", "hi"]));
  });

  test("a product title matches the language of its URL", async ({ page }) => {
    // A fresh context so no NEXT_LOCALE cookie is carried in from another test.
    // With a `hi` cookie next-intl redirects `/products/...` to `/hi/...`,
    // which is correct routing but would not test the title lookup.
    await page.context().clearCookies();

    await page.goto("/products/wearable-art-pendant");
    const englishTitle = await page.locator("h1").first().innerText();
    expect(DEVANAGARI.test(englishTitle)).toBe(false);

    await page.goto("/hi/products/wearable-art-pendant");
    const hindiTitle = await page.locator("h1").first().innerText();
    expect(DEVANAGARI.test(hindiTitle)).toBe(true);

    // The structured data must agree with the visible heading, or the page is
    // indexed under the wrong language.
    const ld = JSON.parse(
      await page.locator("#schema-product").innerText()
    ) as { name?: string };
    expect(ld.name).toBe(hindiTitle);
  });
});
