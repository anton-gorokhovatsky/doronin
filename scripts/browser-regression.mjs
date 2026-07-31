import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { chromium, webkit } from "playwright";

import { startSiteServer } from "./lib/site-server.mjs";

const execFileAsync = promisify(execFile);

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function near(first, second, tolerance = 0.75) {
  return Math.abs(first - second) <= tolerance;
}

async function auditPage(browser, browserName, origin, testCase) {
  const context = await browser.newContext({
    reducedMotion: "no-preference",
    viewport: testCase.viewport,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://mc.yandex.ru/**", (route) => route.abort());
  await page.addInitScript(() => {
    window.__analyticsCalls = [];
    window.ym = (...args) => window.__analyticsCalls.push(args);
  });

  try {
    await page.goto(`${origin}${testCase.path}`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);

    const prefix = `${browserName} ${testCase.name}`;
    const geometry = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(
      geometry.scrollWidth <= geometry.clientWidth,
      `${prefix}: horizontal overflow ${geometry.scrollWidth - geometry.clientWidth}px`,
    );
    expect(await page.locator("h1").count() === 1, `${prefix}: expected one h1`);
    expect(await page.locator(".button--primary").isVisible(), `${prefix}: primary CTA hidden`);

    const menuToggle = page.locator(".menu-toggle");
    const initialBox = await menuToggle.boundingBox();
    expect(initialBox, `${prefix}: menu trigger has no box`);
    for (const y of [220, 900, 1500]) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(80);
      const box = await menuToggle.boundingBox();
      expect(box, `${prefix}: menu trigger disappeared at ${y}`);
      expect(
        near(box.x, initialBox.x) &&
          near(box.y, initialBox.y) &&
          near(box.width, initialBox.width) &&
          near(box.height, initialBox.height),
        `${prefix}: menu trigger moved at scroll ${y}`,
      );
    }

    await menuToggle.click();
    const nav = page.locator(".site-nav");
    await nav.waitFor({ state: "visible" });
    const material = await page.evaluate((mobile) => {
      const selectors = mobile
        ? [".site-logo", ".menu-toggle", ".site-nav"]
        : [".site-header", ".site-nav"];
      return selectors.map((selector) => {
        const style = getComputedStyle(document.querySelector(selector));
        return [
          style.backgroundImage,
          style.backdropFilter,
        ];
      });
    }, testCase.viewport.width <= 960);
    expect(
      material.every((value) => JSON.stringify(value) === JSON.stringify(material[0])),
      `${prefix}: interface material diverged`,
    );
    if (testCase.viewport.width > 960) {
      const controlBackgrounds = await page.evaluate(() =>
        [".site-logo", ".menu-toggle", ".language-switch", ".header-cta"].map(
          (selector) => {
            const style = getComputedStyle(document.querySelector(selector));
            return [style.backgroundImage, style.backgroundColor];
          },
        ),
      );
      expect(
        controlBackgrounds.every(
          ([image, color]) => image === "none" && color === "rgba(0, 0, 0, 0)",
        ),
        `${prefix}: outlined header controls gained a separate fill`,
      );
    }

    await nav.getByRole("button", { name: testCase.lightLabel, exact: true }).click();
    expect(
      (await page.locator("html").getAttribute("data-theme")) === "light",
      `${prefix}: light theme did not activate`,
    );
    await nav.getByRole("button", { name: testCase.darkLabel, exact: true }).click();
    expect(
      (await page.locator("html").getAttribute("data-theme")) === "dark",
      `${prefix}: dark theme did not activate`,
    );
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

    const scenes = page.locator("[data-sound-scene]");
    await scenes.nth(1).click();
    expect(
      (await scenes.nth(1).getAttribute("aria-pressed")) === "true",
      `${prefix}: audio scene did not change`,
    );

    const proof = page.locator(".proof-sources");
    await proof.scrollIntoViewIfNeeded();
    await page.waitForTimeout(100);
    const beforeOpen = await page.evaluate(() => scrollY);
    await proof.locator("summary").click();
    await page.waitForTimeout(120);
    const afterOpen = await page.evaluate(() => scrollY);
    expect(
      Math.abs(afterOpen - beforeOpen) <= 1,
      `${prefix}: proof disclosure shifted scroll by ${afterOpen - beforeOpen}px`,
    );

    if (testCase.viewport.width <= 390) {
      expect(
        (await page.locator(".distance-card__mobile-sequence").count()) === 3,
        `${prefix}: mobile distance sequence missing`,
      );
      expect(
        await page.locator(".distance-card__sequence-step.is-active").first().isVisible(),
        `${prefix}: active mobile distance step is not visible`,
      );
    }

    await menuToggle.click();
    await page.evaluate(() => {
      const chapter = document.querySelector('.site-nav a[href="#about"]');
      chapter.addEventListener("click", (event) => event.preventDefault(), {
        once: true,
      });
      chapter.click();
    });

    await page.evaluate(() => {
      const language = document.querySelector("[data-language-switch]");
      language.addEventListener("click", (event) => event.preventDefault(), {
        once: true,
      });
      language.click();
    });

    const analytics = await page.evaluate(() =>
      window.__analyticsCalls
        .filter(([, command]) => command === "reachGoal")
        .map(([counterId, command, goal, params]) => ({
          counterId,
          command,
          goal,
          params,
        })),
    );
    for (const goal of [
      "menu_open",
      "theme_change",
      "sound_scene_select",
      "proof_open",
      "chapter_navigation",
      "project_explore",
      "language_switch",
    ]) {
      expect(
        analytics.some((event) => event.goal === goal),
        `${prefix}: analytics goal ${goal} did not fire`,
      );
    }
    expect(
      analytics.every(
        ({ counterId, command, params }) =>
          counterId === 111159425 &&
          command === "reachGoal" &&
          Object.keys(params || {}).every((key) =>
            ["chapter", "language", "location", "scene", "theme"].includes(
              key,
            ),
          ),
      ),
      `${prefix}: analytics emitted an unknown counter, command, or parameter`,
    );

    expect(errors.length === 0, `${prefix}: page errors: ${errors.join("; ")}`);
    return `${prefix}: PASS`;
  } finally {
    await context.close();
  }
}

await execFileAsync(process.execPath, ["src/build.mjs"]);
const server = await startSiteServer("preview");
const browsers = [
  ["chromium", chromium],
  ["webkit", webkit],
];
const cases = [
  {
    name: "RU 1440×900",
    path: "/?browser-regression=ru-desktop#top",
    viewport: { width: 1440, height: 900 },
    darkLabel: "Тёмная",
    lightLabel: "Светлая",
  },
  {
    name: "RU 390×844",
    path: "/?browser-regression=ru-mobile#top",
    viewport: { width: 390, height: 844 },
    darkLabel: "Тёмная",
    lightLabel: "Светлая",
  },
  {
    name: "EN 320×844",
    path: "/en/?browser-regression=en-mobile#top",
    viewport: { width: 320, height: 844 },
    darkLabel: "Dark",
    lightLabel: "Light",
  },
];

const results = [];
try {
  for (const [name, browserType] of browsers) {
    const browser = await browserType.launch({ headless: true });
    try {
      for (const testCase of cases) {
        results.push(await auditPage(browser, name, server.origin, testCase));
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  await server.close();
}

console.log(results.join("\n"));
