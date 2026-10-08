import { expect, near } from "../check-assertions.mjs";
import { checkMenuMorph } from "../menu-morph-checks.mjs";

export async function checkMenuTrigger({ page, testCase, prefix }) {
  const menuToggle = page.locator(".menu-toggle");
  await checkMenuMorph(page);
  if (testCase.viewport.width > 960) {
    expect(
      (await menuToggle.locator(".menu-toggle__label").innerText()).trim() ===
        testCase.menuLabel,
      `${prefix}: menu trigger does not use the stable Menu label`,
    );
    const triggerTypography = await menuToggle.evaluate((element) => {
      const label = getComputedStyle(
        element.querySelector(".menu-toggle__label"),
      );
      const current = getComputedStyle(
        element.querySelector(".menu-toggle__current"),
      );
      return {
        label: [label.fontSize, label.fontWeight],
        current: [current.fontSize, current.fontWeight],
      };
    });
    expect(
      JSON.stringify(triggerTypography.label) ===
        JSON.stringify(triggerTypography.current),
      `${prefix}: current chapter changes the menu typography on scroll (${JSON.stringify(triggerTypography)})`,
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
      const heroMain = document.querySelector(".hero__main").getBoundingClientRect();
      const introStyle = getComputedStyle(document.querySelector(".hero__intro"));
      const heroText = [".hero__kicker", ".hero__intro"].map((selector) => {
        const element = document.querySelector(selector);
        const bounds = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          bottom: bounds.bottom,
          height: bounds.height,
          opacity: Number.parseFloat(style.opacity),
          top: bounds.top,
          transform: style.transform,
          visibility: style.visibility,
          zIndex: style.zIndex,
        };
      });
      const status = document.querySelector(".event-status").getBoundingClientRect();
      const statusValue = document.querySelector(".event-status__value").getBoundingClientRect();
      const statusLabel = document.querySelector(".event-status__label").getBoundingClientRect();
      const actions = [...document.querySelectorAll(".hero__actions a")];
      return {
        heroHeight: heroMain.height,
        mainBottom: heroMain.bottom,
        heroText,
        heroColor: getComputedStyle(document.querySelector(".hero")).color,
        introColor: introStyle.color,
        introSize: Number.parseFloat(introStyle.fontSize),
        introWeight: introStyle.fontWeight,
        innerHeight,
        statusTop: status.top,
        statusBottom: status.bottom,
        heroBottom: heroContent.bottom,
        statusBottomDelta: Math.abs(statusValue.bottom - statusLabel.bottom),
        actionCount: actions.length,
        primaryTarget: actions[0]?.getAttribute("href"),
      };
    });
    expect(
      near(firstScreen.heroHeight, firstScreen.innerHeight, 1) &&
        firstScreen.statusTop >= firstScreen.heroBottom - 1 &&
        firstScreen.statusBottom <= firstScreen.mainBottom + 1 &&
        firstScreen.actionCount === 1 &&
        firstScreen.primaryTarget === "#diary" &&
        firstScreen.introColor !== firstScreen.heroColor &&
        firstScreen.introSize >= 16 &&
        firstScreen.introSize <= 17.1 &&
        firstScreen.introWeight === "400" &&
        firstScreen.heroText.every(
          (item) =>
            item.height > 0 &&
            item.top >= -1 &&
            item.bottom <= firstScreen.heroBottom + 1 &&
            item.opacity === 1 &&
            item.visibility === "visible" &&
            item.transform !== "none" &&
            item.zIndex === "1",
        ),
      `${prefix}: mobile first screen/status boundary is invalid (${JSON.stringify(firstScreen)})`,
    );
    if (testCase.viewport.width > 360) {
      expect(
        firstScreen.statusBottomDelta <= 1,
        `${prefix}: countdown value and label bottoms diverge by ${firstScreen.statusBottomDelta}px`,
      );
    }
  }

  const initialBox = await menuToggle.boundingBox();
  const initialLogoBox = await page.locator(".site-logo img").boundingBox();
  expect(initialBox, `${prefix}: menu trigger has no box`);
  expect(initialLogoBox, `${prefix}: hero logo has no visible box`);
  const initialHeaderLayout = await page.evaluate(() => {
    const header = document.querySelector(".site-header").getBoundingClientRect();
    const actions = document.querySelector(".header-actions").getBoundingClientRect();
    return {
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyWidth: document.body.getBoundingClientRect().width,
      header: { left: header.left, right: header.right, width: header.width },
      actions: { left: actions.left, right: actions.right, width: actions.width },
      classes: document.querySelector(".site-header").className,
    };
  });
  for (const y of [220, 900, 1500]) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(80);
    const box = await menuToggle.boundingBox();
    expect(box, `${prefix}: menu trigger disappeared at ${y}`);
    const currentHeaderLayout = await page.evaluate(() => {
      const header = document.querySelector(".site-header").getBoundingClientRect();
      const actions = document.querySelector(".header-actions").getBoundingClientRect();
      return {
        innerWidth,
        clientWidth: document.documentElement.clientWidth,
        bodyWidth: document.body.getBoundingClientRect().width,
        header: { left: header.left, right: header.right, width: header.width },
        actions: { left: actions.left, right: actions.right, width: actions.width },
        classes: document.querySelector(".site-header").className,
      };
    });
    expect(
      near(box.x, initialBox.x) &&
        near(box.y, initialBox.y) &&
        near(box.width, initialBox.width) &&
        near(box.height, initialBox.height),
      `${prefix}: menu trigger moved at scroll ${y} (${JSON.stringify({ initialBox, box, initialHeaderLayout, currentHeaderLayout })})`,
    );
  }

  if (testCase.viewport.width > 960) {
    await page.locator("#adventures").scrollIntoViewIfNeeded();
    await page.waitForTimeout(80);
    const longChapter = await menuToggle.evaluate((element) => {
      const current = element.querySelector(".menu-toggle__current");
      const source = document.querySelector('.site-nav__link[href="#adventures"]');
      return {
        current: current.textContent.trim(),
        source: source.textContent.trim(),
        clientWidth: current.clientWidth,
        scrollWidth: current.scrollWidth,
      };
    });
    expect(
      longChapter.current === longChapter.source &&
        longChapter.scrollWidth <= longChapter.clientWidth + 1,
      `${prefix}: long current chapter is clipped (${JSON.stringify(longChapter)})`,
    );

    await menuToggle.hover();
    await page.waitForTimeout(420);
    const menuHover = await menuToggle.evaluate((element) => {
      const style = getComputedStyle(element);
      const current = getComputedStyle(
        element.querySelector(".menu-toggle__current"),
      );
      const primary = getComputedStyle(document.querySelector(".hero .button--primary"));
      return {
        color: style.color,
        currentColor: current.color,
        borderColor: style.borderColor,
        acid: primary.backgroundColor,
      };
    });
    expect(
      menuHover.color === menuHover.acid &&
        menuHover.currentColor === menuHover.acid &&
        menuHover.borderColor === menuHover.acid,
      `${prefix}: scrolled Menu hover lost its acid state (${JSON.stringify(menuHover)})`,
    );

    const headerCta = page.locator(".header-cta");
    await headerCta.hover();
    const headerCtaHover = await headerCta.evaluate((element) => {
      const style = getComputedStyle(element);
      const primary = getComputedStyle(document.querySelector(".hero .button--primary"));
      return {
        backgroundColor: style.backgroundColor,
        color: style.color,
        expectedBackground: primary.backgroundColor,
        expectedColor: primary.color,
      };
    });
    expect(
      headerCtaHover.backgroundColor === headerCtaHover.expectedBackground &&
        headerCtaHover.color === headerCtaHover.expectedColor,
      `${prefix}: header CTA hover exposes a low-contrast transition (${JSON.stringify(headerCtaHover)})`,
    );

    await menuToggle.hover();
  }

  await menuToggle.click();
  const nav = page.locator(".site-nav");
  await nav.waitFor({ state: "visible" });
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(resolve)),
  );
  await page.waitForTimeout(900);
  const previewChapter = await nav.evaluate((element) => ({
    activeIndex:
      element.querySelector('.site-nav__link[aria-current="location"]')
        ?.dataset.navIndex ||
      element.querySelector(".site-nav__link[data-nav-index]")?.dataset
        .navIndex ||
      "",
    previewIndex:
      element.querySelector("[data-menu-preview-index]")?.textContent.trim() ||
      "",
  }));
  expect(
    previewChapter.activeIndex &&
      previewChapter.previewIndex === previewChapter.activeIndex,
    `${prefix}: menu preview is detached from the current chapter (${JSON.stringify(previewChapter)})`,
  );
  const openBox = await menuToggle.boundingBox();
  const openLogoBox = await page.locator(".site-logo img").boundingBox();
  expect(
    openBox && near(openBox.x + openBox.width, initialBox.x + initialBox.width, 1),
    `${prefix}: open control no longer keeps the closed Menu edge (${JSON.stringify({ initialBox, openBox })})`,
  );
  expect(
    openLogoBox &&
      near(openLogoBox.x, initialLogoBox.x, 1) &&
      near(openLogoBox.width, initialLogoBox.width, 1),
    `${prefix}: logo changes axis or scale when the menu opens (${JSON.stringify({ initialLogoBox, openLogoBox })})`,
  );
}
