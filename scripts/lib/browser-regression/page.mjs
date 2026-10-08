import { checkEditorialInitial, checkEditorialFallback, checkDeferredDecoration, checkUpperPageRoutes } from "../editorial-checks.mjs";
import { expect } from "../check-assertions.mjs";
import { checkHero } from "./hero.mjs";
import { checkMenuTrigger } from "./menu-trigger.mjs";
import { checkMenuLayout } from "./menu-layout.mjs";
import { checkActionsAndTheme } from "./actions-theme.mjs";
import { checkCalendarAndPortrait } from "./calendar-portrait.mjs";
import { checkDiary } from "./diary.mjs";
import { checkProofAndFooter } from "./proof-footer.mjs";
import { checkAnalyticsAndPhases } from "./analytics-phases.mjs";

export async function auditPage(browser, browserName, origin, testCase) {
  const context = await browser.newContext({
    reducedMotion: "no-preference",
    viewport: testCase.viewport,
  });
  const page = await context.newPage();
  // The standard-site contract is independent of the runner calendar.
  await page.clock.setFixedTime(new Date("2026-10-06T12:00:00+03:00"));
  const errors = [];
  const requestedPaths = [];
  page.on("request", (request) => requestedPaths.push(new URL(request.url()).pathname));
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://mc.yandex.ru/**", (route) => route.abort());
  await page.route("https://api.met.no/**", (route) => route.abort());
  // The screenshot gate validates the actual imagery. This suite validates
  // layout and interaction, whose media boxes have explicit CSS geometry.
  // Avoid decoding the full 51 MB asset set again on the small CI runner: a
  // decoded 2 MB JPEG alone can occupy tens of megabytes inside WebKit.
  await page.route(
    /\.(?:avif|gif|jpe?g|m4a|mp4|png|webm|webp)(?:\?.*)?$/iu,
    (route) => route.abort(),
  );
  await page.addInitScript(() => {
    window.__analyticsCalls = [];
    window.ym = (...args) => window.__analyticsCalls.push(args);
  });

  try {
    await page.goto(`${origin}${testCase.path}`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    await checkEditorialInitial(page, requestedPaths);
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );

    const prefix = `${browserName} ${testCase.name}`;
    const scenario = { page, browserName, origin, testCase, prefix };
    await checkHero(scenario);
    await checkMenuTrigger(scenario);
    await checkMenuLayout(scenario);
    await checkActionsAndTheme(scenario);
    await checkCalendarAndPortrait(scenario);
    await checkDiary(scenario);
    await checkProofAndFooter(scenario);
    await checkAnalyticsAndPhases(scenario);

    await checkUpperPageRoutes(page);
    expect(errors.length === 0, `${prefix}: page errors: ${errors.join("; ")}`);
    await checkDeferredDecoration(page);
    await checkEditorialFallback(browser, origin, testCase);
    return `${prefix}: PASS`;
  } finally {
    await context.close();
  }
}
