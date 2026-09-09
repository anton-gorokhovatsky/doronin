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
    assert.equal(await page.locator("[data-diary-countdown]").count(), 0);
    assert(await page.locator("#diary-title").isVisible());
    assert.equal(await page.locator("[data-diary-story-panel]:visible").count(),
      await page.locator("[data-diary-story-link]").count());
    assert(await page.locator("[data-diary-story-link]").first().isVisible());
    const last = page.locator("[data-diary-story-link]").last();
    const target = await last.getAttribute("href");
    await last.click();
    assert.equal(new URL(page.url()).hash, target);
    assert(await page.locator(target).isVisible());
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

export async function checkUpperPageRoutes(page) {
  const previousScrollBehavior = await page.evaluate(() => {
    const previous = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "auto";
    return previous;
  });
  try {
    await page.locator(".hero .button--primary").click();
    assert.equal(new URL(page.url()).hash, "#partner-formats");
    const formatsVisible = await page.locator(".partner-formats").evaluate((element) => {
      const label = element.querySelector(".partner-formats__label").getBoundingClientRect();
      const first = element.querySelector(".partner-format").getBoundingClientRect();
      return label.top >= 0 && label.bottom < innerHeight && first.top < innerHeight;
    });
    assert(formatsVisible, "The partnership action must reveal the promised formats");

    const interviewUrl = "https://youtu.be/4H2fddBQ6VQ";
    const interviewRoute = (route) => route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>Interview destination</title>",
    });
    await page.context().route(interviewUrl, interviewRoute);
    try {
      await page.locator(".hero__evidence-link").focus();
      const [interview] = await Promise.all([
        page.waitForEvent("popup"),
        page.locator(".hero__evidence-link").press("Enter"),
      ]);
      await interview.waitForLoadState("domcontentloaded");
      assert.equal(interview.url(), interviewUrl);
      await interview.close();
      assert.equal(new URL(page.url()).hash, "#partner-formats");
    } finally {
      await page.context().unroute(interviewUrl, interviewRoute);
    }

    await selectDiaryEntry(page, -1);
    const heroDiaryAction = page.locator(".hero .button--ghost");
    if (await heroDiaryAction.isVisible()) {
      await heroDiaryAction.click();
    } else {
      await page.locator(".menu-toggle").click();
      await page.locator('.site-nav a[href="#diary"]').click();
    }
    assert.equal(new URL(page.url()).hash, "#diary");
    assert(await page.locator("[data-diary-story-panel]").first().isVisible(),
      "Following the diary must show the latest entry");
  } finally {
    await page.evaluate((previous) => {
      document.documentElement.style.scrollBehavior = previous;
    }, previousScrollBehavior);
  }
}

export async function selectDiaryEntry(page, index) {
  const links = page.locator("[data-diary-story-link]");
  const resolvedIndex = index < 0 ? await links.count() + index : index;
  const link = links.nth(resolvedIndex);
  if (await link.getAttribute("hidden") !== null) return;
  await link.click();
}

export async function checkDiaryReadingRoute(page, total) {
  const chapterIndices = await page.evaluate(() => {
    const navigation = [...document.querySelectorAll('.site-nav__primary a')];
    const chapters = [...document.querySelectorAll('[data-chapter-label]')];
    return chapters.length === navigation.length && chapters.every((chapter, index) =>
      chapter.dataset.chapterLabel === navigation[index].hash &&
      chapter.querySelector('span').textContent === navigation[index].dataset.navIndex);
  });
  assert(chapterIndices, "Chapter labels and menu entries must share their order and indices");
  const panels = page.locator("[data-diary-story-panel]");
  const archive = page.locator(".diary-archive");
  await panels.first().scrollIntoViewIfNeeded();
  const layout = await page.locator("#diary").evaluate((diary) => {
    const heading = diary.querySelector(".diary-live").getBoundingClientRect();
    const story = diary.querySelector("[data-diary-story-panel]:not([hidden])");
    const box = story.getBoundingClientRect();
    const archive = diary.querySelector(".diary-archive").getBoundingClientRect();
    const title = story.querySelector("h3");
    const range = document.createRange(); range.selectNodeContents(title);
    const titleBox = title.getBoundingClientRect();
    return {
      directEntry: box.top >= heading.bottom && box.top - heading.bottom <= 64,
      archiveAfterStory: archive.top >= box.bottom,
      titleFits: [...range.getClientRects()].every(r => r.left >= titleBox.left - 1 && r.right <= titleBox.right + 1),
      date: story.querySelector("time").getAttribute("datetime"),
    };
  });
  assert(layout.directEntry && layout.archiveAfterStory && layout.titleFits,
    `The diary must lead directly into one dated story: ${JSON.stringify(layout)}`);
  assert.equal(await page.locator("[data-diary-story-panel]:visible").count(), 1);
  const visibleLinks = page.locator("[data-diary-story-link]:not([hidden])");
  assert.equal(await visibleLinks.count(), total - 1);
  assert.equal(await archive.locator("summary").count(), 0);
  const rail = archive.locator("[data-diary-archive-rail]");
  const archiveLayout = await visibleLinks.evaluateAll(links => links.map(link => {
    const box = link.getBoundingClientRect();
    const title = link.querySelector(".diary-archive__name");
    const range = document.createRange(); range.selectNodeContents(title);
    return {
      x: box.x, y: box.y, width: box.width, height: box.height,
      titleFits: [...range.getClientRects()].every(r => r.left >= box.left - 1 && r.right <= box.right + 1),
    };
  }));
  assert(archiveLayout.every((card, index) => card.height >= 44 && card.titleFits &&
    Math.abs(card.y - archiveLayout[0].y) <= 1 &&
    (index === 0 || card.x > archiveLayout[index - 1].x + archiveLayout[index - 1].width)),
  "Diary cards must form one readable horizontal row");
  const selectedBefore = await page.locator("[data-diary-story-panel]:visible").getAttribute("id");
  await archive.locator("[data-diary-archive-earlier]").click();
  await page.waitForFunction(() => document.querySelector("[data-diary-archive-rail]").scrollLeft > 2);
  assert.equal(await page.locator("[data-diary-story-panel]:visible").getAttribute("id"), selectedBefore,
    "Browsing the archive must not silently select another entry");
  await selectDiaryEntry(page, total - 1);
  const olderId = await panels.last().getAttribute("id");
  assert.equal(new URL(page.url()).hash, `#${olderId}`);
  assert(await panels.last().isVisible());
  assert.equal(await page.evaluate(() => document.activeElement?.id), olderId);

  await visibleLinks.first().focus();
  const tabKey = page.context().browser().browserType().name() === "webkit" ? "Alt+Tab" : "Tab";
  for (let index = 0; index < await visibleLinks.count(); index += 1) {
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("href")),
      await visibleLinks.nth(index).getAttribute("href"));
    if (index + 1 < await visibleLinks.count()) await page.keyboard.press(tabKey);
  }
  await visibleLinks.first().focus();
  await page.keyboard.press("Enter");
  assert(await panels.first().isVisible());
  assert.equal(await page.locator("[data-diary-story-link]:visible").count(), total - 1);
  await page.goBack();
  await page.waitForFunction(id => !document.getElementById(id).hidden, olderId);
  await page.goForward();
  const firstId = await panels.first().getAttribute("id");
  await page.waitForFunction(id => !document.getElementById(id).hidden, firstId);
}
