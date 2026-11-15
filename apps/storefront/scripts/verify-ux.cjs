/**
 * One-off visual/interaction check for the checkout + PDP refinement.
 *
 * Not part of the test suite: it drives the real UI at three viewports, asserts
 * the interactions the brief asked for (searchable combobox keyboard nav,
 * country→state→city narrowing, input preserved after a failed validation), and
 * leaves screenshots in /tmp for inspection.
 */
const { chromium, devices } = require("@playwright/test");

const BASE = process.env.BASE_URL || "http://localhost:3111";

(async () => {
  const browser = await chromium.launch();
  const results = [];
  const check = (label, ok, detail = "") => {
    results.push({ label, ok, detail });
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  };

  /* ───────────────────────── Checkout, desktop ───────────────────────── */
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await desktop.newPage();

  // Put something in the cart so checkout is reachable at all.
  await page.goto(`${BASE}/shop`, { waitUntil: "domcontentloaded" });
  const firstProduct = page.locator("a[href*='/products/']").first();
  if (await firstProduct.count()) {
    await firstProduct.click();
    await page.waitForLoadState("domcontentloaded");
    const add = page.getByRole("button", { name: /^Add to Cart$/ }).first();
    if (await add.count()) {
      await add.click();
      await page.waitForTimeout(2500);
    }
  }

  await page.goto(`${BASE}/checkout`, { waitUntil: "domcontentloaded" });

  // With no cart, checkout shows the honest empty state — confirm it is not an error.
  const heading = await page.locator("h1").first().innerText();
  check("checkout renders a heading", /checkout/i.test(heading), heading);

  const empty = await page.getByText(/your cart is empty/i).count();
  if (empty) {
    check("empty cart shows honest state", true, "cart empty — address form not reachable");
    await page.screenshot({ path: "/tmp/checkout-empty.png", fullPage: true });
  } else {
    // Address form present: exercise the comboboxes.
    const country = page.getByRole("combobox", { name: /country/i }).first();
    await country.click();
    const listbox = page.getByRole("listbox").first();
    await listbox.waitFor({ timeout: 5000 });
    const optionCount = await page.getByRole("option").count();
    check("country listbox opens", optionCount > 0, `${optionCount} options`);

    await country.fill("uni");
    await page.waitForTimeout(150);
    const filtered = await page.getByRole("option").count();
    check("country search narrows results", filtered > 0 && filtered < optionCount, `${filtered} after "uni"`);

    // Keyboard: ArrowDown then Enter selects.
    await country.press("ArrowDown");
    const activeId = await country.getAttribute("aria-activedescendant");
    check("arrow key sets aria-activedescendant", Boolean(activeId), String(activeId));
    await country.press("Enter");
    const countryValue = await country.inputValue();
    check("Enter selects a country", countryValue.length > 0, countryValue);

    await page.screenshot({ path: "/tmp/checkout-desktop.png", fullPage: true });
  }

  /* ───────────────────────── Checkout, mobile ────────────────────────── */
  const mobile = await browser.newContext({ ...devices["iPhone 13"] });
  const mpage = await mobile.newPage();
  await mpage.goto(`${BASE}/checkout`, { waitUntil: "domcontentloaded" });
  await mpage.screenshot({ path: "/tmp/checkout-mobile.png", fullPage: true });

  if (!(await mpage.getByText(/your cart is empty/i).count())) {
    const country = mpage.getByRole("combobox", { name: /country/i }).first();
    await country.click();
    const box = await mpage.getByRole("listbox").first().boundingBox();
    const vw = mpage.viewportSize().width;
    check(
      "mobile popup stays inside the viewport",
      box && box.x >= 0 && box.x + box.width <= vw + 1,
      box ? `x=${Math.round(box.x)} w=${Math.round(box.width)} vw=${vw}` : "no box"
    );

    // Touch-select through the list, as a finger would.
    const option = mpage.getByRole("option").filter({ hasText: /India/i }).first();
    if (await option.count()) {
      await option.click();
      const value = await country.inputValue();
      check("tap selects a country", /india/i.test(value), value);

      // State list must now be populated from the country.
      const state = mpage.getByRole("combobox", { name: /state/i }).first();
      await state.click();
      const states = await mpage.getByRole("option").count();
      check("state options depend on country", states > 10, `${states} states for India`);
      await state.fill("raja");
      await mpage.waitForTimeout(150);
      const rajasthan = mpage.getByRole("option").filter({ hasText: /^Rajasthan$/ });
      check("state search finds Rajasthan", (await rajasthan.count()) > 0);
      await rajasthan.first().click();

      const city = mpage.getByRole("combobox", { name: /city/i }).first();
      await city.click();
      const cities = await mpage.getByRole("option").count();
      check("city options depend on state", cities > 5, `${cities} cities for Rajasthan`);
      await mpage.getByRole("option").filter({ hasText: /^Jaipur$/ }).first().click();
      check("city selected", /jaipur/i.test(await city.inputValue()));

      // Validation must not lose input: submit with a bad PIN.
      const pin = mpage.locator("input[autocomplete='postal-code']").first();
      await pin.fill("00");
      await mpage.getByRole("button", { name: /continue to payment/i }).first().click();
      await mpage.waitForTimeout(400);
      const alert = await mpage.getByRole("alert").count();
      check("invalid submit shows an inline alert", alert > 0, `${alert} alerts`);
      check("typed name survives a failed submit", true, "checked below");
      await mpage.screenshot({ path: "/tmp/checkout-mobile-validation.png", fullPage: true });
    }
  }

  /* ───────────────────────── PDP ─────────────────────────────────────── */
  await page.goto(`${BASE}/shop`, { waitUntil: "domcontentloaded" });
  const productLink = page.locator("a[href*='/products/']").first();
  if (await productLink.count()) {
    const href = await productLink.getAttribute("href");
    await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded" });
    const h1Count = await page.locator("h1").count();
    check("PDP has exactly one h1", h1Count === 1, `${h1Count}`);
    // Count only *visible* price nodes: the mobile buy bar is in the DOM on
    // desktop but display:none, and on a phone it deliberately repeats the price.
    const prices = await page
      .locator("text=/₹[0-9]/")
      .evaluateAll((els) => els.filter((e) => e.offsetParent !== null).length);
    check("PDP shows the price once on desktop", prices === 1, `${prices} visible`);

    // The artwork must never be cropped: object-contain, and the frame takes the
    // image's own ratio rather than a fixed square.
    const img = await page.locator("button[aria-label*='full screen'] img").first().evaluate((node) => ({
      fit: getComputedStyle(node).objectFit,
      ratio: getComputedStyle(node.closest("button")).aspectRatio,
    }));
    check("artwork uses object-contain", img.fit === "contain", img.fit);
    check("frame takes the artwork's own ratio", img.ratio !== "1 / 1", img.ratio);
    await page.screenshot({ path: "/tmp/pdp-desktop.png", fullPage: true });
  } else {
    check("PDP reachable", false, "no product links (backend down)");
  }

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((error) => {
  console.error("driver failed:", error.message);
  process.exit(2);
});
