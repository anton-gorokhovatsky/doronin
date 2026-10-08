import { expect, near } from "../check-assertions.mjs";

export async function checkMenuLayout({ page, testCase, prefix }) {
  const nav = page.locator(".site-nav");
  const material = await page.evaluate((mobile) => {
    const readSurface = (element, pseudo = null) => {
      const style = getComputedStyle(element, pseudo);
      return {
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        backdropFilter: style.backdropFilter,
        height: style.height,
      };
    };

    if (mobile) {
      return {
        header: readSurface(document.querySelector(".site-header")),
        layer: readSurface(document.querySelector(".site-header"), "::before"),
        nav: readSurface(document.querySelector(".site-nav")),
        viewportHeight: innerHeight,
      };
    }

    return {
      header: readSurface(document.querySelector(".site-header"), "::before"),
      nav: readSurface(document.querySelector(".site-nav")),
    };
  }, testCase.viewport.width <= 960);
  if (testCase.viewport.width <= 960) {
    expect(
      material.layer.backgroundImage !== "none" &&
        material.layer.backdropFilter !== "none" &&
        near(parseFloat(material.layer.height), material.viewportHeight, 1) &&
        [material.header, material.nav].every(
          (surface) =>
            surface.backgroundImage === "none" &&
            surface.backgroundColor === "rgba(0, 0, 0, 0)" &&
            surface.backdropFilter === "none",
        ),
      `${prefix}: mobile menu must use one viewport-sized compositing layer (${JSON.stringify(material)})`,
    );
  } else {
    expect(
      material.header.backgroundImage === material.nav.backgroundImage &&
        material.header.backdropFilter === material.nav.backdropFilter,
      `${prefix}: desktop interface material diverged`,
    );
  }
  const controlMaterials = await page.evaluate(() => {
    const read = (selector) => {
      const style = getComputedStyle(document.querySelector(selector));
      return {
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        visibility: style.visibility,
      };
    };
    return {
      logo: read(".site-logo"),
      menu: read(".menu-toggle"),
      headerCta: read(".header-cta"),
      menuLabel: document.querySelector(".menu-toggle")?.getAttribute("aria-label"),
      menuSize: (() => {
        const rect = document.querySelector(".menu-toggle").getBoundingClientRect();
        return [rect.width, rect.height];
      })(),
      visibleMenuText: document.querySelector(".menu-toggle__label")?.getClientRects().length,
    };
  });
  if (testCase.viewport.width <= 960) {
    expect(
      controlMaterials.logo.backgroundImage === "none" &&
        controlMaterials.logo.backgroundColor === "rgba(0, 0, 0, 0)" &&
        controlMaterials.menu.backgroundImage === "none" &&
        controlMaterials.menu.backgroundColor === "rgba(0, 0, 0, 0)" &&
        controlMaterials.menuSize.every((size) => size >= 44) &&
        controlMaterials.visibleMenuText === 0 &&
        /закрыть|close/i.test(controlMaterials.menuLabel || ""),
      `${prefix}: mobile open Menu control must be a labelled close icon with a 44px target (${JSON.stringify(controlMaterials)})`,
    );
  } else {
    expect(
      controlMaterials.logo.backgroundImage === "none" &&
        controlMaterials.logo.backgroundColor === "rgba(0, 0, 0, 0)" &&
        controlMaterials.menu.backgroundImage === "none" &&
        controlMaterials.menu.backgroundColor === "rgba(0, 0, 0, 0)" &&
        controlMaterials.headerCta.visibility === "hidden",
      `${prefix}: desktop open Menu control must remain an outline on the shared material (${JSON.stringify(controlMaterials)})`,
    );
  }
  if (testCase.viewport.width <= 960) {
    const mobileMenu = await nav.evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      top: element.getBoundingClientRect().top,
      headerBottom: document.querySelector(".site-header").getBoundingClientRect().bottom,
    }));
    expect(
      mobileMenu.scrollWidth <= mobileMenu.clientWidth + 1 &&
        near(mobileMenu.top, mobileMenu.headerBottom, 2),
      `${prefix}: mobile menu overflows horizontally or is detached from the header`,
    );
  }

  const menuComposition = await nav.evaluate((element) => {
    const textLeft = (node) => {
      if (!node) return null;
      const range = document.createRange();
      range.selectNodeContents(node);
      return range.getBoundingClientRect().left;
    };
    const settings = [...element.querySelectorAll(".site-nav__setting")];
    const diary = element.querySelector('.site-nav__primary a[href="#diary"]');
    const cta = element.querySelector(".site-nav__cta").getBoundingClientRect();
    const navBox = element.getBoundingClientRect();
    const status = element.querySelector(".site-nav__status").getBoundingClientRect();
    const firstSettingLabel = element.querySelector(".site-nav__setting-label");
    const firstSettingValue = element.querySelector(
      ".site-nav__setting-options > :first-child",
    );
    const settingTargets = [
      ...element.querySelectorAll(
        ".site-nav__setting-options button, .site-nav__setting-options a",
      ),
    ].map((target) => target.getBoundingClientRect());
    return {
      settings: settings.map((setting) =>
        setting.textContent.trim().replace(/\s+/g, " "),
      ),
      forbiddenControls: element.querySelectorAll(
        "[data-motion-option], [data-analytics-option], .site-nav__settings summary",
      ).length,
      diaryHref: diary?.getAttribute("href") || "",
      ctaLeftDelta: Math.abs(cta.left),
      ctaRightDelta: Math.abs(innerWidth - cta.right),
      settingValueLabelDelta: Math.abs(
        textLeft(firstSettingLabel) - textLeft(firstSettingValue),
      ),
      statusRightOverflow: Math.max(0, status.right - navBox.right),
      settingTargetMinHeight: Math.min(
        ...settingTargets.map((target) => target.height),
      ),
    };
  });
  expect(
    menuComposition.settings.length === 2 &&
      menuComposition.forbiddenControls === 0 &&
      menuComposition.diaryHref === "#diary",
    `${prefix}: menu utility composition regressed (${JSON.stringify(menuComposition)})`,
  );
  if (testCase.viewport.width > 960) {
    expect(
      menuComposition.ctaRightDelta <= 1,
      `${prefix}: menu CTA no longer reaches the right edge`,
    );
  } else {
    expect(
      menuComposition.ctaLeftDelta <= 1 &&
        menuComposition.ctaRightDelta <= 1 &&
        menuComposition.settingValueLabelDelta <= 3 &&
        menuComposition.statusRightOverflow <= 1 &&
        menuComposition.settingTargetMinHeight >= 44,
      `${prefix}: mobile CTA, content axis, status, or settings targets regressed (${JSON.stringify(menuComposition)})`,
    );
  }

  const proximity = await nav.evaluate((element) => {
    const rect = (selector) =>
      element.querySelector(selector)?.getBoundingClientRect() || null;
    const textRect = (selector) => {
      const node = element.querySelector(selector);
      if (!node) return null;
      const range = document.createRange();
      range.selectNodeContents(node);
      return range.getBoundingClientRect();
    };
    const diary = rect('.site-nav__primary a[href="#diary"]');
    const status = rect(".site-nav__status");
    const firstRoute = rect(".site-nav__primary > .site-nav__link");
    const lastRoute = rect(".site-nav__primary > .site-nav__link:last-child");
    const firstSettingLabel = rect(".site-nav__setting-label");
    const preview = rect(".site-nav__preview");
    const previewIndex = textRect(".site-nav__preview-index");
    const previewTitle = textRect(".site-nav__preview-title");
    const previewKicker = rect(".site-nav__preview-kicker");
    const logo =
      document.querySelector(".site-logo img")?.getBoundingClientRect() || null;
    const settingLabels = [...element.querySelectorAll(".site-nav__setting-label")]
      .map((node) => node.getBoundingClientRect().left);
    const mobileLeftAxes = [
      logo?.left,
      firstRoute?.left,
      diary?.left,
      firstSettingLabel?.left,
    ].filter(Number.isFinite);

    return {
      routeStatusGap: lastRoute && status ? status.top - lastRoute.bottom : null,
      routeSettingsGap:
        firstSettingLabel
          ? firstSettingLabel.left - rect(".site-nav__primary").right
          : null,
      settingLabelsDelta:
        settingLabels.length > 1
          ? Math.max(...settingLabels) - Math.min(...settingLabels)
          : 0,
      routeDiaryGap:
        lastRoute && diary ? diary.top - lastRoute.bottom : null,
      mobileLeftAxisDelta:
        mobileLeftAxes.length > 1
          ? Math.max(...mobileLeftAxes) - Math.min(...mobileLeftAxes)
          : 0,
      previewLogoDelta:
        previewKicker && logo ? Math.abs(previewKicker.left - logo.left) : null,
      previewIndexShare:
        preview && previewIndex ? previewIndex.width / preview.width : null,
      previewTypeRatio:
        previewIndex && previewTitle
          ? previewIndex.height / previewTitle.height
          : null,
    };
  });
  if (testCase.viewport.width <= 960) {
    expect(
      proximity.settingLabelsDelta <= 1 &&
        proximity.mobileLeftAxisDelta <= 1 &&
        proximity.routeStatusGap >= 16,
      `${prefix}: mobile menu axes or route-to-status grouping regressed (${JSON.stringify(proximity)})`,
    );
  }
  if (testCase.viewport.width > 960) {
    expect(
      proximity.routeSettingsGap >= 24 &&
        proximity.previewLogoDelta <= 1 &&
        proximity.previewIndexShare <= 0.48 &&
        proximity.previewTypeRatio <= 3.25,
      `${prefix}: desktop menu axes or preview hierarchy regressed (${JSON.stringify(proximity)})`,
    );
  }

}
