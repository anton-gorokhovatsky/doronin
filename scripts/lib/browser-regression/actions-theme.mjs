import { expect } from "../check-assertions.mjs";

export async function checkActionsAndTheme({ page, testCase, prefix }) {
  const menuToggle = page.locator(".menu-toggle");
  const nav = page.locator(".site-nav");
  const actionSystem = await page.evaluate(() => {
    const selectors = [".hero .button--primary", ".site-nav__cta", ".site-footer__cta"];
    const core = selectors.map((selector) => {
      const style = getComputedStyle(document.querySelector(selector));
      return [
        style.backgroundColor,
        style.color,
        style.fontWeight,
        style.textTransform,
      ];
    });
    return {
      core,
      minHeights: selectors.map((selector) =>
        parseFloat(getComputedStyle(document.querySelector(selector)).minHeight),
      ),
      menuLabel: document
        .querySelector(".site-nav__cta span")
        ?.textContent.trim()
        .replace(/\s+/g, " "),
      footerLabel: document
        .querySelector(".site-footer__cta")
        ?.textContent.trim()
        .replace(/\s+/g, " "),
      partnerBackground: getComputedStyle(
        document.querySelector(".partners__closing"),
      ).backgroundColor,
      primaryBackground: getComputedStyle(
        document.querySelector(".hero .button--primary"),
      ).backgroundColor,
    };
  });
  expect(
    actionSystem.core.every(
      (value) => JSON.stringify(value) === JSON.stringify(actionSystem.core[0]),
    ) &&
      actionSystem.minHeights.every((height) => height >= 56) &&
      actionSystem.menuLabel === testCase.conversionLabel &&
      actionSystem.footerLabel === (testCase.path.startsWith("/en") ? "Read the diary" : "Читать дневник") &&
      actionSystem.partnerBackground === actionSystem.primaryBackground,
    `${prefix}: primary CTA system diverged (${JSON.stringify(actionSystem)})`,
  );

  await nav.getByRole("button", { name: testCase.lightLabel, exact: true }).click();
  expect(
    (await page.locator("html").getAttribute("data-theme")) === "light" &&
      (await page.locator("html").getAttribute("class")).includes("theme-light"),
    `${prefix}: light theme did not activate`,
  );
  await nav.getByRole("button", { name: testCase.darkLabel, exact: true }).click();
  expect(
    (await page.locator("html").getAttribute("data-theme")) === "dark" &&
      (await page.locator("html").getAttribute("class")).includes("theme-dark"),
    `${prefix}: dark theme did not activate`,
  );

  await nav.locator('[data-theme-option="auto"]').click();
  await menuToggle.click();
  await page.waitForFunction(
    () => document.querySelector(".nav-shell")?.open === false,
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(180);
  const heroMediaState = await page.evaluate(() => {
    const video = document.querySelector("[data-hero-video]");
    const toggle = document.querySelector(".hero__media-toggle");
    const style = toggle ? getComputedStyle(toggle) : null;
    return {
      controlHidden: toggle?.hidden === true,
      controlDisplay: style?.display || "none",
      controlVisibility: style?.visibility || "hidden",
      posterPath: video?.poster ? new URL(video.poster).pathname : "",
    };
  });
  const usableMediaControl =
    !heroMediaState.controlHidden &&
    heroMediaState.controlDisplay !== "none" &&
    heroMediaState.controlVisibility !== "hidden";
  const verifiedPosterFallback =
    heroMediaState.posterPath.endsWith("/assets/hero.jpg");
  expect(
    usableMediaControl || verifiedPosterFallback,
    `${prefix}: hero media has neither a usable control nor a verified poster fallback (${JSON.stringify(heroMediaState)})`,
  );

}
