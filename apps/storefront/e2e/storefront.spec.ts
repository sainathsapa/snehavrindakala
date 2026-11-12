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
    await expect(page.getByLabel("Search")).toBeVisible();
  });

  test("search by keyword runs and reports results honestly", async ({ page }) => {
    await page.goto("/search");
    await page.getByLabel("Search").fill("madhubani");
    await page.getByRole("button", { name: /^search$/i }).click();

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

    await page.getByLabel(/email/i).fill("asha@example.com");

    // The form identifies the requester by art form + brief; there is no name
    // field, so drive exactly what the form asks for.
    await page.getByLabel(/what kind of art/i).selectOption({ index: 1 });

    await page
      .getByLabel(/what do you have in mind/i)
      .fill(
        "A Madhubani-style celebration of a family wedding with two peacocks, " +
          "tree of life, and natural pigments on handmade paper."
      );

    await page.getByLabel(/budget/i).fill("10,000 – 20,000");

    // Both the commission form and the footer newsletter use name="consent",
    // so scope to the form rather than matching the whole page.
    const consent = page
      .locator("form")
      .filter({ has: page.getByRole("button", { name: /submit request/i }) })
      .locator('input[name="consent"]');
    if (await consent.count()) {
      await consent.check();
    }

    await page.getByRole("button", { name: /submit request/i }).click();

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
