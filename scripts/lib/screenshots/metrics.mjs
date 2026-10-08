export async function readScreenshotMetrics(page) {
  return page.evaluate(() => {
    const active = document.activeElement;
    const video = document.querySelector("[data-hero-video]");
    const cta = document.querySelector(".button--primary")?.getBoundingClientRect();
    return {
      activeElement: active
        ? `${active.tagName.toLowerCase()}${active.className ? `.${String(active.className).trim().replace(/\s+/g, ".")}` : ""}`
        : null,
      htmlClass: document.documentElement.className,
      menuPrimaryColumns: getComputedStyle(
        document.querySelector(".site-nav__primary"),
      ).gridTemplateColumns,
      clientWidth: document.documentElement.clientWidth,
      ctaVisible: Boolean(cta && cta.width > 0 && cta.height > 0),
      fontSize: getComputedStyle(document.documentElement).fontSize,
      forcedColors: matchMedia("(forced-colors: active)").matches,
      heroPaused: video ? video.paused : null,
      videoToggleHidden: document.querySelector(".hero__media-toggle")?.hidden ?? null,
      lang: document.documentElement.lang,
      menuOpen: document.querySelector(".nav-shell")?.hasAttribute("open") || false,
      menuFits: (() => {
        const menu = document.querySelector(".site-nav");
        return menu ? menu.scrollHeight <= menu.clientHeight : null;
      })(),
      menuCtaVisible: (() => {
        const rect = document.querySelector(".site-nav__cta")?.getBoundingClientRect();
        return Boolean(rect && rect.top >= 0 && rect.bottom <= innerHeight);
      })(),
      menuItemOverlap: (() => {
        const boxes = [
          ...document.querySelectorAll(
            ".site-nav .site-nav__live, .site-nav .site-nav__link, .site-nav .site-nav__status, .site-nav .site-nav__setting, .site-nav .site-nav__cta",
          ),
        ].map((element) => element.getBoundingClientRect());
        return boxes.some((first, index) =>
          boxes.slice(index + 1).some(
            (second) =>
              first.left < second.right - 1 &&
              first.right > second.left + 1 &&
              first.top < second.bottom - 1 &&
              first.bottom > second.top + 1,
          ),
        );
      })(),
      menuItemOverflow: [
        ...document.querySelectorAll(
          ".site-nav .site-nav__live, .site-nav .site-nav__link, .site-nav .site-nav__status, .site-nav .site-nav__setting, .site-nav .site-nav__cta",
        ),
      ]
        .filter((element) => element.scrollWidth > element.clientWidth + 1)
        .map((element) => ({
          className: element.className,
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          text: element.textContent.trim().replace(/\s+/g, " ").slice(0, 80),
        })),
      themeOverlap: (() => {
        const boxes = [...document.querySelectorAll(".site-nav .theme-switcher button")].map(
          (button) => button.getBoundingClientRect(),
        );
        return boxes.some((first, index) =>
          boxes.slice(index + 1).some(
            (second) =>
              first.left < second.right &&
              first.right > second.left &&
              first.top < second.bottom &&
              first.bottom > second.top,
          ),
        );
      })(),
      projectPhase: document.body.dataset.projectPhase,
      calendarPhase: document.body.dataset.calendarPhase,
      calendarOpen:
        document.querySelector("[data-calendar-details]")?.open ?? false,
      calendarCurrentCount: document.querySelectorAll(
        '.calendar-program__row[aria-current="step"]',
      ).length,
      calendarCurrentVisible: (() => {
        const current = document.querySelector("[data-calendar-current]");
        if (!current || current.hidden) return false;
        const rect = current.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })(),
      phaseFixture: document.body.dataset.phaseFixture || null,
      scrollWidth: document.documentElement.scrollWidth,
      theme: document.documentElement.dataset.theme || "system",
      resolvedTheme: document.documentElement.classList.contains("theme-dark")
        ? "dark"
        : "light",
      partnerReferenceFit: (() => {
        const container = document.querySelector(".partner-proof--reference");
        if (!container) return null;
        const bounds = container.getBoundingClientRect();
        const link = container.querySelector(".partner-proof__link");
        if (!link || link.getAttribute("href") !== "#proof") return false;
        const box = link.getBoundingClientRect();
        return (
          box.left >= bounds.left - 1 &&
          box.right <= bounds.right + 1 &&
          box.top >= bounds.top - 1 &&
          box.bottom <= bounds.bottom + 1
        );
      })(),
      diaryIntroOverflow: [...document.querySelectorAll(".diary-live h2, .diary-live p, .diary-live a")]
        .filter((element) => element.scrollWidth > element.clientWidth + 1)
        .map((element) => element.textContent.trim().replace(/\s+/g, " ")),
      diaryStories: (() => {
        const tabs = [...document.querySelectorAll("[data-diary-story-link]")];
        const panels = [...document.querySelectorAll("[data-diary-story-panel]")];
        return {
          contained: tabs.filter((tab) => tab.getClientRects().length).every((tab) => {
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
          selected: tabs.filter(
            (tab) => tab.hidden,
          ).length,
          visiblePanels: panels.filter((panel) => !panel.hidden).length,
        };
      })(),
      diaryMedia: (() => {
        const gallery = document.querySelector(
          ".diary-story:not([hidden]) .diary__gallery--multiple",
        );
        if (!gallery) return null;
        const tabs = [
          ...gallery.querySelectorAll("[data-diary-media-tab]"),
        ];
        const panels = [
          ...gallery.querySelectorAll("[data-diary-media-panel]"),
        ];
        const selected = tabs.findIndex(
          (tab) => tab.getAttribute("aria-selected") === "true",
        );
        const stage = gallery
          .querySelector(".diary__media")
          .getBoundingClientRect();
        return {
          tabs: tabs.length,
          panels: panels.length,
          selected,
          visiblePanels: panels
            .map((panel, index) => (!panel.hidden ? index : -1))
            .filter((index) => index >= 0),
          activeKind: panels[selected]?.classList.contains(
            "diary-media__panel--video",
          )
            ? "video"
            : "image",
          position: gallery
            .querySelector("[data-diary-media-position-current]")
            ?.textContent.trim(),
          stageRatio: stage.width / stage.height,
        };
      })(),
    };
  });
}
