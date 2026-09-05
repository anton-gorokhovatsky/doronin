import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { period } = JSON.parse(await readFile(
  new URL("../../src/project-plan.json", import.meta.url), "utf8",
));

export async function checkEditorialInitial(page, requestedPaths) {
  assert.equal(requestedPaths.some((path) =>
    /\/(?:story-motion-city(?:-1800)?|story-cycling|partner-community-motion)\.jpg$/u.test(path),
  ), false, "Below-fold decorative photos must not load on arrival");
  const state = await page.evaluate(() => {
    const copy = document.querySelector("[data-diary-story-panel] .diary__copy:has(.diary__lead)");
    return {
      backgrounds: [...document.querySelectorAll(".velocity-cut")]
        .map((cut) => getComputedStyle(cut, "::before").backgroundImage),
      lead: getComputedStyle(copy.querySelector(".diary__lead")).fontSize,
      note: getComputedStyle(copy.querySelector(".diary__note")).fontSize,
    };
  });
  assert(state.backgrounds.every((background) => background === "none"));
  assert.equal(state.note, state.lead, "Both halves of diary copy need the same reading size");
}

export async function checkEditorialFallback(browser, origin, testCase) {
  const context = await browser.newContext({
    viewport: testCase.viewport, javaScriptEnabled: false, reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.route(/\.(?:avif|gif|jpe?g|mp4|png|webm|webp)(?:\?.*)?$/iu,
    (route) => route.abort());
  try {
    await page.goto(`${origin}${testCase.path}`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    const date = page.locator("[data-footer-countdown] time");
    assert.equal(await date.getAttribute("datetime"), period.startDate);
    assert((await date.innerText()).includes(period.startDate.slice(0, 4)));
    assert.equal(await page.locator("[data-diary-countdown]").innerText(),
      String(new Date(`${period.startDate}T12:00:00Z`).getUTCDate()));
    assert((await page.locator("[data-diary-countdown-label]").innerText())
      .includes(period.startDate.slice(0, 4)));
    assert.equal(await page.locator("[data-timeline-now]").isVisible(), false);
    assert.equal(await page.locator(".diary-live__timeline > span").evaluate(
      (track) => getComputedStyle(track, "::before").display,
    ), "none");
    assert(!/через\s+скоро|begins\s+in\s+soon/u.test(
      (await page.locator("#footer-title").innerText()).replace(/\s+/gu, " "),
    ));
    assert.equal(await page.evaluate(() =>
      document.documentElement.scrollWidth <= innerWidth), true);
  } finally {
    await context.close();
  }
}

export async function checkDeferredDecoration(page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const cut = page.locator(".velocity-cut").first();
  await cut.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const target = document.querySelector(".velocity-cut");
    return target.classList.contains("is-velocity-loaded") &&
      getComputedStyle(target, "::before").backgroundImage !== "none";
  });
}
