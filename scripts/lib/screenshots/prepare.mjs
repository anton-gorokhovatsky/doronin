import { selectDiaryEntry } from "../editorial-checks.mjs";

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


export async function prepareScreenshot(page, origin, spec) {
  await page.goto(`${origin}${spec.path}`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => document.fonts.ready);
  await selectTheme(page, spec.locale, spec.theme || "system", spec.menuOpen);

  if (
    spec.menuOpen &&
    !(await page.locator(".nav-shell").evaluate((element) => element.hasAttribute("open")))
  ) {
    await page.locator(".menu-toggle").click();
  }
  if (spec.menuOpen) {
    // The blocked forecast settles asynchronously after the native details toggle.
    // Measure the final menu contents before navigating to its bottom.
    await page.locator('[data-menu-weather][data-weather="unavailable"]').waitFor({ state: "visible" });
  }
  if (spec.proofOpen) {
    const proof = page.locator(".proof-sources");
    await proof.scrollIntoViewIfNeeded();
    await proof.locator("summary").click();
  }
  if (spec.diaryStoryDate) {
    const index = await page.locator("[data-diary-story-link]").evaluateAll((links, date) =>
      links.findIndex(link => link.hash === `#diary-entry-${date}`), spec.diaryStoryDate);
    await selectDiaryEntry(page, index);
  } else if (Number.isInteger(spec.diaryStory)) {
    await selectDiaryEntry(page, spec.diaryStory);
  }
  if (Number.isInteger(spec.diaryMedia)) {
    await page
      .locator(".diary-story:not([hidden]) [data-diary-media-tab]")
      .nth(spec.diaryMedia)
      .click();
  }
  if (Number.isFinite(spec.videoFrame)) {
    await page.locator("[data-hero-video]").evaluate(
      async (video, frame) => {
        if (video.readyState < 1) {
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(
              () => reject(new Error("Hero video metadata timeout")),
              5000,
            );
            video.addEventListener(
              "loadedmetadata",
              () => {
                clearTimeout(timeout);
                resolve();
              },
              { once: true },
            );
            video.addEventListener(
              "error",
              () => {
                clearTimeout(timeout);
                reject(new Error("Hero video failed before frame capture"));
              },
              { once: true },
            );
          });
        }
        video.pause();
        video.currentTime = Math.max(
          0,
          Math.min(video.duration - 0.05, video.duration * frame),
        );
        await new Promise((resolve) =>
          video.addEventListener("seeked", resolve, { once: true }),
        );
      },
      spec.videoFrame,
    );
  }
  if (spec.keyboardFocus) {
    for (let index = 0; index < spec.keyboardFocus; index += 1) {
      await page.keyboard.press("Tab");
    }
  }
  if (spec.menuBottom) {
    await page.locator(".site-nav").evaluate((menu) => {
      menu.scrollTop = menu.scrollHeight;
    });
    await page.waitForTimeout(100);
  }
  if (spec.target) {
    const target = page.locator(spec.target).first();
    const targetInsideCalendarDetails = await target.evaluate(
      (element) =>
        !element.matches("[data-calendar-details]") &&
        Boolean(element.closest("[data-calendar-details]")),
    );
    if (targetInsideCalendarDetails) {
      await page.locator("[data-calendar-details]").evaluate((element) => {
        element.open = true;
      });
    }
    await target.scrollIntoViewIfNeeded();
  }

}
