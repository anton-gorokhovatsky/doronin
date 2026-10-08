import { expect, near } from "../check-assertions.mjs";
import { checkDiaryReadingRoute, selectDiaryEntry } from "../editorial-checks.mjs";
import { diaryEntryCount, diaryVideoMediaCount, diaryImageMediaCount, mixedDiaryEntryIndex, mixedDiaryEntry } from "./fixtures.mjs";

export async function checkDiary({ page, prefix }) {
  const diaryLinks = page.locator("[data-diary-story-link]");
  const diaryPanels = page.locator("[data-diary-story-panel]");
  expect(
    (await diaryLinks.count()) === diaryEntryCount &&
      (await diaryPanels.count()) === diaryEntryCount &&
      (await page.locator("[data-diary-video]").count()) ===
        diaryVideoMediaCount &&
      (await page.locator("[data-diary-image]").count()) ===
        diaryImageMediaCount,
    `${prefix}: training diary does not expose all structured stories`,
  );
  await checkDiaryReadingRoute(page, diaryEntryCount);

  expect(
    mixedDiaryEntryIndex >= 0 &&
      mixedDiaryEntry.media.length === 9 &&
      mixedDiaryEntry.media.filter((media) => media.kind === "video").length ===
        3 &&
      mixedDiaryEntry.media.filter((media) => media.kind === "image").length ===
        6,
    `${prefix}: mixed diary fixture no longer describes the complete Telegram album`,
  );
  await selectDiaryEntry(page, mixedDiaryEntryIndex);
  const mixedGallery = diaryPanels
    .nth(mixedDiaryEntryIndex)
    .locator("[data-diary-gallery]");
  const readMixedGalleryState = () =>
    mixedGallery.evaluate((element) => {
      const tabs = [...element.querySelectorAll("[data-diary-media-tab]")];
      const panels = [
        ...element.querySelectorAll("[data-diary-media-panel]"),
      ];
      const rail = element.querySelector("[data-diary-media-tabs]");
      const selected = tabs.findIndex(
        (tab) => tab.getAttribute("aria-selected") === "true",
      );
      const selectedTab = tabs[selected];
      const selectedPanel = panels.find(
        (panel) =>
          panel.id === selectedTab?.getAttribute("aria-controls"),
      );
      const railBounds = rail.getBoundingClientRect();
      const selectedBounds = selectedTab?.getBoundingClientRect();
      const stageBounds = element
        .querySelector(".diary__media")
        .getBoundingClientRect();

      return {
        tabs: tabs.length,
        panels: panels.length,
        selected,
        visiblePanels: panels
          .map((panel, index) => (!panel.hidden ? index : -1))
          .filter((index) => index >= 0),
        activeKind: selectedPanel?.classList.contains(
          "diary-media__panel--video",
        )
          ? "video"
          : "image",
        imageCount: panels.filter((panel) =>
          panel.classList.contains("diary-media__panel--image"),
        ).length,
        videoCount: panels.filter((panel) =>
          panel.classList.contains("diary-media__panel--video"),
        ).length,
        position: element
          .querySelector("[data-diary-media-position-current]")
          ?.textContent.trim(),
        kind: element
          .querySelector("[data-diary-media-kind]")
          ?.textContent.trim(),
        previousDisabled: element.querySelector(
          "[data-diary-media-previous]",
        )?.disabled,
        nextDisabled: element.querySelector("[data-diary-media-next]")
          ?.disabled,
        railScrollable: rail.scrollWidth > rail.clientWidth + 1,
        scrollLeft: rail.scrollLeft,
        selectedFullyVisible: Boolean(
          selectedBounds &&
            selectedBounds.left >= railBounds.left - 1 &&
            selectedBounds.right <= railBounds.right + 1,
        ),
        scrollSnapStops: tabs.map(
          (tab) => getComputedStyle(tab).scrollSnapStop,
        ),
        touchAction: getComputedStyle(rail).touchAction,
        nativeDragDisabled: tabs.every((tab) => !tab.draggable),
        stageRatio: stageBounds.width / stageBounds.height,
      };
    });
  const initialMixedGalleryState = await readMixedGalleryState();
  expect(
    initialMixedGalleryState.tabs === 9 &&
      initialMixedGalleryState.panels === 9 &&
      initialMixedGalleryState.selected === mixedDiaryEntry.featuredMedia &&
      JSON.stringify(initialMixedGalleryState.visiblePanels) ===
        JSON.stringify([mixedDiaryEntry.featuredMedia]) &&
      initialMixedGalleryState.activeKind === "video" &&
      initialMixedGalleryState.videoCount === 3 &&
      initialMixedGalleryState.imageCount === 6 &&
      initialMixedGalleryState.position === "03" &&
      /^(?:Видео|Video)/u.test(initialMixedGalleryState.kind) &&
      !initialMixedGalleryState.previousDisabled &&
      !initialMixedGalleryState.nextDisabled &&
      initialMixedGalleryState.railScrollable &&
      initialMixedGalleryState.selectedFullyVisible &&
      initialMixedGalleryState.touchAction === "pan-x" &&
      initialMixedGalleryState.nativeDragDisabled &&
      initialMixedGalleryState.scrollSnapStops.every(
        (value) => value === "always",
      ) &&
      near(initialMixedGalleryState.stageRatio, 0.75, 0.02),
    `${prefix}: mixed diary initial state regressed (${JSON.stringify(initialMixedGalleryState)})`,
  );
  await mixedGallery.locator("[data-diary-media-next]").click();
  const controlledMixedGalleryState = await readMixedGalleryState();
  expect(
    controlledMixedGalleryState.selected ===
      mixedDiaryEntry.featuredMedia + 1 &&
      controlledMixedGalleryState.activeKind === "image" &&
      controlledMixedGalleryState.position === "04",
    `${prefix}: mixed diary buttons do not switch media (${JSON.stringify(controlledMixedGalleryState)})`,
  );
  await mixedGallery
    .locator("[data-diary-media-tab]")
    .nth(mixedDiaryEntry.featuredMedia + 1)
    .focus();
  await page.keyboard.press("ArrowLeft");
  const keyboardMixedGalleryState = await readMixedGalleryState();
  expect(
    keyboardMixedGalleryState.selected === mixedDiaryEntry.featuredMedia &&
      keyboardMixedGalleryState.activeKind === "video" &&
      keyboardMixedGalleryState.position === "03",
    `${prefix}: mixed diary keyboard navigation regressed (${JSON.stringify(keyboardMixedGalleryState)})`,
  );
  await mixedGallery.locator("[data-diary-media-tab]").last().click();
  const finalMixedGalleryState = await readMixedGalleryState();
  expect(
    finalMixedGalleryState.selected === mixedDiaryEntry.media.length - 1 &&
      finalMixedGalleryState.position === "09" &&
      finalMixedGalleryState.scrollLeft > 0 &&
      finalMixedGalleryState.selectedFullyVisible &&
      finalMixedGalleryState.nextDisabled,
    `${prefix}: mixed diary rail does not reveal its last item (${JSON.stringify(finalMixedGalleryState)})`,
  );
  await selectDiaryEntry(page, 0);

}
