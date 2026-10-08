import { expect } from "../check-assertions.mjs";

export async function checkHero({ page, testCase, prefix }) {
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
  expect(await page.locator(".hero .button--primary").isVisible(), `${prefix}: primary CTA hidden`);

  const iconAudit = await page.evaluate(() => {
    const selector = [
      "svg.icon",
      "svg.media-toggle-icon",
      "svg.media-play-icon",
    ].join(",");
    const visibleIcons = [...document.querySelectorAll(selector)]
      .map((icon) => {
        const bounds = icon.getBoundingClientRect();
        return {
          className: icon.getAttribute("class"),
          height: bounds.height,
          width: bounds.width,
        };
      })
      .filter((icon) => icon.width > 0 && icon.height > 0);

    return {
      disclosureCount: document.querySelectorAll(".icon--disclosure").length,
      mediaToggleCount: document.querySelectorAll(".media-toggle-icon").length,
      malformed: visibleIcons.filter(
        (icon) => Math.abs(icon.width - icon.height) > 0.5,
      ),
      semanticLeaks: [...document.querySelectorAll(selector)]
        .filter(
          (icon) =>
            icon.getAttribute("aria-hidden") !== "true" ||
            icon.getAttribute("focusable") !== "false",
        )
        .map((icon) => icon.getAttribute("class")),
    };
  });
  expect(
    iconAudit.malformed.length === 0,
    `${prefix}: icon aspect ratios diverged (${JSON.stringify(iconAudit.malformed)})`,
  );
  expect(
    iconAudit.disclosureCount === 6 && iconAudit.mediaToggleCount === 3,
    `${prefix}: shared icon roles regressed (${JSON.stringify(iconAudit)})`,
  );
  expect(
    iconAudit.semanticLeaks.length === 0,
    `${prefix}: decorative icons leaked into the accessibility tree (${JSON.stringify(iconAudit.semanticLeaks)})`,
  );

  const heroPeaks = await page.locator(".hero-peaks").evaluate((element) => {
    const labels = [...element.querySelectorAll("li")].map((label) => {
      const bounds = label.getBoundingClientRect();
      return {
        date: label.dataset.date,
        text: label.textContent.trim(),
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
      };
    });
    const bounds = element.getBoundingClientRect();
    const heroBounds = element.closest(".hero").getBoundingClientRect();
    const mainBounds = element.closest(".hero").querySelector(".hero__main").getBoundingClientRect();
    return {
      ariaLabel: element.getAttribute("aria-label"),
      visible: element.checkVisibility({ visibilityProperty: true }),
      bounds: { left: bounds.left, right: bounds.right, height: bounds.height, bottom: bounds.bottom },
      inMobileFlow: getComputedStyle(element.parentElement).position !== "absolute",
      mainBottom: mainBounds.bottom,
      heroBottom: heroBounds.bottom,
      heroLeft: heroBounds.left,
      heroRight: heroBounds.right,
      labels,
    };
  });
  const expectedPeakDates = [
    "2026-12-01",
    "2026-12-07",
    "2026-12-13",
    "2026-12-20",
    "2026-12-29",
  ];
  expect(
    heroPeaks.ariaLabel.length > 0 &&
      JSON.stringify(heroPeaks.labels.map((label) => label.date)) ===
        JSON.stringify(expectedPeakDates) &&
      JSON.stringify(heroPeaks.labels.map((label) => label.text)) ===
        JSON.stringify(["333", "555", "777", "999", "1111"]) &&
      (!heroPeaks.visible || heroPeaks.labels.every(
        (label, index, labels) =>
          label.left >= heroPeaks.heroLeft - 1 &&
          label.right <= heroPeaks.heroRight + 1 &&
          (index === 0 ||
            (label.left > labels[index - 1].left &&
              label.top < labels[index - 1].top)),
      )) &&
      (heroPeaks.inMobileFlow
        ? heroPeaks.visible &&
          heroPeaks.bounds.bottom <= heroPeaks.heroBottom + 1 &&
          heroPeaks.mainBottom >= testCase.viewport.height - 1
        : !heroPeaks.visible || heroPeaks.bounds.bottom <= testCase.viewport.height + 1),
    `${prefix}: five-peak calendar profile regressed (${JSON.stringify(heroPeaks)})`,
  );

}
