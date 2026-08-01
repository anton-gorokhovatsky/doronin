import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { chromium } from "playwright";

import { startSiteServer } from "./lib/site-server.mjs";

const execFileAsync = promisify(execFile);
const outputRoot = resolve("artifacts/gate/automated");

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function selectTheme(page, locale, theme, keepMenuOpen = false) {
  if (theme === "system") return;
  const labels = locale === "en"
    ? { light: "Light", dark: "Dark" }
    : { light: "Светлая", dark: "Тёмная" };
  const toggle = page.locator(".menu-toggle");
  await toggle.click();
  await page.locator(".site-nav").getByRole("button", {
    name: labels[theme],
    exact: true,
  }).click();
  if (!keepMenuOpen) await toggle.click();
}

async function capture(browser, origin, spec) {
  const context = await browser.newContext({
    colorScheme: spec.colorScheme || "light",
    reducedMotion: spec.reducedMotion || "no-preference",
    viewport: spec.viewport,
  });
  if (spec.blockVideo !== false) {
    await context.route("**/*.mp4", (route) => route.abort());
  }
  const page = await context.newPage();
  await page.route("https://mc.yandex.ru/**", (route) => route.abort());

  try {
    await page.goto(`${origin}${spec.path}`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    await selectTheme(page, spec.locale, spec.theme || "system", spec.menuOpen);

    if (
      spec.menuOpen &&
      !(await page.locator(".nav-shell").evaluate((element) => element.hasAttribute("open")))
    ) {
      await page.locator(".menu-toggle").click();
    }
    if (spec.proofOpen) {
      const proof = page.locator(".proof-sources");
      await proof.scrollIntoViewIfNeeded();
      await proof.locator("summary").click();
    }
    if (Number.isInteger(spec.audioScene)) {
      await page.locator("[data-sound-scene]").nth(spec.audioScene).click();
    }
    if (spec.keyboardFocus) {
      for (let index = 0; index < spec.keyboardFocus; index += 1) {
        await page.keyboard.press("Tab");
      }
    }
    if (spec.menuBottom) {
      await page.locator(".site-nav__cta").press("End");
      await page.waitForTimeout(100);
    }
    if (spec.target) {
      await page.locator(spec.target).first().scrollIntoViewIfNeeded();
    }

    await page.waitForTimeout(180);
    const metrics = await page.evaluate(() => {
      const active = document.activeElement;
      const video = document.querySelector("[data-hero-video]");
      const cta = document.querySelector(".button--primary")?.getBoundingClientRect();
      return {
        activeElement: active
          ? `${active.tagName.toLowerCase()}${active.className ? `.${String(active.className).trim().replace(/\s+/g, ".")}` : ""}`
          : null,
        htmlClass: document.documentElement.className,
        menuPrimaryColumns: getComputedStyle(
          document.querySelector(".site-nav__primary"),
        ).gridTemplateColumns,
        clientWidth: document.documentElement.clientWidth,
        ctaVisible: Boolean(cta && cta.width > 0 && cta.height > 0),
        fontSize: getComputedStyle(document.documentElement).fontSize,
        heroPaused: video ? video.paused : null,
        videoToggleHidden: document.querySelector(".hero__media-toggle")?.hidden ?? null,
        lang: document.documentElement.lang,
        menuOpen: document.querySelector(".nav-shell")?.hasAttribute("open") || false,
        menuFits: (() => {
          const menu = document.querySelector(".site-nav");
          return menu ? menu.scrollHeight <= menu.clientHeight : null;
        })(),
        menuCtaVisible: (() => {
          const rect = document.querySelector(".site-nav__cta")?.getBoundingClientRect();
          return Boolean(rect && rect.top >= 0 && rect.bottom <= innerHeight);
        })(),
        menuItemOverlap: (() => {
          const boxes = [
            ...document.querySelectorAll(
              ".site-nav .site-nav__live, .site-nav .site-nav__link, .site-nav .site-nav__status, .site-nav .site-nav__setting, .site-nav .site-nav__cta",
            ),
          ].map((element) => element.getBoundingClientRect());
          return boxes.some((first, index) =>
            boxes.slice(index + 1).some(
              (second) =>
                first.left < second.right - 1 &&
                first.right > second.left + 1 &&
                first.top < second.bottom - 1 &&
                first.bottom > second.top + 1,
            ),
          );
        })(),
        menuItemOverflow: [
          ...document.querySelectorAll(
            ".site-nav .site-nav__live, .site-nav .site-nav__link, .site-nav .site-nav__status, .site-nav .site-nav__setting, .site-nav .site-nav__cta",
          ),
        ]
          .filter((element) => element.scrollWidth > element.clientWidth + 1)
          .map((element) => ({
            className: element.className,
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            text: element.textContent.trim().replace(/\s+/g, " ").slice(0, 80),
          })),
        themeOverlap: (() => {
          const boxes = [...document.querySelectorAll(".site-nav .theme-switcher button")].map(
            (button) => button.getBoundingClientRect(),
          );
          return boxes.some((first, index) =>
            boxes.slice(index + 1).some(
              (second) =>
                first.left < second.right &&
                first.right > second.left &&
                first.top < second.bottom &&
                first.bottom > second.top,
            ),
          );
        })(),
        projectPhase: document.body.dataset.projectPhase,
        phaseFixture: document.body.dataset.phaseFixture || null,
        scrollWidth: document.documentElement.scrollWidth,
        theme: document.documentElement.dataset.theme || "system",
        resolvedTheme: document.documentElement.classList.contains("theme-dark")
          ? "dark"
          : "light",
        partnerMetricsFit: (() => {
          const container = document.querySelector(".partner-proof__metrics");
          if (!container) return null;
          const bounds = container.getBoundingClientRect();
          return [...container.querySelectorAll("strong")].every((value) => {
            const box = value.getBoundingClientRect();
            return box.left >= bounds.left - 1 && box.right <= bounds.right + 1;
          });
        })(),
      };
    });
    expect(
      metrics.scrollWidth <= metrics.clientWidth,
      `${spec.name}: horizontal overflow ${metrics.scrollWidth - metrics.clientWidth}px`,
    );
    expect(metrics.ctaVisible, `${spec.name}: primary CTA is not visible`);
    if (spec.reducedMotion === "reduce") {
      expect(metrics.heroPaused === true, `${spec.name}: hero video is not paused`);
    }
    if (spec.expectVideoFallback) {
      expect(metrics.videoToggleHidden === true, `${spec.name}: failed video kept a false control`);
    }
    if (spec.textScale) {
      expect(parseFloat(metrics.fontSize) >= 31.9, `${spec.name}: 200% text scale missing`);
      expect(!metrics.menuItemOverlap, `${spec.name}: menu items overlap at 200% text`);
      expect(
        metrics.menuItemOverflow.length === 0,
        `${spec.name}: menu item clips at 200% text (${JSON.stringify({ htmlClass: metrics.htmlClass, menuPrimaryColumns: metrics.menuPrimaryColumns, items: metrics.menuItemOverflow })})`,
      );
    }
    if (spec.menuBottom) {
      expect(metrics.menuCtaVisible, `${spec.name}: menu CTA is not reachable`);
      expect(!metrics.themeOverlap, `${spec.name}: theme labels overlap`);
    }
    if (spec.expectMenuFit) {
      expect(metrics.menuOpen && metrics.menuFits, `${spec.name}: menu requires scrolling`);
    }
    if (spec.expectedPhase) {
      expect(
        metrics.projectPhase === spec.expectedPhase &&
          metrics.phaseFixture === spec.expectedPhase &&
          (await page.locator(`[data-project-phase-item="${spec.expectedPhase}"]`).getAttribute("aria-current")) === "step",
        `${spec.name}: deterministic ${spec.expectedPhase} state missing`,
      );
    }
    if (spec.theme === "dark") {
      expect(metrics.resolvedTheme === "dark", `${spec.name}: dark theme did not resolve`);
    }
    if (spec.target === ".partners__closing") {
      expect(metrics.partnerMetricsFit, `${spec.name}: partner metrics overflow`);
    }

    const file = resolve(outputRoot, `${spec.name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    const hash = createHash("sha256").update(await readFile(file)).digest("hex");
    return { ...spec, file, hash, metrics };
  } finally {
    await context.close();
  }
}

await execFileAsync(process.execPath, ["src/build.mjs"]);
await mkdir(outputRoot, { recursive: true });
const server = await startSiteServer("preview");
const browser = await chromium.launch({ headless: true });

const specs = [
  {
    name: "ru-1440-system-top",
    path: "/?gate=ru-1440-system#top",
    locale: "ru",
    theme: "system",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "ru-1440-system-menu",
    path: "/?gate=ru-1440-menu#top",
    locale: "ru",
    theme: "system",
    menuOpen: true,
    expectMenuFit: true,
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "ru-1440-dark-proof-open",
    path: "/?gate=ru-1440-dark-proof#proof",
    locale: "ru",
    theme: "dark",
    proofOpen: true,
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "ru-390-system-top",
    path: "/?gate=ru-390-system#top",
    locale: "ru",
    theme: "system",
    viewport: { width: 390, height: 844 },
  },
  {
    name: "ru-390-system-menu",
    path: "/?gate=ru-390-menu#top",
    locale: "ru",
    theme: "system",
    menuOpen: true,
    expectMenuFit: true,
    viewport: { width: 390, height: 844 },
  },
  {
    name: "ru-320-system-top",
    path: "/?gate=ru-320-system#top",
    locale: "ru",
    theme: "system",
    viewport: { width: 320, height: 844 },
  },
  {
    name: "ru-320-system-menu",
    path: "/?gate=ru-320-menu#top",
    locale: "ru",
    theme: "system",
    menuOpen: true,
    expectMenuFit: true,
    viewport: { width: 320, height: 844 },
  },
  {
    name: "ru-390-text-200-menu",
    path: "/?gate=ru-390-text-200&text=200#top",
    locale: "ru",
    theme: "system",
    menuOpen: true,
    textScale: 200,
    viewport: { width: 390, height: 844 },
  },
  {
    name: "ru-390-text-200-menu-bottom",
    path: "/?gate=ru-390-text-200-bottom&text=200#top",
    locale: "ru",
    theme: "system",
    menuOpen: true,
    menuBottom: true,
    textScale: 200,
    viewport: { width: 390, height: 844 },
  },
  {
    name: "ru-390-keyboard-focus",
    path: "/?gate=ru-390-keyboard#top",
    locale: "ru",
    theme: "system",
    keyboardFocus: 3,
    viewport: { width: 390, height: 844 },
  },
  {
    name: "ru-1440-reduced-motion",
    path: "/?gate=ru-reduced-motion#top",
    locale: "ru",
    theme: "system",
    reducedMotion: "reduce",
    blockVideo: false,
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "ru-1440-video-fallback",
    path: "/?gate=ru-video-fallback#top",
    locale: "ru",
    theme: "system",
    expectVideoFallback: true,
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "en-1440-light-top",
    path: "/en/?gate=en-1440-light#top",
    locale: "en",
    theme: "light",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "en-390-dark-top",
    path: "/en/?gate=en-390-dark#top",
    locale: "en",
    theme: "dark",
    viewport: { width: 390, height: 844 },
  },
  {
    name: "ru-390-dark-distance-stage",
    path: "/?gate=ru-390-dark-distance#distance",
    locale: "ru",
    theme: "dark",
    target: ".distance-card",
    viewport: { width: 390, height: 844 },
  },
  {
    name: "ru-1440-light-partner-closing",
    path: "/?gate=ru-1440-light-partner-closing#partners",
    locale: "ru",
    theme: "light",
    target: ".partners__closing",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "ru-390-dark-audio-scene-02",
    path: "/?gate=ru-390-dark-audio#top",
    locale: "ru",
    theme: "dark",
    audioScene: 1,
    target: ".audio-story",
    viewport: { width: 390, height: 844 },
  },
  {
    name: "ru-390-dark-proof-open",
    path: "/?gate=ru-390-dark-proof#proof",
    locale: "ru",
    theme: "dark",
    proofOpen: true,
    target: ".proof-source",
    viewport: { width: 390, height: 844 },
  },
  {
    name: "ru-390-dark-partner-closing",
    path: "/?gate=ru-390-dark-partners#partners",
    locale: "ru",
    theme: "dark",
    target: ".partners__closing",
    viewport: { width: 390, height: 844 },
  },
  {
    name: "ru-1440-light-partner-formats",
    path: "/?gate=ru-1440-light-partners#partners",
    locale: "ru",
    theme: "light",
    target: ".partner-formats__list",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "ru-390-light-top",
    path: "/?gate=ru-390-light#top",
    locale: "ru",
    theme: "light",
    viewport: { width: 390, height: 844 },
  },
  {
    name: "en-1440-system-top",
    path: "/en/?gate=en-1440-system#top",
    locale: "en",
    theme: "system",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "ru-1440-phase-before",
    path: "/?phase=before#top",
    locale: "ru",
    theme: "system",
    expectedPhase: "before",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "ru-1440-phase-active",
    path: "/?phase=active#top",
    locale: "ru",
    theme: "system",
    expectedPhase: "active",
    viewport: { width: 1440, height: 900 },
  },
  {
    name: "ru-1440-phase-finished",
    path: "/?phase=finished#top",
    locale: "ru",
    theme: "system",
    expectedPhase: "finished",
    viewport: { width: 1440, height: 900 },
  },
];

const screenshotFilter = process.env.SCREENSHOT_FILTER;
const selectedSpecs = screenshotFilter
  ? specs.filter((spec) => spec.name.includes(screenshotFilter))
  : specs;

const manifest = [];
try {
  for (const spec of selectedSpecs) manifest.push(await capture(browser, server.origin, spec));
} finally {
  await browser.close();
  await server.close();
}

await writeFile(
  resolve(outputRoot, "manifest.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), captures: manifest }, null, 2)}\n`,
  "utf8",
);

console.log(`Screenshot gate: ${manifest.length}/${specs.length} PASS`);
for (const item of manifest) {
  console.log(`${item.name} ${item.hash.slice(0, 12)} overflow=0`);
}
