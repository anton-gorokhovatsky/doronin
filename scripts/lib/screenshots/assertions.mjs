import { expect } from "../check-assertions.mjs";

export async function assertScreenshotMetrics(page, metrics, spec) {
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
  if (spec.forcedColors === "active") {
    expect(metrics.forcedColors, `${spec.name}: forced colors did not activate`);
  }
  if (spec.textScale) {
    expect(parseFloat(metrics.fontSize) >= 31.9, `${spec.name}: 200% text scale missing`);
  }
  if (spec.textScale && metrics.menuOpen) {
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
  if (spec.expectMenuScroll) {
    expect(
      metrics.menuOpen && metrics.menuFits === false,
      `${spec.name}: mobile menu no longer exposes its intended scroll route`,
    );
  }
  if (spec.expectedPhase) {
    expect(
      metrics.projectPhase === spec.expectedPhase &&
        metrics.phaseFixture === spec.expectedPhase &&
        (await page.locator(`[data-project-phase-item="${spec.expectedPhase}"]`).getAttribute("aria-current")) === "step",
      `${spec.name}: deterministic ${spec.expectedPhase} state missing`,
    );
  }
  if (spec.expectedCalendarPhase) {
    expect(
      metrics.calendarPhase === spec.expectedCalendarPhase,
      `${spec.name}: deterministic calendar phase ${spec.expectedCalendarPhase} missing`,
    );
  }
  if (typeof spec.expectedCalendarOpen === "boolean") {
    expect(
      metrics.calendarOpen === spec.expectedCalendarOpen,
      `${spec.name}: calendar disclosure state is not ${spec.expectedCalendarOpen ? "open" : "closed"}`,
    );
  }
  if (spec.expectCalendarCurrent) {
    expect(
      metrics.calendarCurrentCount === 1 && metrics.calendarCurrentVisible,
      `${spec.name}: current planned stage is not visible and linked to one card`,
    );
  }
  if (spec.theme === "dark") {
    expect(metrics.resolvedTheme === "dark", `${spec.name}: dark theme did not resolve`);
  }
  if (spec.target === ".partners__closing") {
    expect(metrics.partnerReferenceFit, `${spec.name}: partner proof reference overflow`);
  }
  if (spec.target === ".diary-live") {
    expect(metrics.diaryIntroOverflow.length === 0,
      `${spec.name}: diary introduction clips (${metrics.diaryIntroOverflow.join("; ")})`);
  }
  if (spec.expectDiaryStories) {
    expect(
      metrics.diaryStories.contained &&
        metrics.diaryStories.selected === 1 &&
        metrics.diaryStories.visiblePanels === 1,
      `${spec.name}: diary archive clips or exposes the wrong story (${JSON.stringify(metrics.diaryStories)})`,
    );
  }
  if (spec.expectDiaryMedia) {
    expect(
      metrics.diaryMedia &&
        metrics.diaryMedia.tabs === 9 &&
        metrics.diaryMedia.panels === 9 &&
        metrics.diaryMedia.selected === spec.diaryMedia &&
        JSON.stringify(metrics.diaryMedia.visiblePanels) ===
          JSON.stringify([spec.diaryMedia]) &&
        metrics.diaryMedia.activeKind === "video" &&
        metrics.diaryMedia.position === "03" &&
        Math.abs(metrics.diaryMedia.stageRatio - 0.75) <= 0.02,
      `${spec.name}: mixed diary gallery exposes the wrong visual state (${JSON.stringify(metrics.diaryMedia)})`,
    );
  }

}
