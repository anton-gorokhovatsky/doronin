const requestedTheme = new URLSearchParams(window.location.search).get("theme");
const supportedThemes = new Set(["system", "light", "dark"]);
const storedTheme = document.documentElement.dataset.theme;
let activeTheme = supportedThemes.has(requestedTheme)
  ? requestedTheme
  : supportedThemes.has(storedTheme)
    ? storedTheme
    : "system";

function applyTheme(theme, persist = true) {
  activeTheme = supportedThemes.has(theme) ? theme : "system";

  if (activeTheme === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = activeTheme;
  }

  for (const button of document.querySelectorAll("[data-theme-option]")) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.themeOption === activeTheme),
    );
  }

  const favicon = document.querySelector("[data-favicon]");

  if (favicon) {
    favicon.href =
      activeTheme === "light"
        ? favicon.dataset.lightHref
        : activeTheme === "dark"
          ? favicon.dataset.darkHref
          : favicon.dataset.systemHref;
  }

  for (const meta of document.querySelectorAll("[data-theme-color]")) {
    const colorTheme = meta.dataset.themeColor;
    meta.media =
      activeTheme === "system"
        ? `(prefers-color-scheme: ${colorTheme})`
        : colorTheme === activeTheme
          ? "all"
          : "not all";
  }

  if (persist) {
    try {
      if (activeTheme === "system") {
        localStorage.removeItem("theme");
      } else {
        localStorage.setItem("theme", activeTheme);
      }
    } catch {}
  }
}

applyTheme(activeTheme, false);

function syncOpticalStart(element) {
  if (!element) {
    return;
  }

  const leading = element.textContent.trim().charAt(0);

  if (leading) {
    element.dataset.opticalLeading = leading;
  } else {
    delete element.dataset.opticalLeading;
  }
}

for (const element of document.querySelectorAll("[data-optical-start]")) {
  syncOpticalStart(element);
}

for (const button of document.querySelectorAll("[data-theme-option]")) {
  button.addEventListener("click", () => {
    applyTheme(button.dataset.themeOption);
    button.closest(".header-theme")?.removeAttribute("open");
  });
}

const heroVideo = document.querySelector("[data-hero-video]");
const videoToggle = document.querySelector("[data-video-toggle]");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

if (heroVideo && videoToggle) {
  const videoToggleLabel = videoToggle.querySelector("[data-video-toggle-label]");
  let userPausedVideo = false;

  function syncVideoToggle() {
    const isPlaying = !heroVideo.paused && !heroVideo.ended;
    const label = isPlaying
      ? videoToggle.dataset.pauseLabel
      : videoToggle.dataset.playLabel;

    videoToggle.setAttribute("aria-pressed", String(isPlaying));
    videoToggle.setAttribute("aria-label", label);

    if (videoToggleLabel) {
      videoToggleLabel.textContent = label;
    }
  }

  async function playHeroVideo() {
    try {
      await heroVideo.play();
    } catch {
      syncVideoToggle();
    }
  }

  videoToggle.addEventListener("click", () => {
    if (heroVideo.paused) {
      userPausedVideo = false;
      playHeroVideo();
    } else {
      userPausedVideo = true;
      heroVideo.pause();
    }
  });

  heroVideo.addEventListener("play", syncVideoToggle);
  heroVideo.addEventListener("pause", syncVideoToggle);
  heroVideo.addEventListener("ended", syncVideoToggle);

  reducedMotion.addEventListener?.("change", (event) => {
    if (event.matches) {
      heroVideo.pause();
    } else if (!userPausedVideo) {
      playHeroVideo();
    }
  });

  syncVideoToggle();

  if (!reducedMotion.matches) {
    playHeroVideo();
  }
}

const storyVideo = document.querySelector("[data-story-video]");
const storyVideoToggle = document.querySelector("[data-story-video-toggle]");

if (storyVideo && storyVideoToggle) {
  const storyVideoToggleLabel = storyVideoToggle.querySelector(
    "[data-story-video-toggle-label]",
  );
  let storyVideoVisible = false;
  let userPausedStoryVideo = false;
  let userStartedStoryVideo = false;

  function syncStoryVideoToggle() {
    const isPlaying = !storyVideo.paused && !storyVideo.ended;
    const label = isPlaying
      ? storyVideoToggle.dataset.pauseLabel
      : storyVideoToggle.dataset.playLabel;

    storyVideoToggle.setAttribute("aria-pressed", String(isPlaying));
    storyVideoToggle.setAttribute("aria-label", label);

    if (storyVideoToggleLabel) {
      storyVideoToggleLabel.textContent = label;
    }
  }

  function syncStoryVideoPlayback() {
    const shouldPlay =
      storyVideoVisible &&
      !userPausedStoryVideo &&
      (!reducedMotion.matches || userStartedStoryVideo);

    if (shouldPlay) {
      storyVideo.play().catch(syncStoryVideoToggle);
    } else {
      storyVideo.pause();
    }
  }

  storyVideoToggle.addEventListener("click", () => {
    if (storyVideo.paused) {
      userPausedStoryVideo = false;
      userStartedStoryVideo = true;
      syncStoryVideoPlayback();
    } else {
      userPausedStoryVideo = true;
      storyVideo.pause();
    }
  });

  storyVideo.addEventListener("play", syncStoryVideoToggle);
  storyVideo.addEventListener("pause", syncStoryVideoToggle);
  storyVideo.addEventListener("ended", syncStoryVideoToggle);

  if ("IntersectionObserver" in window) {
    const storyVideoObserver = new IntersectionObserver(
      ([entry]) => {
        storyVideoVisible = entry.isIntersecting;
        syncStoryVideoPlayback();
      },
      { threshold: 0.28 },
    );

    storyVideoObserver.observe(storyVideo);
  } else {
    storyVideoVisible = true;
    syncStoryVideoPlayback();
  }

  reducedMotion.addEventListener?.("change", syncStoryVideoPlayback);
  syncStoryVideoToggle();
}

const distanceStory = document.querySelector("[data-distance-story]");

if (distanceStory) {
  const distanceCards = [
    ...distanceStory.querySelectorAll("[data-distance-card]"),
  ];
  const distanceFrames = [
    ...distanceStory.querySelectorAll("[data-distance-frame]"),
  ];
  const distanceVideos = [
    ...distanceStory.querySelectorAll("[data-distance-video]"),
  ];
  const distanceLiveCounter = distanceStory.querySelector(
    ".distance-story__counter",
  );
  const distanceLiveIndex = distanceStory.querySelector(
    "[data-distance-live-index]",
  );
  const distanceLiveLabel = distanceStory.querySelector(
    "[data-distance-live-label]",
  );
  const distanceLiveValue = distanceStory.querySelector(
    "[data-distance-live-value]",
  );
  const distanceLiveUnit = distanceStory.querySelector(
    "[data-distance-live-unit]",
  );
  const distanceSequence = [
    ...distanceStory.querySelectorAll("[data-distance-sequence]"),
  ];
  const distanceDesktop = window.matchMedia("(min-width: 641px)");
  let activeDistanceIndex = 0;
  let distanceStoryVisible = false;

  function syncDistanceVideo() {
    for (const [videoIndex, video] of distanceVideos.entries()) {
      const shouldPlay =
        videoIndex === activeDistanceIndex &&
        distanceStoryVisible &&
        distanceDesktop.matches &&
        !reducedMotion.matches;

      if (shouldPlay) {
        if (video.paused && !video.ended) {
          video.play().catch(() => {});
        }
      } else {
        video.pause();

        if (video.readyState > 0) {
          video.currentTime = 0;
        }
      }
    }
  }

  function setActiveDistance(index) {
    const activeCard = distanceCards[index];

    if (!activeCard) {
      return;
    }

    activeDistanceIndex = index;

    for (const [cardIndex, card] of distanceCards.entries()) {
      card.classList.toggle("is-active", cardIndex === index);
    }

    for (const [frameIndex, frame] of distanceFrames.entries()) {
      frame.classList.toggle("is-active", frameIndex === index);
    }

    if (distanceLiveIndex) {
      distanceLiveIndex.textContent = activeCard.dataset.distanceIndex;
    }

    if (distanceLiveLabel) {
      distanceLiveLabel.textContent = activeCard.dataset.distanceLabel;
    }

    if (distanceLiveValue) {
      distanceLiveValue.textContent = activeCard.dataset.distanceValue;
      syncOpticalStart(distanceLiveValue);
    }

    if (distanceLiveUnit) {
      distanceLiveUnit.textContent = activeCard.dataset.distanceUnit;
    }

    for (const [stepIndex, step] of distanceSequence.entries()) {
      step.classList.toggle("is-active", stepIndex === index);
      step.classList.toggle("is-complete", stepIndex < index);
    }

    if (distanceLiveCounter) {
      distanceLiveCounter.classList.remove("is-changing");
      requestAnimationFrame(() => {
        distanceLiveCounter.classList.add("is-changing");
      });
    }

    syncDistanceVideo();
  }

  if ("IntersectionObserver" in window) {
    const distanceVisibilityObserver = new IntersectionObserver(
      ([entry]) => {
        distanceStoryVisible = entry.isIntersecting;
        syncDistanceVideo();
      },
      { threshold: 0.08 },
    );
    const distanceObserver = new IntersectionObserver(
      (entries) => {
        const activeEntry = entries.find((entry) => entry.isIntersecting);

        if (activeEntry) {
          setActiveDistance(Number(activeEntry.target.dataset.distanceCard));
        }
      },
      {
        rootMargin: "-38% 0px -38% 0px",
        threshold: 0,
      },
    );

    distanceVisibilityObserver.observe(distanceStory);

    for (const card of distanceCards) {
      distanceObserver.observe(card);
    }
  }

  reducedMotion.addEventListener?.("change", syncDistanceVideo);
  distanceDesktop.addEventListener?.("change", syncDistanceVideo);
}

const distanceTotal = document.querySelector("[data-distance-total]");

if (distanceTotal) {
  const counter = distanceTotal.querySelector("[data-distance-counter]");
  const steps = [...distanceTotal.querySelectorAll("[data-distance-step]")];
  const finalValue = Number(counter?.dataset.distanceFinal);
  const formatter = new Intl.NumberFormat(
    document.documentElement.lang === "ru" ? "ru-RU" : "en-US",
    { maximumFractionDigits: 0 },
  );
  let animationRun = 0;
  let hasStarted = false;

  function renderDistanceTotal(value) {
    if (counter) {
      counter.textContent = formatter.format(value);
      syncOpticalStart(counter);
    }
  }

  function finishDistanceTotal() {
    animationRun += 1;
    renderDistanceTotal(finalValue);
    distanceTotal.classList.remove("is-counting");
    distanceTotal.classList.add("is-complete");

    for (const step of steps) {
      step.classList.remove("is-active");
      step.classList.add("is-complete");
    }
  }

  function countDistance(from, to, duration, run) {
    return new Promise((resolve) => {
      const startedAt = performance.now();

      function update(now) {
        if (run !== animationRun) {
          resolve(false);
          return;
        }

        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - (1 - progress) ** 4;
        renderDistanceTotal(Math.round(from + (to - from) * eased));

        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          resolve(true);
        }
      }

      requestAnimationFrame(update);
    });
  }

  async function playDistanceTotal() {
    if (hasStarted) {
      return;
    }

    hasStarted = true;

    if (reducedMotion.matches) {
      finishDistanceTotal();
      return;
    }

    const run = ++animationRun;
    let accumulated = 0;
    distanceTotal.classList.add("is-counting");

    for (const step of steps) {
      const addition = Number(step.dataset.distanceStep);
      const nextValue = accumulated + addition;
      const duration = addition > 5_000 ? 1_000 : addition > 500 ? 720 : 520;

      step.classList.add("is-active");

      if (!(await countDistance(accumulated, nextValue, duration, run))) {
        return;
      }

      step.classList.remove("is-active");
      step.classList.add("is-complete");
      accumulated = nextValue;
    }

    distanceTotal.classList.remove("is-counting");
    distanceTotal.classList.add("is-complete");
  }

  if (
    counter &&
    steps.length &&
    Number.isFinite(finalValue) &&
    !reducedMotion.matches
  ) {
    distanceTotal.classList.add("is-ready");
    renderDistanceTotal(0);

    if ("IntersectionObserver" in window) {
      const totalObserver = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            totalObserver.disconnect();
            playDistanceTotal();
          }
        },
        { threshold: 0.35 },
      );

      totalObserver.observe(distanceTotal);
    } else {
      playDistanceTotal();
    }
  }

  reducedMotion.addEventListener?.("change", (event) => {
    if (event.matches) {
      finishDistanceTotal();
    }
  });
}

const eventStatus = document.querySelector("[data-event-status]");

if (eventStatus) {
  const start = new Date(eventStatus.dataset.start);
  const end = new Date(eventStatus.dataset.end);
  const now = new Date();
  const value = eventStatus.querySelector("[data-status-value]");
  const label = eventStatus.querySelector("[data-status-label]");
  const update = eventStatus.querySelector("[data-status-update]");
  const rail = [
    ...eventStatus.querySelectorAll("[data-status-day]"),
  ];
  const day = 86_400_000;
  let elapsedDays = 0;
  let showLiveUpdate = false;

  if (now < start) {
    const days = Math.max(1, Math.ceil((start - now) / day));
    const countdownStart = new Date(start);
    countdownStart.setFullYear(countdownStart.getFullYear() - 1);
    const countdownProgress = Math.max(
      0,
      Math.min(1, (now - countdownStart) / (start - countdownStart)),
    );
    elapsedDays = Math.floor(countdownProgress * rail.length);
    let form = eventStatus.dataset.beforeMany;

    if (eventStatus.dataset.lang === "ru") {
      const mod10 = days % 10;
      const mod100 = days % 100;

      if (mod10 === 1 && mod100 !== 11) {
        form = eventStatus.dataset.beforeOne;
      } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
        form = eventStatus.dataset.beforeFew;
      }
    } else if (days === 1) {
      form = eventStatus.dataset.beforeOne;
    }

    value.textContent = String(days);
    label.textContent = form;
  } else if (now < end) {
    const projectDay = Math.min(31, Math.floor((now - start) / day) + 1);
    elapsedDays = projectDay;
    showLiveUpdate = true;
    value.textContent = String(projectDay).padStart(2, "0");
    label.textContent = eventStatus.dataset.active;
  } else {
    elapsedDays = 31;
    showLiveUpdate = true;
    value.textContent = "31/31";
    label.textContent = eventStatus.dataset.finished;
  }

  rail.forEach((segment, index) => {
    segment.classList.toggle("is-elapsed", index < elapsedDays);
    segment.classList.toggle(
      "is-current",
      elapsedDays > 0 && index === elapsedDays - 1,
    );
  });

  if (update && showLiveUpdate) {
    if (eventStatus.dataset.liveVerified === "true") {
      const locale = eventStatus.dataset.lang === "ru" ? "ru-RU" : "en-US";
      const distance = new Intl.NumberFormat(locale, {
        maximumFractionDigits: 2,
      }).format(Number(eventStatus.dataset.liveDistance));
      const updatedAt = new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(eventStatus.dataset.liveUpdated));
      const parts = [
        `${distance}\u00a0${eventStatus.dataset.liveUnit}`,
        eventStatus.dataset.liveDiscipline,
        updatedAt,
        eventStatus.dataset.liveNote,
      ].filter(Boolean);

      update.textContent = `${eventStatus.dataset.latestUpdate}: ${parts.join(" · ")}`;
    } else {
      update.textContent = eventStatus.dataset.statusPending;
    }

    update.hidden = false;
  }

  syncOpticalStart(value);
}

const desktopNavigation = window.matchMedia("(min-width: 961px)");

function syncNavigationMode() {
  const header = document.querySelector(".site-header");
  const isCondensed = header?.classList.contains("is-condensed");

  for (const navigation of document.querySelectorAll(".nav-shell")) {
    navigation.toggleAttribute(
      "open",
      desktopNavigation.matches && !isCondensed,
    );
  }
}

syncNavigationMode();
desktopNavigation.addEventListener?.("change", syncNavigationMode);

for (const navigation of document.querySelectorAll(".nav-shell")) {
  navigation.addEventListener("click", (event) => {
    const isCondensed = document
      .querySelector(".site-header")
      ?.classList.contains("is-condensed");

    if (
      event.target.closest("a") &&
      (!desktopNavigation.matches || isCondensed)
    ) {
      navigation.removeAttribute("open");
    }
  });
}

document.addEventListener("keydown", (event) => {
  const isCondensed = document
    .querySelector(".site-header")
    ?.classList.contains("is-condensed");

  if (event.key === "Escape" && (!desktopNavigation.matches || isCondensed)) {
    for (const navigation of document.querySelectorAll(".nav-shell[open]")) {
      navigation.removeAttribute("open");
      navigation.querySelector("summary")?.focus();
    }
  }

  if (event.key === "Escape") {
    document.querySelector(".header-theme[open]")?.removeAttribute("open");
  }
});

for (const languageSwitch of document.querySelectorAll("[data-language-switch]")) {
  languageSwitch.addEventListener("click", () => {
    if (!window.location.hash) {
      return;
    }

    const target = new URL(languageSwitch.href);
    target.hash = window.location.hash;
    languageSwitch.href = target.href;
  });
}

const siteHeader = document.querySelector(".site-header");
const heroSection = document.querySelector(".hero");

if (siteHeader && heroSection && "IntersectionObserver" in window) {
  const heroHeaderObserver = new IntersectionObserver(
    ([entry]) => {
      siteHeader.classList.toggle("is-over-hero", entry.isIntersecting);
    },
    { rootMargin: "0px 0px -84% 0px" },
  );

  heroHeaderObserver.observe(heroSection);
}

const headerNavigationLinks = [
  ...document.querySelectorAll(".site-nav__primary .site-nav__link"),
];
const headerNavigationTargets = headerNavigationLinks
  .map((link) => {
    const target = document.querySelector(link.hash);
    return target ? { link, target } : null;
  })
  .filter(Boolean);

if (siteHeader && headerNavigationTargets.length) {
  let headerNavigationFrame = 0;
  let headerWasCondensed = false;

  function syncHeaderNavigation() {
    headerNavigationFrame = 0;

    const scrollRange =
      document.documentElement.scrollHeight - window.innerHeight;
    const progress =
      scrollRange > 0 ? Math.max(0.025, window.scrollY / scrollRange) : 0.025;
    const readingLine = window.scrollY + window.innerHeight * 0.38;
    let activeItem = headerNavigationTargets[0];

    for (const item of headerNavigationTargets) {
      if (item.target.offsetTop <= readingLine) {
        activeItem = item;
      }
    }

    const headerIsCondensed =
      desktopNavigation.matches &&
      window.scrollY > Math.min(220, window.innerHeight * 0.2);

    siteHeader.style.setProperty("--header-progress", String(progress));
    siteHeader.classList.toggle("is-condensed", headerIsCondensed);

    if (headerIsCondensed !== headerWasCondensed) {
      for (const navigation of document.querySelectorAll(".nav-shell")) {
        navigation.toggleAttribute(
          "open",
          desktopNavigation.matches && !headerIsCondensed,
        );
      }

      headerWasCondensed = headerIsCondensed;
    }

    for (const item of headerNavigationTargets) {
      if (item === activeItem) {
        item.link.setAttribute("aria-current", "location");
      } else {
        item.link.removeAttribute("aria-current");
      }
    }

    const currentChapter = siteHeader.querySelector("[data-current-chapter]");

    if (currentChapter) {
      currentChapter.textContent = activeItem.link.textContent.trim();
    }
  }

  function requestHeaderNavigationSync() {
    if (!headerNavigationFrame) {
      headerNavigationFrame = requestAnimationFrame(syncHeaderNavigation);
    }
  }

  syncHeaderNavigation();
  window.addEventListener("scroll", requestHeaderNavigationSync, {
    passive: true,
  });
  window.addEventListener("resize", requestHeaderNavigationSync);
}
