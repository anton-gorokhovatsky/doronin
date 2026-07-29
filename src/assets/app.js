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

for (const button of document.querySelectorAll("[data-theme-option]")) {
  button.addEventListener("click", () => {
    applyTheme(button.dataset.themeOption);
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

const distanceStory = document.querySelector("[data-distance-story]");

if (distanceStory) {
  const distanceCards = [
    ...distanceStory.querySelectorAll("[data-distance-card]"),
  ];
  const distanceFrames = [
    ...distanceStory.querySelectorAll("[data-distance-frame]"),
  ];

  function setActiveDistance(index) {
    for (const [cardIndex, card] of distanceCards.entries()) {
      card.classList.toggle("is-active", cardIndex === index);
    }

    for (const [frameIndex, frame] of distanceFrames.entries()) {
      frame.classList.toggle("is-active", frameIndex === index);
    }
  }

  if ("IntersectionObserver" in window) {
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

    for (const card of distanceCards) {
      distanceObserver.observe(card);
    }
  }
}

const eventStatus = document.querySelector("[data-event-status]");

if (eventStatus) {
  const start = new Date(eventStatus.dataset.start);
  const end = new Date(eventStatus.dataset.end);
  const now = new Date();
  const value = eventStatus.querySelector("[data-status-value]");
  const label = eventStatus.querySelector("[data-status-label]");
  const day = 86_400_000;

  if (now < start) {
    const days = Math.max(1, Math.ceil((start - now) / day));
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
    value.textContent = String(projectDay).padStart(2, "0");
    label.textContent = eventStatus.dataset.active;
  } else {
    value.textContent = "31/31";
    label.textContent = eventStatus.dataset.finished;
  }
}

const desktopNavigation = window.matchMedia("(min-width: 961px)");

function syncNavigationMode() {
  for (const navigation of document.querySelectorAll(".nav-shell")) {
    navigation.toggleAttribute("open", desktopNavigation.matches);
  }
}

syncNavigationMode();
desktopNavigation.addEventListener?.("change", syncNavigationMode);

for (const navigation of document.querySelectorAll(".nav-shell")) {
  navigation.addEventListener("click", (event) => {
    if (event.target.closest("a") && !desktopNavigation.matches) {
      navigation.removeAttribute("open");
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !desktopNavigation.matches) {
    for (const navigation of document.querySelectorAll(".nav-shell[open]")) {
      navigation.removeAttribute("open");
      navigation.querySelector("summary")?.focus();
    }
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
