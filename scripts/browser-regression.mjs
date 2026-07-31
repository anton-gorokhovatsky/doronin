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
    if (testCase.viewport.width > 960) {
      expect(
        (await menuToggle.locator(".menu-toggle__label").innerText()).trim() ===
          testCase.menuLabel,
        `${prefix}: menu trigger does not use the stable Menu label`,
      );
      const triggerAlignment = await menuToggle.evaluate((element) => {
        const label = element.querySelector(".menu-toggle__label").getBoundingClientRect();
        const icon = element.querySelector(".menu-toggle__icon").getBoundingClientRect();
        return Math.abs(label.top + label.height / 2 - (icon.top + icon.height / 2));
      });
      expect(
        triggerAlignment <= 1,
        `${prefix}: menu label/icon centres diverge by ${triggerAlignment}px`,
      );
    } else {
      expect(
        (await menuToggle.getAttribute("aria-label"))?.toUpperCase() ===
          testCase.menuLabel,
        `${prefix}: icon-only menu trigger lost its accessible Menu label`,
      );
    }

    if (testCase.viewport.width <= 390) {
      const firstScreen = await page.evaluate(() => {
        const heroContent = document.querySelector(".hero__content").getBoundingClientRect();
        const status = document.querySelector(".event-status").getBoundingClientRect();
        const secondary = getComputedStyle(document.querySelector(".button--ghost"));
        return {
          heroHeight: heroContent.height,
          innerHeight,
          statusTop: status.top,
          heroBottom: heroContent.bottom,
          secondaryDisplay: secondary.display,
        };
      });
      expect(
        near(firstScreen.heroHeight, firstScreen.innerHeight, 1) &&
          firstScreen.statusTop >= firstScreen.heroBottom - 1 &&
          firstScreen.secondaryDisplay === "none",
        `${prefix}: mobile first screen/status boundary is invalid (${JSON.stringify(firstScreen)})`,
      );
    }

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
      const surfaces = mobile
        ? [
            [document.querySelector(".site-header"), null],
            [document.querySelector(".site-nav"), null],
          ]
        : [
            [document.querySelector(".site-header"), "::before"],
            [document.querySelector(".site-nav"), null],
          ];
      return surfaces.map(([element, pseudo]) => {
        const style = getComputedStyle(element, pseudo);
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
    const controlBackgrounds = await page.evaluate((mobile) =>
      (mobile
        ? [".site-logo", ".menu-toggle"]
        : [".site-logo", ".menu-toggle", ".language-switch", ".header-cta"]
      ).map((selector) => {
        const style = getComputedStyle(document.querySelector(selector));
        return [style.backgroundImage, style.backgroundColor];
      }),
      testCase.viewport.width <= 960,
    );
    expect(
      controlBackgrounds.every(
        ([image, color]) => image === "none" && color === "rgba(0, 0, 0, 0)",
      ),
      `${prefix}: header controls gained a separate fill`,
    );
    if (testCase.viewport.width > 960) {
      const desktopCluster = await page.evaluate(() => {
        const toggle = document.querySelector(".menu-toggle").getBoundingClientRect();
        const actions = document.querySelector(".header-actions").getBoundingClientRect();
        return {
          gap: actions.left - toggle.right,
          verticalDelta: Math.abs(
            toggle.top + toggle.height / 2 - (actions.top + actions.height / 2),
          ),
        };
      });
      expect(
        desktopCluster.gap >= 0 &&
          desktopCluster.gap <= 32 &&
          desktopCluster.verticalDelta <= 1,
        `${prefix}: desktop menu is detached from the service cluster`,
      );
    } else {
      const mobileMenu = await nav.evaluate((element) => ({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        top: element.getBoundingClientRect().top,
        headerBottom: document.querySelector(".site-header").getBoundingClientRect().bottom,
      }));
      expect(
        mobileMenu.scrollHeight <= mobileMenu.clientHeight &&
          near(mobileMenu.top, mobileMenu.headerBottom, 2),
        `${prefix}: regular mobile menu scrolls or is detached from the header`,
      );
    }

    const actionSystem = await page.evaluate(() => {
      const selectors = [".button--primary", ".site-nav__cta", ".site-footer__cta"];
      const core = selectors.map((selector) => {
        const style = getComputedStyle(document.querySelector(selector));
        return [
          style.backgroundColor,
          style.color,
          style.minHeight,
          style.fontWeight,
          style.textTransform,
        ];
      });
      return {
        core,
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
          document.querySelector(".button--primary"),
        ).backgroundColor,
      };
    });
    expect(
      actionSystem.core.every(
        (value) => JSON.stringify(value) === JSON.stringify(actionSystem.core[0]),
      ) &&
        actionSystem.menuLabel === testCase.conversionLabel &&
        actionSystem.footerLabel === testCase.conversionLabel &&
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
    if (testCase.viewport.width <= 390) {
      const audioRail = await page.locator(".audio-story__storyline").evaluate(
        (element) => ({
          scrollLeft: element.scrollLeft,
          scrollSnapType: getComputedStyle(element).scrollSnapType,
        }),
      );
      expect(
        audioRail.scrollLeft > 0 && audioRail.scrollSnapType.includes("x"),
        `${prefix}: mobile audio rail does not reveal/snap the selected track (${JSON.stringify(audioRail)})`,
      );
    }

    const proof = page.locator(".proof-sources");
    await page.evaluate(() => {
      const previous = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = "auto";
      document.querySelector(".proof-sources").scrollIntoView({ block: "center" });
      document.documentElement.style.scrollBehavior = previous;
    });
    const beforeOpen = await page.evaluate(() => scrollY);
    await proof.locator("summary").click();
    await page.waitForTimeout(120);
    const afterOpen = await page.evaluate(() => scrollY);
    expect(
      Math.abs(afterOpen - beforeOpen) <= 1,
      `${prefix}: proof disclosure shifted scroll by ${afterOpen - beforeOpen}px`,
    );

    if (testCase.viewport.width <= 390) {
      const sourceAction = await page.locator(".proof-source__links a").first().evaluate(
        (element) => {
          const style = getComputedStyle(element);
          return {
            gap: parseFloat(style.gap),
            justifyContent: style.justifyContent,
          };
        },
      );
      expect(
        sourceAction.justifyContent === "flex-start" && sourceAction.gap <= 8,
        `${prefix}: source label and arrow violate proximity (${JSON.stringify(sourceAction)})`,
      );
    }

    const partnerMetricsFit = await page.locator(".partner-proof__metrics").evaluate(
      (element) => {
        const container = element.getBoundingClientRect();
        return [...element.querySelectorAll("strong")].every((value) => {
          const box = value.getBoundingClientRect();
          return box.left >= container.left - 1 && box.right <= container.right + 1;
        });
      },
    );
    expect(partnerMetricsFit, `${prefix}: partner metric overflows its grid`);

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
    menuLabel: "МЕНЮ",
    conversionLabel: "Обсудить участие",
  },
  {
    name: "RU 390×844",
    path: "/?browser-regression=ru-mobile#top",
    viewport: { width: 390, height: 844 },
    darkLabel: "Тёмная",
    lightLabel: "Светлая",
    menuLabel: "МЕНЮ",
    conversionLabel: "Обсудить участие",
  },
  {
    name: "EN 320×844",
    path: "/en/?browser-regression=en-mobile#top",
    viewport: { width: 320, height: 844 },
    darkLabel: "Dark",
    lightLabel: "Light",
    menuLabel: "MENU",
    conversionLabel: "Discuss a partnership",
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
