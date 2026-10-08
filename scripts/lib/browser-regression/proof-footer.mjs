import { expect } from "../check-assertions.mjs";

export async function checkProofAndFooter({ page, browserName, testCase, prefix }) {
  const menuToggle = page.locator(".menu-toggle");
  const nav = page.locator(".site-nav");
  const proof = page.locator(".proof-sources");
  const proofScrollBehavior = await page.evaluate(() => {
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    document.querySelector(".proof-sources").scrollIntoView({
      behavior: "instant",
      block: "center",
    });
    return previous;
  });
  await page.waitForTimeout(80);
  const beforeOpen = await proof.locator("summary").evaluate((element) =>
    element.getBoundingClientRect().top,
  );
  await proof.locator("summary").click();
  await page.waitForTimeout(380);
  const afterOpen = await proof.locator("summary").evaluate((element) =>
    element.getBoundingClientRect().top,
  );
  await page.evaluate((previous) => {
    document.documentElement.style.scrollBehavior = previous;
  }, proofScrollBehavior);
  expect(
    Math.abs(afterOpen - beforeOpen) <= 1,
    `${prefix}: proof disclosure shifted its anchor by ${afterOpen - beforeOpen}px`,
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

  const partnerReferenceFit = await page.locator(".partner-proof--reference").evaluate(
    (element) => {
      const container = element.getBoundingClientRect();
      const link = element.querySelector(".partner-proof__link");
      if (!link || link.getAttribute("href") !== "#proof") return false;
      const box = link.getBoundingClientRect();
      return (
        box.left >= container.left - 1 &&
        box.right <= container.right + 1 &&
        box.top >= container.top - 1 &&
        box.bottom <= container.bottom + 1
      );
    },
  );
  expect(partnerReferenceFit, `${prefix}: partner proof reference overflows its group`);
  const partnerProximity = await page.locator(".partners__contact-module").evaluate(
    (element) => {
      const label = element.querySelector(".partners__person span").getBoundingClientRect();
      const person = element.querySelector(".partners__person strong").getBoundingClientRect();
      return {
        contactGap: person.left - label.right,
      };
    },
  );
  expect(
    partnerProximity.contactGap >= 0 && partnerProximity.contactGap <= 16,
    `${prefix}: partner contact label and person violate proximity (${JSON.stringify(partnerProximity)})`,
  );

  const footerCountdown = page.locator("[data-footer-countdown]");
  const footerHasNumericCountdown =
    (await footerCountdown.locator("[data-footer-countdown-value]").count()) === 1;
  if (footerHasNumericCountdown) {
    await footerCountdown.evaluate((element) =>
      element.scrollIntoView({ block: "center", behavior: "instant" }),
    );
    await page.waitForTimeout(90);
    const footerCountGeometry = await footerCountdown.evaluate((element) => {
      const value = element.querySelector("[data-footer-countdown-value]");
      const sizer = element.querySelector("[data-footer-countdown-sizer]");
      const live = element.querySelector("[data-footer-countdown-live]");
      const label = element.querySelector("[data-footer-countdown-label]");
      const sizerBounds = sizer.getBoundingClientRect();
      const liveBounds = live.getBoundingClientRect();
      const labelBounds = label.getBoundingClientRect();
      return {
        gap: labelBounds.left - liveBounds.right,
        justifyItems: getComputedStyle(value).justifyItems,
        live: live.textContent,
        rightDelta: Math.abs(liveBounds.right - sizerBounds.right),
        target: sizer.textContent,
      };
    });
    expect(
      footerCountGeometry.justifyItems === "end" &&
        footerCountGeometry.live === footerCountGeometry.target &&
        footerCountGeometry.rightDelta <= 1 &&
        footerCountGeometry.gap >= 0 &&
        footerCountGeometry.gap <= 32,
      `${prefix}: animated footer count separates from its day label (${JSON.stringify(footerCountGeometry)})`,
    );
  }
  // Regression: a generic external-link transform used to move the upward
  // footer arrow sideways and lift the entire action out of its alignment.
  const footerAction = page.locator(".site-footer__cta");
  await footerAction.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(240);
  const actionGeometry = (element) => {
    const rectangle = (node) => {
      const r = node.getBoundingClientRect();
      return [r.x, r.y + scrollY, r.width, r.height];
    };
    return [...rectangle(element), ...rectangle(element.querySelector(".icon"))];
  };
  const restingGeometry = await footerAction.evaluate(actionGeometry);
  await footerAction.hover();
  for (const delay of [60, 160]) {
    await page.waitForTimeout(delay);
    const hoveredGeometry = await footerAction.evaluate(actionGeometry);
    expect(
      hoveredGeometry.every((value, index) => Math.abs(value - restingGeometry[index]) < 0.75),
      `${prefix}: footer action or upward arrow moves during hover`,
    );
  }
  await page.mouse.move(0, 0);
  await page.waitForTimeout(240);
  const returnedGeometry = await footerAction.evaluate(actionGeometry);
  expect(
    returnedGeometry.every((value, index) => Math.abs(value - restingGeometry[index]) < 0.75),
    `${prefix}: footer action does not return to its resting geometry`,
  );

  const firstPartnerAction = page.locator(".partners__channels a").first();
  await firstPartnerAction.hover();
  await page.waitForTimeout(320);
  const partnerHover = await page.evaluate(() => {
    const element = document.querySelector(".partners__channels a");
    if (!element) return null;

    return {
      backgroundColor: getComputedStyle(element).backgroundColor,
      textDecorationColor: getComputedStyle(element.querySelector("span"))
        .textDecorationColor,
    };
  });
  expect(
    partnerHover &&
      (testCase.viewport.width <= 640
        ? partnerHover.backgroundColor !== "rgba(0, 0, 0, 0)"
        : partnerHover.backgroundColor === "rgba(0, 0, 0, 0)") &&
      partnerHover.textDecorationColor !== "rgba(0, 0, 0, 0)",
    `${prefix}: contact action loses its mobile button surface or hover cue (${JSON.stringify(partnerHover)})`,
  );

  if (testCase.viewport.width <= 390) {
    const mobileSurfaceFixes = await page.evaluate(() => {
      const proofTitle = getComputedStyle(document.querySelector(".proof h2"));
      const notesDivider = getComputedStyle(
        document.querySelector(".ride-film__notes"),
        "::before",
      );
      return {
        notesDividerImage: notesDivider.backgroundImage,
        proofHangingPunctuation: proofTitle.getPropertyValue(
          "hanging-punctuation",
        ),
      };
    });
    expect(
      (await page.locator(".calendar-poster > li").count()) === 5 &&
        mobileSurfaceFixes.notesDividerImage === "none" &&
        (browserName !== "webkit" ||
          mobileSurfaceFixes.proofHangingPunctuation === "none"),
      `${prefix}: mobile cycling sequence or Safari surface fixes regressed (${JSON.stringify(mobileSurfaceFixes)})`,
    );
  }

  await menuToggle.click();
  await page.evaluate(() => {
    const chapter = document.querySelector('.site-nav a[href="#top"]');
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

}
