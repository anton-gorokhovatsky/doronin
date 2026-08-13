import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { chromium, webkit } from "playwright";

import { createDiaryContent } from "../src/content/diary/index.mjs";
import { startSiteServer } from "./lib/site-server.mjs";

const execFileAsync = promisify(execFile);
const diaryEntryCount = createDiaryContent("ru").entries.length;

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function near(first, second, tolerance = 0.75) {
  return Math.abs(first - second) <= tolerance;
}

async function auditPage(browser, browserName, origin, testCase) {
  const context = await browser.newContext({
    reducedMotion: "no-preference",
    viewport: testCase.viewport,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("https://mc.yandex.ru/**", (route) => route.abort());
  // The screenshot gate validates the actual imagery. This suite validates
  // layout and interaction, whose media boxes have explicit CSS geometry.
  // Avoid decoding the full 51 MB asset set again on the small CI runner: a
  // decoded 2 MB JPEG alone can occupy tens of megabytes inside WebKit.
  await page.route(
    /\.(?:avif|gif|jpe?g|m4a|mp4|png|webm|webp)(?:\?.*)?$/iu,
    (route) => route.abort(),
  );
  await page.addInitScript(() => {
    window.__analyticsCalls = [];
    window.ym = (...args) => window.__analyticsCalls.push(args);
  });

  try {
    await page.goto(`${origin}${testCase.path}`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );

    const prefix = `${browserName} ${testCase.name}`;
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
    expect(await page.locator(".button--primary").isVisible(), `${prefix}: primary CTA hidden`);

    const menuToggle = page.locator(".menu-toggle");
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
        const secondary = getComputedStyle(document.querySelector(".button--ghost"));
        return {
          heroHeight: heroContent.height,
          heroText,
          innerHeight,
          statusTop: status.top,
          heroBottom: heroContent.bottom,
          statusBottomDelta: Math.abs(statusValue.bottom - statusLabel.bottom),
          secondaryDisplay: secondary.display,
        };
      });
      expect(
        near(firstScreen.heroHeight, firstScreen.innerHeight, 1) &&
          firstScreen.statusTop >= firstScreen.heroBottom - 1 &&
          firstScreen.secondaryDisplay === "none" &&
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
        const primary = getComputedStyle(document.querySelector(".button--primary"));
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
        const primary = getComputedStyle(document.querySelector(".button--primary"));
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
      const diary = element.querySelector(".site-nav__diary");
      const cta = element.querySelector(".site-nav__cta").getBoundingClientRect();
      const navBox = element.getBoundingClientRect();
      const status = element.querySelector(".site-nav__status").getBoundingClientRect();
      const firstRoute = element.querySelector(
        ".site-nav__primary > .site-nav__link",
      );
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
        diaryDescription: diary?.querySelector("small")?.textContent.trim() || "",
        ctaLeftDelta: Math.abs(cta.left),
        ctaRightDelta: Math.abs(innerWidth - cta.right),
        routeSettingValueDelta: Math.abs(
          textLeft(firstRoute) - textLeft(firstSettingValue),
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
        menuComposition.diaryHref.length > 0 &&
        menuComposition.diaryDescription.length > 0,
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
          menuComposition.routeSettingValueDelta <= 3 &&
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
      const diaryTitle = rect(".site-nav__diary-title strong");
      const diaryArrow = rect(".site-nav__diary-title .icon");
      const diaryDescription = rect(".site-nav__diary small");
      const diary = rect(".site-nav__diary");
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
        diaryArrowGap:
          diaryTitle && diaryArrow ? diaryArrow.left - diaryTitle.right : null,
        diaryDescriptionGap:
          diaryTitle && diaryDescription
            ? diaryDescription.top - diaryTitle.bottom
            : null,
        diaryStatusCenterDelta:
          diary && status
            ? Math.abs(
                diary.top + diary.height / 2 - (status.top + status.height / 2),
              )
            : null,
        diaryStatusGap:
          diary && status ? status.top - diary.bottom : null,
        routeSettingsDelta:
          firstRoute && firstSettingLabel
            ? Math.abs(firstRoute.left - firstSettingLabel.left)
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
    expect(
      proximity.diaryArrowGap >= 0 &&
        proximity.diaryArrowGap <= 12 &&
        proximity.diaryDescriptionGap >= 0 &&
        proximity.diaryDescriptionGap <= 8,
      `${prefix}: diary title, arrow, and description violate proximity (${JSON.stringify(proximity)})`,
    );
    if (testCase.viewport.width <= 960) {
      expect(
        proximity.settingLabelsDelta <= 1 &&
          proximity.mobileLeftAxisDelta <= 1 &&
          proximity.routeDiaryGap >= 28 &&
          proximity.diaryStatusGap >= 28 &&
          proximity.diaryStatusGap <= 40,
        `${prefix}: mobile menu axes or route-to-diary grouping regressed (${JSON.stringify(proximity)})`,
      );
    }
    if (testCase.viewport.width > 960) {
      expect(
        proximity.routeSettingsDelta <= 1 &&
          proximity.previewLogoDelta <= 1 &&
          proximity.diaryStatusCenterDelta <= 4 &&
          proximity.previewIndexShare <= 0.48 &&
          proximity.previewTypeRatio <= 3.25,
        `${prefix}: desktop menu axes or preview hierarchy regressed (${JSON.stringify(proximity)})`,
      );
    }

    const actionSystem = await page.evaluate(() => {
      const selectors = [".button--primary", ".site-nav__cta", ".site-footer__cta"];
      const core = selectors.map((selector) => {
        const style = getComputedStyle(document.querySelector(selector));
        return [
          style.backgroundColor,
          style.color,
          style.fontWeight,
          style.textTransform,
        ];
      });
      return {
        core,
        minHeights: selectors.map((selector) =>
          parseFloat(getComputedStyle(document.querySelector(selector)).minHeight),
        ),
        menuLabel: document
          .querySelector(".site-nav__cta span")
          ?.textContent.trim()
          .replace(/\s+/g, " "),
        footerLabel: document
          .querySelector(".site-footer__cta")
          ?.textContent.trim()
          .replace(/\s+/g, " "),
        partnerBackground: getComputedStyle(
          document.querySelector(".partners__closing"),
        ).backgroundColor,
        primaryBackground: getComputedStyle(
          document.querySelector(".button--primary"),
        ).backgroundColor,
      };
    });
    expect(
      actionSystem.core.every(
        (value) => JSON.stringify(value) === JSON.stringify(actionSystem.core[0]),
      ) &&
        actionSystem.minHeights.every((height) => height >= 56) &&
        actionSystem.menuLabel === testCase.conversionLabel &&
        actionSystem.footerLabel === testCase.conversionLabel &&
        actionSystem.partnerBackground === actionSystem.primaryBackground,
      `${prefix}: primary CTA system diverged (${JSON.stringify(actionSystem)})`,
    );

    await nav.getByRole("button", { name: testCase.lightLabel, exact: true }).click();
    expect(
      (await page.locator("html").getAttribute("data-theme")) === "light" &&
        (await page.locator("html").getAttribute("class")).includes("theme-light"),
      `${prefix}: light theme did not activate`,
    );
    await nav.getByRole("button", { name: testCase.darkLabel, exact: true }).click();
    expect(
      (await page.locator("html").getAttribute("data-theme")) === "dark" &&
        (await page.locator("html").getAttribute("class")).includes("theme-dark"),
      `${prefix}: dark theme did not activate`,
    );

    await nav.locator('[data-theme-option="system"]').click();
    await menuToggle.click();
    await page.waitForFunction(
      () => document.querySelector(".nav-shell")?.open === false,
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(180);
    const heroMediaState = await page.evaluate(() => {
      const video = document.querySelector("[data-hero-video]");
      const toggle = document.querySelector(".hero__media-toggle");
      const style = toggle ? getComputedStyle(toggle) : null;
      return {
        controlHidden: toggle?.hidden === true,
        controlDisplay: style?.display || "none",
        controlVisibility: style?.visibility || "hidden",
        posterPath: video?.poster ? new URL(video.poster).pathname : "",
      };
    });
    const usableMediaControl =
      !heroMediaState.controlHidden &&
      heroMediaState.controlDisplay !== "none" &&
      heroMediaState.controlVisibility !== "hidden";
    const verifiedPosterFallback =
      heroMediaState.posterPath.endsWith("/assets/hero.jpg");
    expect(
      usableMediaControl || verifiedPosterFallback,
      `${prefix}: hero media has neither a usable control nor a verified poster fallback (${JSON.stringify(heroMediaState)})`,
    );

    const calendarState = await page.locator(".bike-calendar").evaluate((element) => {
      const sequence = element.querySelector(".bike-calendar__sequence");
      const stages = [...sequence.children];
      return {
        stageCount: stages.length,
        segmentCount: element.querySelectorAll(".bike-calendar__segment").length,
        stageValues: stages.map((stage) => stage.querySelector("strong")?.textContent.trim()),
        stageWidths: stages.map((stage) => stage.getBoundingClientRect().width),
        stageFontSizes: stages.map((stage) =>
          Number.parseFloat(getComputedStyle(stage.querySelector("strong")).fontSize),
        ),
        sequenceDisplay: getComputedStyle(sequence).display,
        sequenceWidth: sequence.getBoundingClientRect().width,
        parentWidth: element.getBoundingClientRect().width,
      };
    });
    expect(
      calendarState.stageCount === 5 &&
        calendarState.segmentCount === 11 &&
        calendarState.stageValues.join(",") === "333,555,777,999,1111" &&
        calendarState.sequenceWidth <= calendarState.parentWidth + 1,
      `${prefix}: canonical cycling calendar regressed (${JSON.stringify(calendarState)})`,
    );
    if (testCase.viewport.width > 820) {
      const firstRowWidth = calendarState.stageWidths
        .slice(0, 3)
        .reduce((sum, width) => sum + width, 0);
      const secondRowWidth = calendarState.stageWidths
        .slice(3)
        .reduce((sum, width) => sum + width, 0);
      const widthErrors = [
        ...calendarState.stageWidths
          .slice(0, 3)
          .map((width, index) =>
            Math.abs(width / firstRowWidth - [333, 555, 777][index] / 1665),
          ),
        ...calendarState.stageWidths
          .slice(3)
          .map((width, index) =>
            Math.abs(width / secondRowWidth - [999, 1111][index] / 2110),
          ),
      ];
      expect(
        calendarState.sequenceDisplay === "grid" &&
          Math.max(...widthErrors) <= 0.01 &&
          Math.max(...calendarState.stageFontSizes) -
            Math.min(...calendarState.stageFontSizes) <=
            0.5,
        `${prefix}: special-stage rows lose proportional widths or equal number sizes (${JSON.stringify({ ...calendarState, widthErrors })})`,
      );
    }

    const calendarComposition = await page.locator(".bike-calendar").evaluate(
      (element) => {
        const rect = (node) => node?.getBoundingClientRect() || null;
        const rhythmMetrics = [
          ...element.querySelectorAll(".bike-calendar__rhythm dl > div"),
        ].map((metric) => {
          const value = rect(metric.querySelector("dt"));
          const label = rect(metric.querySelector("dd"));
          return {
            gap: value && label ? label.top - value.bottom : null,
            label: metric.querySelector("dd")?.textContent.trim() || "",
            value: metric.querySelector("dt")?.textContent.trim() || "",
          };
        });
        const finish = element.querySelector(".bike-calendar__segment--finish");
        const finishMeta = rect(finish?.querySelector(".bike-calendar__segment-meta"));
        const finishMain = rect(finish?.querySelector(".bike-calendar__segment-main"));
        const finishLabel = rect(finish?.querySelector(".bike-calendar__segment-label"));
        const finishValue = rect(finish?.querySelector(".bike-calendar__finish-mark"));
        const finishTotal = rect(finish?.querySelector(".bike-calendar__cumulative"));
        const terms = [
          ...element.querySelectorAll(".bike-calendar__total > p strong"),
          element.querySelector(".bike-calendar__total-result strong"),
        ].map(rect);
        const operators = [
          ...element.querySelectorAll(".bike-calendar__operator"),
        ].map(rect);
        const center = (box) => box.top + box.height / 2;
        const segmentGroups = [
          ...element.querySelectorAll(
            ".bike-calendar__segment:not(.bike-calendar__segment--finish)",
          ),
        ].map((segment) => {
          const label = rect(segment.querySelector(".bike-calendar__segment-label"));
          const value = rect(segment.querySelector(".bike-calendar__segment-value"));
          const detail = rect(segment.querySelector(".bike-calendar__segment-detail"));
          const total = rect(segment.querySelector(".bike-calendar__cumulative"));
          return {
            labelValueGap: label && value ? value.top - label.bottom : null,
            valueDetailGap: value && detail ? detail.top - value.bottom : null,
            detailTotalGap: detail && total ? total.top - detail.bottom : null,
          };
        });
        const sequenceRows = [
          ...element.querySelectorAll(".bike-calendar__sequence li"),
        ].map((row) => {
          const rowBox = rect(row);
          const index = rect(row.querySelector("span"));
          const value = rect(row.querySelector("strong"));
          const date = rect(row.querySelector("time"));
          return {
            contained: [index, value, date].every(
              (box) =>
                box.left >= rowBox.left - 1 &&
                box.right <= rowBox.right + 1 &&
                box.top >= rowBox.top - 1 &&
                box.bottom <= rowBox.bottom + 1,
            ),
            date: row.querySelector("time")?.textContent.trim() || "",
            indexLeft: rowBox.left + row.querySelector("span").offsetLeft,
            rowBottom: rowBox.bottom,
            rowTop: rowBox.top,
            valueLeft: rowBox.left + row.querySelector("strong").offsetLeft,
          };
        });
        const calendarSegments = [
          ...element.querySelectorAll(".bike-calendar__segment"),
        ].map((segment) => {
          const segmentBox = rect(segment);
          const meta = rect(segment.querySelector(".bike-calendar__segment-meta"));
          const main = rect(segment.querySelector(".bike-calendar__segment-main"));
          const label = rect(segment.querySelector(".bike-calendar__segment-label"));
          const value = rect(
            segment.querySelector(
              ".bike-calendar__segment-value, .bike-calendar__finish-mark",
            ),
          );
          const detail = rect(segment.querySelector(".bike-calendar__segment-detail"));
          const total = rect(segment.querySelector(".bike-calendar__cumulative"));
          return {
            axes: [meta, main, label, detail, total]
              .filter(Boolean)
              .map((box) => box.left),
            contained: [meta, main, label, value, detail, total]
              .filter(Boolean)
              .every(
                (box) =>
                  box.left >= segmentBox.left - 1 &&
                  box.right <= segmentBox.right + 1 &&
                  box.top >= segmentBox.top - 1 &&
                  box.bottom <= segmentBox.bottom + 1,
              ),
            isFinish: segment.classList.contains("bike-calendar__segment--finish"),
            width: segmentBox.width,
          };
        });
        return {
          calendarSegments,
          finish: {
            detailCount: finish?.querySelectorAll(
              ".bike-calendar__segment-detail",
            ).length,
            labelValueGap:
              finishLabel && finishValue ? finishValue.top - finishLabel.bottom : null,
            mainContained:
              finishMeta && finishMain && finishTotal
                ? finishMain.top >= finishMeta.bottom &&
                  finishMain.bottom <= finishTotal.top
                : false,
          },
          formulaOperatorDeltas: operators.map((operator, index) => {
            const leftTerm = terms[index];
            const rightTerm = terms[index + 1];
            if (innerWidth <= 820 && index === 1) {
              return Math.abs(center(operator) - center(rightTerm));
            }
            return Math.max(
              Math.abs(center(operator) - center(leftTerm)),
              Math.abs(center(operator) - center(rightTerm)),
            );
          }),
          formulaOperatorVisibility: operators.map(
            (operator) => Boolean(operator && operator.width > 0 && operator.height > 0),
          ),
          rhythmMetrics,
          segmentGroups,
          sequenceRows,
        };
      },
    );
    expect(
      calendarComposition.rhythmMetrics.every(
        (metric) =>
          metric.gap >= 0 &&
          metric.gap <= 24 &&
          !metric.label.startsWith(metric.value),
      ),
      `${prefix}: calendar summary repeats values or breaks proximity (${JSON.stringify(calendarComposition.rhythmMetrics)})`,
    );
    expect(
      calendarComposition.finish.detailCount === 0 &&
        calendarComposition.finish.mainContained &&
        calendarComposition.finish.labelValueGap >= 0,
      `${prefix}: calendar finish card overlaps or repeats its date (${JSON.stringify(calendarComposition.finish)})`,
    );
    expect(
      calendarComposition.calendarSegments.every(
        (segment) =>
          segment.contained &&
          Math.max(...segment.axes) - Math.min(...segment.axes) <= 1,
      ) &&
        (testCase.viewport.width <= 820 ||
          calendarComposition.calendarSegments.find((segment) => segment.isFinish)
            ?.width >=
            Math.max(
              ...calendarComposition.calendarSegments
                .filter((segment) => !segment.isFinish)
                .map((segment) => segment.width),
            ) *
              1.9),
      `${prefix}: calendar cards lose the shared text axis or the desktop finish row (${JSON.stringify(calendarComposition.calendarSegments)})`,
    );
    expect(
      calendarComposition.formulaOperatorVisibility.length === 2 &&
        calendarComposition.formulaOperatorVisibility.every(Boolean) &&
        calendarComposition.formulaOperatorDeltas.every((delta) => delta <= 3),
      `${prefix}: calendar formula hides a sign or loses its shared optical centre (${JSON.stringify({ deltas: calendarComposition.formulaOperatorDeltas, visibility: calendarComposition.formulaOperatorVisibility })})`,
    );
    if (testCase.viewport.width <= 820) {
      expect(
        calendarComposition.segmentGroups.every(
          (group) =>
            group.labelValueGap >= 0 &&
            group.labelValueGap <= 48 &&
            group.valueDetailGap >= 0 &&
            group.valueDetailGap <= 40 &&
            group.detailTotalGap >= 0 &&
            group.detailTotalGap <= 48,
        ),
        `${prefix}: mobile calendar breaks vertical proximity (${JSON.stringify(calendarComposition.segmentGroups)})`,
      );
      expect(
        calendarComposition.sequenceRows.every(
          (row) => row.contained && !/декабрь$/iu.test(row.date),
        ) &&
          calendarComposition.sequenceRows.every(
            (row, index, rows) =>
              index === 0 || row.rowTop >= rows[index - 1].rowBottom - 1,
          ) &&
          Math.max(...calendarComposition.sequenceRows.map((row) => row.indexLeft)) -
            Math.min(...calendarComposition.sequenceRows.map((row) => row.indexLeft)) <=
            1 &&
          Math.max(...calendarComposition.sequenceRows.map((row) => row.valueLeft)) -
            Math.min(...calendarComposition.sequenceRows.map((row) => row.valueLeft)) <=
            1,
        `${prefix}: mobile stage list loses its shared axes or date grammar (${JSON.stringify(calendarComposition.sequenceRows)})`,
      );
    }

    if (testCase.viewport.width > 960) {
      const stickyState = await page.locator(".athlete").evaluate(async (section) => {
        const media = section.querySelector(".athlete__media");
        const read = () => {
          const box = media.getBoundingClientRect();
          return { bottom: box.bottom, top: box.top };
        };
        const settle = () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          );
        const previousScrollBehavior = document.documentElement.style.scrollBehavior;
        const previousBodyScrollBehavior = document.body.style.scrollBehavior;
        document.documentElement.style.setProperty("scroll-behavior", "auto", "important");
        document.body.style.setProperty("scroll-behavior", "auto", "important");
        scrollTo(0, 0);
        await settle();
        const style = getComputedStyle(media);
        const topOffset = Number.parseFloat(style.top);
        const sectionTop = section.getBoundingClientRect().top + scrollY;
        const maxScroll =
          sectionTop + section.offsetHeight - media.offsetHeight - topOffset;
        const holdStart = sectionTop - topOffset;
        const holdEnd = maxScroll;
        scrollTo(0, holdStart + Math.max(40, (holdEnd - holdStart) * 0.45));
        await settle();
        const held = read();
        scrollTo(0, maxScroll + 120);
        await settle();
        const released = read();
        document.documentElement.style.scrollBehavior = previousScrollBehavior;
        document.body.style.scrollBehavior = previousBodyScrollBehavior;
        return {
          corridor: maxScroll - sectionTop,
          held,
          position: style.position,
          released,
          scrollY,
          sectionTop,
          topOffset,
        };
      });
      expect(
        stickyState.position === "sticky" &&
          near(stickyState.held.top, stickyState.topOffset, 2) &&
          stickyState.released.top < stickyState.topOffset - 20,
        `${prefix}: Viktor portrait does not hold and release as a sticky chapter image (${JSON.stringify(stickyState)})`,
      );
    }

    const diaryTabs = page.locator("[data-diary-story-tab]");
    const diaryPanels = page.locator("[data-diary-story-panel]");
    expect(
      (await diaryTabs.count()) === diaryEntryCount &&
        (await diaryPanels.count()) === diaryEntryCount,
      `${prefix}: training diary does not expose all structured stories`,
    );
    const diaryRangeState = await page.locator(".diary__heading").evaluate(
      (element) => {
        const range = element.querySelector(".diary__range");
        const count = range.querySelector(".diary__range-count");
        const start = range.querySelector(".diary__range-start");
        const end = range.querySelector(".diary__range-end");
        const dot = range.querySelector(".diary__range-dot");
        const period = range.querySelector(".diary__range-period");
        const headingLabel = element.querySelector(".diary__eyebrow");
        const groups = [count, start, end];
        const bounds = groups.map((group) => group.getBoundingClientRect());
        const rangeBounds = range.getBoundingClientRect();
        return {
          atomic: groups.every(
            (group) => getComputedStyle(group).whiteSpace === "nowrap",
          ),
          containsNbsp:
            count.textContent.includes("\u00a0") &&
            start.textContent.includes("\u00a0") &&
            end.textContent.includes("\u00a0"),
          dotDisplay: getComputedStyle(dot).display,
          display: getComputedStyle(range).display,
          headingDisplay: getComputedStyle(element).display,
          headingLeft: element.getBoundingClientRect().left,
          labelLeft: headingLabel.getBoundingClientRect().left,
          periodLeft: period.getBoundingClientRect().left,
          rangeLeft: range.getBoundingClientRect().left,
          inBounds:
            bounds.every(
              (box) =>
                box.left >= rangeBounds.left - 1 &&
                box.right <= rangeBounds.right + 1,
            ),
          tops: bounds.map((box) => box.top),
        };
      },
    );
    expect(
      diaryRangeState.atomic &&
        diaryRangeState.containsNbsp &&
        diaryRangeState.inBounds &&
        (testCase.viewport.width <= 390
          ? diaryRangeState.headingDisplay === "grid" &&
            diaryRangeState.display === "flex" &&
            diaryRangeState.dotDisplay !== "none" &&
            near(diaryRangeState.headingLeft, diaryRangeState.labelLeft, 1) &&
            near(diaryRangeState.headingLeft, diaryRangeState.rangeLeft, 1) &&
            diaryRangeState.tops[0] <= diaryRangeState.tops[1] &&
            near(diaryRangeState.tops[1], diaryRangeState.tops[2], 1) &&
            (near(diaryRangeState.tops[0], diaryRangeState.tops[1], 1) ||
              near(diaryRangeState.headingLeft, diaryRangeState.periodLeft, 1))
          : diaryRangeState.display === "flex" &&
            diaryRangeState.dotDisplay !== "none" &&
            Math.max(...diaryRangeState.tops) -
              Math.min(...diaryRangeState.tops) <=
              1),
      `${prefix}: diary date range loses semantic grouping (${JSON.stringify(diaryRangeState)})`,
    );
    const diaryLiveState = await page.locator("[data-diary-live]").evaluate(
      (element) => {
        const count = element.querySelector("[data-diary-countdown]");
        const label = element.querySelector("[data-diary-countdown-label]");
        const primary = element.querySelector(
          '[data-analytics-goal="diary_follow"]',
        );
        const archive = element.querySelector('a[href="#diary-archive"]');
        const bounds = element.getBoundingClientRect();
        const nodeBounds = [count, label, primary, archive].map((node) => {
          const box = node?.getBoundingClientRect();
          return box
            ? {
                left: box.left,
                right: box.right,
                top: box.top,
                bottom: box.bottom,
              }
            : null;
        });
        return {
          count: count?.textContent.trim(),
          label: label?.textContent.trim(),
          progress: Number.parseFloat(
            getComputedStyle(element).getPropertyValue("--diary-progress"),
          ),
          actionsPresent: Boolean(primary && archive),
          bounds: {
            left: bounds.left,
            right: bounds.right,
            top: bounds.top,
            bottom: bounds.bottom,
          },
          nodeBounds,
          contentInBounds: [label, primary, archive].every((node) => {
            const box = node?.getBoundingClientRect();
            return (
              box &&
              box.left >= bounds.left - 1 &&
              box.right <= bounds.right + 1 &&
              box.top >= bounds.top - 1 &&
              box.bottom <= bounds.bottom + 1
            );
          }),
          countWithinOpticalAllowance: (() => {
            const box = count?.getBoundingClientRect();
            const shift = Math.abs(
              Number.parseFloat(getComputedStyle(count).translate) || 0,
            );
            return Boolean(
              box &&
                box.left >= bounds.left - shift - 1 &&
                box.right <= bounds.right + 1 &&
                box.top >= bounds.top - 1 &&
                box.bottom <= bounds.bottom + 1,
            );
          })(),
        };
      },
    );
    expect(
      /^\d{1,3}(?:\/31)?$/u.test(diaryLiveState.count) &&
        diaryLiveState.label.length > 0 &&
        diaryLiveState.progress >= 0 &&
        diaryLiveState.progress <= 1 &&
        diaryLiveState.actionsPresent &&
        diaryLiveState.contentInBounds &&
        diaryLiveState.countWithinOpticalAllowance,
      `${prefix}: live diary contract regressed (${JSON.stringify(diaryLiveState)})`,
    );
    const readDiaryState = () =>
      page.locator("[data-diary-stories]").evaluate((element) => {
        const tabs = [...element.querySelectorAll("[data-diary-story-tab]")];
        const panels = [...element.querySelectorAll("[data-diary-story-panel]")];
        const rail = element.querySelector("[data-diary-story-tabs]");
        const railBounds = rail.getBoundingClientRect();
        const tabBounds = tabs.map((tab) => tab.getBoundingClientRect());
        const selectedTab = tabs.find(
          (tab) => tab.getAttribute("aria-selected") === "true",
        );
        const selectedBounds = selectedTab?.getBoundingClientRect();
        return {
          contained: tabs.every((tab) => {
            const bounds = tab.getBoundingClientRect();
            return [...tab.children]
              .filter((child) => getComputedStyle(child).display !== "none")
              .every((child) => {
                const box = child.getBoundingClientRect();
                return (
                  box.left >= bounds.left - 1 &&
                  box.right <= bounds.right + 1 &&
                  box.top >= bounds.top - 1 &&
                  box.bottom <= bounds.bottom + 1
                );
              });
          }),
          selected: tabs.findIndex(
            (tab) => tab.getAttribute("aria-selected") === "true",
          ),
          visiblePanels: panels
            .map((panel, index) => (!panel.hidden ? index : -1))
            .filter((index) => index >= 0),
          railFits: rail.scrollWidth <= rail.clientWidth + 1,
          thirdPeeks:
            tabBounds[0]?.left >= railBounds.left - 1 &&
            tabBounds[1]?.right <= railBounds.right + 1 &&
            tabBounds[2]?.left < railBounds.right - 1 &&
            tabBounds[2]?.right > railBounds.right + 1,
          thirdPeekWidth: Math.max(
            0,
            Math.min(tabBounds[2]?.right || 0, railBounds.right) -
              Math.max(tabBounds[2]?.left || 0, railBounds.left),
          ),
          selectedFullyVisible: Boolean(
            selectedBounds &&
              selectedBounds.left >= railBounds.left - 1 &&
              selectedBounds.right <= railBounds.right + 1,
          ),
          scrollLeft: rail.scrollLeft,
          scrollSnapType: getComputedStyle(rail).scrollSnapType,
          scrollSnapStops: tabs.map(
            (tab) => getComputedStyle(tab).scrollSnapStop,
          ),
          overscrollBehaviorX: getComputedStyle(rail).overscrollBehaviorX,
          touchAction: getComputedStyle(rail).touchAction,
          nativeDragDisabled: tabs.every((tab) => !tab.draggable),
        };
      });
    const initialDiaryState = await readDiaryState();
    expect(
      initialDiaryState.contained &&
        initialDiaryState.selected === 0 &&
        JSON.stringify(initialDiaryState.visiblePanels) === "[0]" &&
        (testCase.viewport.width > 390
          ? initialDiaryState.railFits
          : !initialDiaryState.railFits &&
            initialDiaryState.thirdPeeks &&
            initialDiaryState.thirdPeekWidth >= 44 &&
            initialDiaryState.overscrollBehaviorX === "none" &&
            initialDiaryState.touchAction === "pan-x" &&
            initialDiaryState.nativeDragDisabled &&
            initialDiaryState.scrollSnapStops.every(
              (value) => value === "always",
            )),
      `${prefix}: initial diary story state regressed (${JSON.stringify(initialDiaryState)})`,
    );
    await diaryTabs.nth(diaryEntryCount - 1).click();
    await page.waitForTimeout(220);
    const selectedDiaryState = await readDiaryState();
    expect(
      selectedDiaryState.selected === diaryEntryCount - 1 &&
        JSON.stringify(selectedDiaryState.visiblePanels) ===
          JSON.stringify([diaryEntryCount - 1]) &&
        (testCase.viewport.width > 390
          ? selectedDiaryState.railFits
          : !selectedDiaryState.railFits &&
            selectedDiaryState.scrollLeft > 0 &&
            selectedDiaryState.selectedFullyVisible &&
            /(?:x|inline)/u.test(selectedDiaryState.scrollSnapType)),
      `${prefix}: diary story switch or mobile reveal regressed (${JSON.stringify(selectedDiaryState)})`,
    );
    await diaryTabs.nth(diaryEntryCount - 1).evaluate((tab) => tab.focus());
    await page.keyboard.press("ArrowLeft");
    const keyboardDiaryState = await readDiaryState();
    expect(
      keyboardDiaryState.selected === diaryEntryCount - 2 &&
        JSON.stringify(keyboardDiaryState.visiblePanels) ===
          JSON.stringify([diaryEntryCount - 2]),
      `${prefix}: diary story keyboard navigation regressed (${JSON.stringify(keyboardDiaryState)})`,
    );
    await diaryTabs.first().click();

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

    const partnerMetricsFit = await page.locator(".partner-proof__metrics").evaluate(
      (element) => {
        const container = element.getBoundingClientRect();
        return [...element.querySelectorAll("strong")].every((value) => {
          const box = value.getBoundingClientRect();
          return box.left >= container.left - 1 && box.right <= container.right + 1;
        });
      },
    );
    expect(partnerMetricsFit, `${prefix}: partner metric overflows its grid`);
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
        partnerHover.backgroundColor === "rgba(0, 0, 0, 0)" &&
        partnerHover.textDecorationColor !== "rgba(0, 0, 0, 0)",
      `${prefix}: partner CTA hover creates a false card or loses its cue (${JSON.stringify(partnerHover)})`,
    );

    if (testCase.viewport.width <= 390) {
      expect(
        (await page.locator(".bike-calendar__sequence > li").count()) === 5,
        `${prefix}: mobile cycling sequence missing`,
      );
    }

    await menuToggle.click();
    await page.evaluate(() => {
      const chapter = document.querySelector('.site-nav a[href="#about"]');
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

    const analytics = await page.evaluate(() =>
      window.__analyticsCalls
        .filter(([, command]) => command === "reachGoal")
        .map(([counterId, command, goal, params]) => ({
          counterId,
          command,
          goal,
          params,
        })),
    );
    for (const goal of [
      "menu_open",
      "theme_change",
      "proof_open",
      "chapter_navigation",
      "project_explore",
      "language_switch",
    ]) {
      expect(
        analytics.some((event) => event.goal === goal),
        `${prefix}: analytics goal ${goal} did not fire`,
      );
    }
    expect(
      analytics.every(
        ({ counterId, command, params }) =>
          counterId === 111159425 &&
          command === "reachGoal" &&
          Object.keys(params || {}).every((key) =>
            ["chapter", "language", "location", "theme"].includes(
              key,
            ),
          ),
      ),
      `${prefix}: analytics emitted an unknown counter, command, or parameter`,
    );

    expect(errors.length === 0, `${prefix}: page errors: ${errors.join("; ")}`);
    return `${prefix}: PASS`;
  } finally {
    await context.close();
  }
}

const allBrowsers = [
  ["chromium", chromium],
  ["webkit", webkit],
];
const requestedBrowserNames = new Set(
  (process.env.BROWSER_REGRESSION_ENGINES || "chromium,webkit")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean),
);
const browsers = allBrowsers.filter(([name]) => requestedBrowserNames.has(name));
expect(browsers.length > 0, "Browser regression has no valid engines to run");
const cases = [
  {
    name: "RU 1440×900",
    path: "/?browser-regression=ru-desktop#top",
    viewport: { width: 1440, height: 900 },
    darkLabel: "Тёмная",
    lightLabel: "Светлая",
    menuLabel: "МЕНЮ",
    conversionLabel: "Обсудить участие",
  },
  {
    name: "RU 390×844",
    path: "/?browser-regression=ru-mobile#top",
    viewport: { width: 390, height: 844 },
    darkLabel: "Тёмная",
    lightLabel: "Светлая",
    menuLabel: "МЕНЮ",
    conversionLabel: "Обсудить участие",
  },
  {
    name: "EN 320×844",
    path: "/en/?browser-regression=en-mobile#top",
    viewport: { width: 320, height: 844 },
    darkLabel: "Dark",
    lightLabel: "Light",
    menuLabel: "MENU",
    conversionLabel: "Discuss a partnership",
  },
];

const workerMarker = "--case";
const workerIndex = process.argv.indexOf(workerMarker);

if (workerIndex >= 0) {
  const browserName = process.argv[workerIndex + 1];
  const caseIndex = Number(process.argv[workerIndex + 2]);
  const origin = process.argv[workerIndex + 3];
  const browserType = new Map(browsers).get(browserName);
  const testCase = cases[caseIndex];
  expect(browserType && testCase && origin, "Invalid browser regression worker arguments");

  const browser = await browserType.launch({ headless: true });
  try {
    console.log(await auditPage(browser, browserName, origin, testCase));
  } finally {
    await browser.close().catch(() => {});
  }
} else {
  await execFileAsync(process.execPath, ["src/build.mjs"]);
  const server = await startSiteServer("preview");
  const results = [];
  const scriptPath = fileURLToPath(import.meta.url);
  try {
    for (const [name] of browsers) {
      for (const [caseIndex, testCase] of cases.entries()) {
        console.log(`[browser-regression] ${name} ${testCase.name}`);
        const { stdout, stderr } = await execFileAsync(
          process.execPath,
          [scriptPath, workerMarker, name, String(caseIndex), server.origin],
          { maxBuffer: 10 * 1024 * 1024 },
        );
        if (stderr) process.stderr.write(stderr);
        results.push(stdout.trim());
      }
    }
  } finally {
    await server.close();
  }

  console.log(results.join("\n"));
}
