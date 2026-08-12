import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { chromium, webkit } from "playwright";

import {
  axePage,
  expect,
  openPage,
  scanFullPage,
  settle,
} from "./lib/accessibility-helpers.mjs";
import { startSiteServer } from "./lib/site-server.mjs";

const execFileAsync = promisify(execFile);
const browsers = [
  ["chromium", chromium],
  ["webkit", webkit],
];

async function runAxeSmoke(browser, origin) {
  const specs = [
    ["RU desktop light", "/?a11y=axe-ru-desktop-light&theme=light#top", { width: 1440, height: 900 }, false],
    ["RU desktop dark menu", "/?a11y=axe-ru-desktop-dark-menu&theme=dark#top", { width: 1440, height: 900 }, true],
    ["RU mobile light", "/?a11y=axe-ru-mobile-light&theme=light#top", { width: 390, height: 844 }, false],
    ["RU mobile dark menu", "/?a11y=axe-ru-mobile-dark-menu&theme=dark#top", { width: 390, height: 844 }, true],
    ["EN desktop light", "/en/?a11y=axe-en-desktop-light&theme=light#top", { width: 1440, height: 900 }, false],
    ["EN desktop dark menu", "/en/?a11y=axe-en-desktop-dark-menu&theme=dark#top", { width: 1440, height: 900 }, true],
    ["EN mobile light", "/en/?a11y=axe-en-mobile-light&theme=light#top", { width: 390, height: 844 }, false],
    ["EN mobile dark menu", "/en/?a11y=axe-en-mobile-dark-menu&theme=dark#top", { width: 390, height: 844 }, true],
  ];
  const results = [];

  for (const [name, path, viewport, menuOpen] of specs) {
    const { context, page } = await openPage(browser, origin, {
      menuOpen,
      path,
      viewport,
    });
    try {
      await axePage(page, name);
      results.push(`${name}: axe=0`);
    } finally {
      await context.close();
    }
  }

  return results;
}

async function runReflowMatrix(browser, browserName, origin) {
  const specs = [
    ["RU 320 reflow", "/?a11y=ru-320-reflow#top", { width: 320, height: 844 }],
    ["EN 320 reflow", "/en/?a11y=en-320-reflow#top", { width: 320, height: 844 }],
    ["RU 200% text", "/?a11y=ru-text-200&text=200#top", { width: 1280, height: 720 }],
    ["EN 200% text", "/en/?a11y=en-text-200&text=200#top", { width: 1280, height: 720 }],
  ];
  const results = [];

  for (const [name, path, viewport] of specs) {
    const { context, page } = await openPage(browser, origin, { path, viewport });
    try {
      await scanFullPage(page, `${browserName} ${name}`);
      results.push(`${browserName} ${name}: overflow=0 clipped=0`);
    } finally {
      await context.close();
    }
  }

  return results;
}

async function runTextSpacing(browser, browserName, origin) {
  const specs = [
    ["RU text spacing", "/?a11y=ru-text-spacing#top"],
    ["EN text spacing", "/en/?a11y=en-text-spacing#top"],
  ];
  const results = [];

  for (const [name, path] of specs) {
    const { context, page } = await openPage(browser, origin, {
      path,
      viewport: { width: 1280, height: 720 },
    });
    try {
      await page.addStyleTag({
        content: `
          :where(p, li, a, button, summary, small, strong, span) {
            line-height: 1.5 !important;
            letter-spacing: 0.12em !important;
            word-spacing: 0.16em !important;
          }
          p { margin-block-end: 2em !important; }
        `,
      });
      await settle(page);
      await scanFullPage(page, `${browserName} ${name}`);
      results.push(`${browserName} ${name}: overflow=0 clipped=0`);
    } finally {
      await context.close();
    }
  }

  return results;
}

async function runForcedColors(browser, origin) {
  const { context, page } = await openPage(browser, origin, {
    blockVideo: false,
    forcedColors: "active",
    path: "/?a11y=forced-colors#top",
    reducedMotion: "no-preference",
    viewport: { width: 1280, height: 720 },
  });
  try {
    expect(
      await page.evaluate(() => matchMedia("(forced-colors: active)").matches),
      "Forced colors emulation did not activate",
    );
    for (const selector of [
      ".skip-link",
      ".menu-toggle",
      ".header-cta",
      ".hero__media-toggle",
      ".button--primary",
    ]) {
      const control = page.locator(selector).first();
      await control.focus();
      const state = await control.evaluate((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          height: rect.height,
          outlineStyle: style.outlineStyle,
          outlineWidth: style.outlineWidth,
          visibility: style.visibility,
          width: rect.width,
        };
      });
      expect(
        state.visibility !== "hidden" && state.width > 0 && state.height > 0,
        `Forced colors: ${selector} is not visible (${JSON.stringify(state)})`,
      );
      expect(
        state.outlineStyle !== "none" && Number.parseFloat(state.outlineWidth) > 0,
        `Forced colors: ${selector} has no visible focus outline (${JSON.stringify(state)})`,
      );
    }
    // Axe reads authored colours rather than the system palette substituted by
    // forced-colors. Visibility and focus are asserted above; contrast remains
    // covered by the regular light/dark Axe matrix.
    await axePage(page, "Forced colors", { disableRules: ["color-contrast"] });
    return ["chromium forced colors: controls=visible focus=visible axe=0"];
  } finally {
    await context.close();
  }
}

async function runKeyboardRoute(browser, browserName, origin, viewport) {
  const { context, page } = await openPage(browser, origin, {
    blockVideo: false,
    path: `/?a11y=keyboard-${browserName}-${viewport.width}`,
    reducedMotion: "no-preference",
    viewport,
  });
  try {
    // WebKit follows Safari's default keyboard model: Option+Tab includes
    // links, while unmodified Tab moves only through form controls.
    const tabKey = browserName === "webkit" ? "Alt+Tab" : "Tab";
    await page.keyboard.press(tabKey);
    expect(
      await page.locator(".skip-link").evaluate(
        (element) => element === document.activeElement,
      ),
      `${browserName} ${viewport.width}: skip link is not first in the keyboard route`,
    );

    const menuToggle = page.locator(".menu-toggle");
    for (let index = 0; index < 8; index += 1) {
      if (await menuToggle.evaluate((element) => element === document.activeElement)) break;
      await page.keyboard.press(tabKey);
    }
    expect(
      await menuToggle.evaluate((element) => element === document.activeElement),
      `${browserName} ${viewport.width}: keyboard route did not reach the menu control`,
    );
    await page.keyboard.press("Enter");
    expect(
      await page.locator(".nav-shell").evaluate(
        (element) => element.hasAttribute("open"),
      ),
      `${browserName} ${viewport.width}: Enter did not open the menu`,
    );

    const expectedMenuControls = await page
      .locator(".nav-shell summary, .nav-shell a[href], .nav-shell button:not([disabled])")
      .count();
    const visited = new Set();
    for (let index = 0; index < expectedMenuControls + 2; index += 1) {
      const state = await page.evaluate(() => {
        const active = document.activeElement;
        const shell = document.querySelector(".nav-shell");
        return {
          inside: Boolean(active && shell?.contains(active)),
          key:
            active?.getAttribute("href") ||
            active?.getAttribute("data-theme-option") ||
            active?.className ||
            active?.tagName ||
            "unknown",
        };
      });
      expect(
        state.inside,
        `${browserName} ${viewport.width}: focus escaped the open menu to ${state.key}`,
      );
      visited.add(String(state.key));
      await page.keyboard.press(tabKey);
    }
    expect(
      visited.size >= expectedMenuControls - 1,
      `${browserName} ${viewport.width}: keyboard route skipped menu controls (${visited.size}/${expectedMenuControls})`,
    );

    await page.keyboard.press("Escape");
    expect(
      !(await page.locator(".nav-shell").evaluate(
        (element) => element.hasAttribute("open"),
      )) &&
        (await menuToggle.evaluate((element) => element === document.activeElement)),
      `${browserName} ${viewport.width}: Escape did not close the menu and restore focus`,
    );

    const required = {
      contact: false,
      diary: false,
      primary: false,
    };
    const heroVideoRequired = await page.locator("[data-video-toggle]").evaluate(
      (element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return (
          !element.hidden &&
          !element.inert &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0
        );
      },
    );
    if (heroVideoRequired) required.heroVideo = false;
    for (let index = 0; index < 180; index += 1) {
      await page.keyboard.press(tabKey);
      const state = await page.evaluate(() => {
        const active = document.activeElement;
        if (!active) return { hidden: true, matches: [], wrapped: false };
        const rect = active.getBoundingClientRect();
        const style = getComputedStyle(active);
        return {
          hidden:
            style.display === "none" ||
            style.visibility === "hidden" ||
            rect.width <= 0 ||
            rect.height <= 0,
          matches: [
            active.matches(".partners__channels a, .site-footer__contacts a")
              ? "contact"
              : null,
            active.matches("[data-diary-video-play]") ? "diary" : null,
            active.matches("[data-video-toggle]") ? "heroVideo" : null,
            active.matches(".button--primary") ? "primary" : null,
          ].filter(Boolean),
          wrapped: active.matches(".skip-link"),
        };
      });
      expect(
        !state.hidden,
        `${browserName} ${viewport.width}: keyboard focused a hidden control`,
      );
      for (const match of state.matches) required[match] = true;
      if (state.wrapped) break;
    }
    expect(
      Object.values(required).every(Boolean),
      `${browserName} ${viewport.width}: incomplete page keyboard route (${JSON.stringify(required)})`,
    );
    return `${browserName} ${viewport.width}: menu trap=pass escape=pass page route=pass`;
  } finally {
    await context.close();
  }
}

await execFileAsync(process.execPath, ["src/build.mjs"]);
const server = await startSiteServer("preview");
const results = [];

try {
  const chromiumBrowser = await chromium.launch({ headless: true });
  try {
    results.push(...(await runAxeSmoke(chromiumBrowser, server.origin)));
    results.push(...(await runForcedColors(chromiumBrowser, server.origin)));
  } finally {
    await chromiumBrowser.close();
  }

  for (const [browserName, browserType] of browsers) {
    const browser = await browserType.launch({ headless: true });
    try {
      results.push(...(await runReflowMatrix(browser, browserName, server.origin)));
      results.push(...(await runTextSpacing(browser, browserName, server.origin)));
      results.push(
        await runKeyboardRoute(browser, browserName, server.origin, {
          width: 1440,
          height: 900,
        }),
      );
      results.push(
        await runKeyboardRoute(browser, browserName, server.origin, {
          width: 390,
          height: 844,
        }),
      );
    } finally {
      await browser.close();
    }
  }
} finally {
  await server.close();
}

console.log(`Accessibility gate: ${results.length}/${results.length} PASS`);
for (const result of results) console.log(result);
