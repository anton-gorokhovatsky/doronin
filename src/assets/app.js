const requestParameters = new URLSearchParams(window.location.search);
const requestedTheme = requestParameters.get("theme");
const requestedPhase = requestParameters.get("phase");
const requestedCalendar = requestParameters.get("calendar");
const requestedTextScale = requestParameters.get("text");
const phaseFixtureDates = {
  before: "2026-07-31T12:00:00+03:00",
  near: "2026-11-15T12:00:00+03:00",
  active: "2026-12-15T12:00:00+03:00",
  finished: "2027-01-02T12:00:00+03:00",
};
const localFixtureHost = /^(?:127(?:\.\d{1,3}){3}|localhost|\[::1\])$/i.test(
  window.location.hostname,
);
const phaseFixture =
  localFixtureHost && Object.hasOwn(phaseFixtureDates, requestedPhase)
    ? requestedPhase
    : null;
const calendarFixture =
  localFixtureHost && ["open", "confirmed"].includes(requestedCalendar)
    ? requestedCalendar
    : null;
if (localFixtureHost && requestedTextScale === "200") {
  document.documentElement.dataset.textFixture = "200";
  document.documentElement.classList.add("text-enlarged");
}

function syncTextEnlargement() {
  const rootFontSize = Number.parseFloat(
    getComputedStyle(document.documentElement).fontSize,
  );
  document.documentElement.classList.toggle(
    "text-enlarged",
    document.documentElement.dataset.textFixture === "200" ||
      (Number.isFinite(rootFontSize) && rootFontSize >= 24),
  );
}

syncTextEnlargement();
window.addEventListener("resize", syncTextEnlargement, { passive: true });

const supportedThemes = new Set(["system", "light", "dark"]);
const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
const storedTheme = document.documentElement.dataset.theme;
let activeTheme = supportedThemes.has(requestedTheme)
  ? requestedTheme
  : supportedThemes.has(storedTheme)
    ? storedTheme
    : "system";

function syncResolvedTheme() {
  const resolvedTheme =
    activeTheme === "system"
      ? systemThemeQuery.matches
        ? "dark"
        : "light"
      : activeTheme;

  document.documentElement.classList.toggle(
    "theme-dark",
    resolvedTheme === "dark",
  );
  document.documentElement.classList.toggle(
    "theme-light",
    resolvedTheme === "light",
  );
}

function applyTheme(theme, persist = true) {
  activeTheme = supportedThemes.has(theme) ? theme : "system";

  if (activeTheme === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = activeTheme;
  }

  syncResolvedTheme();

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

systemThemeQuery.addEventListener("change", () => {
  if (activeTheme === "system") {
    syncResolvedTheme();
  }
});

const supportedMotionPreferences = new Set(["system", "reduced"]);
const systemReducedMotionQuery = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
);
let storedMotionPreference = "system";

try {
  storedMotionPreference = localStorage.getItem("motion") || "system";
} catch {}

let activeMotionPreference = supportedMotionPreferences.has(
  storedMotionPreference,
)
  ? storedMotionPreference
  : "system";
const motionChangeListeners = new Set();
const reducedMotion = {
  get matches() {
    return (
      activeMotionPreference === "reduced" ||
      (activeMotionPreference === "system" && systemReducedMotionQuery.matches)
    );
  },
  addEventListener(type, listener) {
    if (type === "change") motionChangeListeners.add(listener);
  },
  removeEventListener(type, listener) {
    if (type === "change") motionChangeListeners.delete(listener);
  },
};

function emitMotionPreferenceChange() {
  const event = { matches: reducedMotion.matches };

  for (const listener of motionChangeListeners) {
    listener(event);
  }
}

function syncMotionPreference() {
  document.documentElement.classList.toggle(
    "motion-reduced",
    reducedMotion.matches,
  );

  for (const button of document.querySelectorAll("[data-motion-option]")) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.motionOption === activeMotionPreference),
    );
  }
}

function applyMotionPreference(preference, persist = true) {
  const wasReduced = reducedMotion.matches;
  activeMotionPreference = supportedMotionPreferences.has(preference)
    ? preference
    : "system";
  syncMotionPreference();

  if (persist) {
    try {
      if (activeMotionPreference === "system") {
        localStorage.removeItem("motion");
      } else {
        localStorage.setItem("motion", activeMotionPreference);
      }
    } catch {}
  }

  if (wasReduced !== reducedMotion.matches) {
    emitMotionPreferenceChange();
  }
}

applyMotionPreference(activeMotionPreference, false);

systemReducedMotionQuery.addEventListener?.("change", () => {
  if (activeMotionPreference === "system") {
    syncMotionPreference();
    emitMotionPreferenceChange();
  }
});

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

const analyticsRegistryNode = document.querySelector(
  "#analytics-goal-registry",
);
let analyticsRegistry = { counterId: 111159425, goals: [] };

try {
  analyticsRegistry = JSON.parse(analyticsRegistryNode?.textContent || "{}");
} catch {}

const analyticsGoals = new Map(
  Array.isArray(analyticsRegistry.goals)
    ? analyticsRegistry.goals.map((goal) => [goal.id, goal])
    : [],
);
const analyticsSafeValue = /^[a-z0-9_-]{1,48}$/i;
let analyticsEnabled = true;
let analyticsInitialized = false;

try {
  analyticsEnabled = localStorage.getItem("analytics") !== "off";
} catch {}

function syncAnalyticsPreference() {
  for (const button of document.querySelectorAll("[data-analytics-option]")) {
    button.setAttribute(
      "aria-pressed",
      String(
        button.dataset.analyticsOption === (analyticsEnabled ? "on" : "off"),
      ),
    );
  }
}

function initializeAnalytics() {
  if (!analyticsEnabled || analyticsInitialized) {
    return;
  }

  if (typeof window.ym !== "function") {
    window.ym = function (...args) {
      (window.ym.a ||= []).push(args);
    };
    window.ym.l = Date.now();
  }

  if (!document.querySelector("[data-analytics-loader]")) {
    const loader = document.createElement("script");
    loader.async = true;
    loader.dataset.analyticsLoader = "";
    loader.src = `https://mc.yandex.ru/metrika/tag.js?id=${analyticsRegistry.counterId}`;
    document.head.append(loader);
  }

  window.ym(analyticsRegistry.counterId, "init", {
    ssr: true,
    webvisor: true,
    clickmap: true,
    ecommerce: "dataLayer",
    referrer: document.referrer,
    url: window.location.href,
    accurateTrackBounce: true,
    trackLinks: true,
  });
  analyticsInitialized = true;
}

function applyAnalyticsPreference(preference, persist = true) {
  const shouldEnable = preference !== "off";

  if (!shouldEnable && analyticsInitialized && typeof window.ym === "function") {
    window.ym(analyticsRegistry.counterId, "destruct");
    analyticsInitialized = false;
  }

  analyticsEnabled = shouldEnable;

  if (persist) {
    try {
      if (analyticsEnabled) {
        localStorage.removeItem("analytics");
      } else {
        localStorage.setItem("analytics", "off");
      }
    } catch {}
  }

  syncAnalyticsPreference();

  if (analyticsEnabled) {
    initializeAnalytics();
  }
}

applyAnalyticsPreference(analyticsEnabled ? "on" : "off", false);

function reachGoal(goal, params = {}) {
  const definition = analyticsGoals.get(goal);

  if (!analyticsEnabled || !definition || typeof window.ym !== "function") {
    return;
  }

  const safeParams = Object.fromEntries(
    (definition.params || [])
      .filter((key) => analyticsSafeValue.test(String(params[key] || "")))
      .map((key) => [key, String(params[key])]),
  );

  window.ym(
    analyticsRegistry.counterId,
    "reachGoal",
    goal,
    safeParams,
  );
}

for (const element of document.querySelectorAll("[data-optical-start]")) {
  syncOpticalStart(element);
}

for (const button of document.querySelectorAll("[data-theme-option]")) {
  button.addEventListener("click", () => {
    reachGoal("theme_change", { theme: button.dataset.themeOption });
    applyTheme(button.dataset.themeOption);
  });
}

for (const button of document.querySelectorAll("[data-motion-option]")) {
  button.addEventListener("click", () => {
    applyMotionPreference(button.dataset.motionOption);
  });
}

for (const button of document.querySelectorAll("[data-analytics-option]")) {
  button.addEventListener("click", () => {
    applyAnalyticsPreference(button.dataset.analyticsOption);
  });
}

const proofSources = document.querySelector(".proof-sources");

if (proofSources) {
  const proofSourcesSummary = proofSources.querySelector("summary");
  let proofSourcesRestoreFrame = 0;
  let proofSourcesPreviousOverflowAnchor = null;
  let proofSourcesPreviousScrollBehavior = null;

  function stopProofSourcesRestoration({ restoreOverflowAnchor = true } = {}) {
    if (proofSourcesRestoreFrame) {
      cancelAnimationFrame(proofSourcesRestoreFrame);
      proofSourcesRestoreFrame = 0;
    }

    if (proofSourcesPreviousScrollBehavior !== null) {
      document.documentElement.style.scrollBehavior =
        proofSourcesPreviousScrollBehavior;
      proofSourcesPreviousScrollBehavior = null;
    }

    if (
      restoreOverflowAnchor &&
      proofSourcesPreviousOverflowAnchor !== null
    ) {
      document.documentElement.style.overflowAnchor =
        proofSourcesPreviousOverflowAnchor;
      proofSourcesPreviousOverflowAnchor = null;
    }
  }

  proofSourcesSummary?.addEventListener("click", (event) => {
    event.preventDefault();
    if (!proofSources.open) {
      reachGoal("proof_open");
    }

    const anchorTop = proofSourcesSummary.getBoundingClientRect().top;
    const root = document.documentElement;
    const restoreUntil = performance.now() + 320;

    stopProofSourcesRestoration();
    proofSourcesPreviousScrollBehavior = root.style.scrollBehavior;
    proofSourcesPreviousOverflowAnchor = root.style.overflowAnchor;
    root.style.scrollBehavior = "auto";
    root.style.overflowAnchor = "none";
    proofSources.open = !proofSources.open;

    function restoreProofSourcesPosition() {
      proofSourcesRestoreFrame = 0;

      const offset = proofSourcesSummary.getBoundingClientRect().top - anchorTop;

      if (Math.abs(offset) > 0.5) {
        window.scrollBy(0, offset);
      }

      if (performance.now() < restoreUntil) {
        proofSourcesRestoreFrame = requestAnimationFrame(
          restoreProofSourcesPosition,
        );
      } else {
        stopProofSourcesRestoration({
          restoreOverflowAnchor: !proofSources.open,
        });
      }
    }

    restoreProofSourcesPosition();
  });
}

const heroVideo = document.querySelector("[data-hero-video]");
const videoToggle = document.querySelector("[data-video-toggle]");

if (heroVideo && videoToggle) {
  const videoToggleLabel = videoToggle.querySelector("[data-video-toggle-label]");
  const heroVideoSources = Array.from(heroVideo.querySelectorAll("source"));
  const failedHeroVideoSources = new Set();
  let userPausedVideo = false;
  let heroVideoUnavailable = false;

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
    if (heroVideoUnavailable || document.visibilityState !== "visible") {
      return;
    }

    try {
      await heroVideo.play();
    } catch {
      syncVideoToggle();
    }
  }

  function useHeroVideoFallback() {
    if (heroVideoUnavailable) {
      return;
    }

    heroVideoUnavailable = true;
    userPausedVideo = true;
    heroVideo.pause();
    videoToggle.hidden = true;
    syncVideoToggle();
  }

  function handleHeroVideoSourceError(event) {
    failedHeroVideoSources.add(event.currentTarget);

    const eligibleSources = heroVideoSources.filter(
      (source) => !source.media || window.matchMedia(source.media).matches,
    );

    if (
      eligibleSources.length &&
      eligibleSources.every((source) => failedHeroVideoSources.has(source))
    ) {
      useHeroVideoFallback();
    }
  }

  for (const source of heroVideoSources) {
    source.addEventListener("error", handleHeroVideoSourceError);
  }

  videoToggle.addEventListener("click", () => {
    if (heroVideo.paused) {
      userPausedVideo = false;
      reachGoal("hero_video_resume");
      playHeroVideo();
    } else {
      userPausedVideo = true;
      reachGoal("hero_video_pause");
      heroVideo.pause();
    }
  });

  heroVideo.addEventListener("play", syncVideoToggle);
  heroVideo.addEventListener("pause", syncVideoToggle);
  heroVideo.addEventListener("ended", syncVideoToggle);
  heroVideo.addEventListener("error", useHeroVideoFallback);

  reducedMotion.addEventListener?.("change", (event) => {
    if (event.matches) {
      heroVideo.pause();
    } else if (!userPausedVideo) {
      playHeroVideo();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      heroVideo.pause();
    } else if (!reducedMotion.matches && !userPausedVideo) {
      playHeroVideo();
    }
  });

  syncVideoToggle();

  if (!reducedMotion.matches && !heroVideoUnavailable) {
    playHeroVideo();
  }
}

const presenceAudio = document.querySelector("[data-presence-audio]");
const presencePlayer = document.querySelector("[data-presence-player]");
const presenceSceneButtons = Array.from(
  document.querySelectorAll("[data-presence-scene]"),
);
const presenceContexts = Array.from(
  document.querySelectorAll("[data-presence-context]"),
);

if (presenceAudio && presencePlayer && presenceSceneButtons.length) {
  let activePresenceScene = Math.max(
    0,
    presenceSceneButtons.findIndex(
      (button) => button.getAttribute("aria-pressed") === "true",
    ),
  );
  let presenceProgressFrame = 0;
  let presenceContextFrame = 0;
  let presenceAudioContext;
  let presenceAnalyser;
  let presenceFrequencyData;
  let presenceStartTracked = false;

  function presenceWaveBars() {
    return Array.from(
      presenceSceneButtons[activePresenceScene]?.querySelectorAll(
        ".audio-story__wave i",
      ) || [],
    );
  }

  async function ensurePresenceAnalyser() {
    if (!presenceAudioContext) {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) {
        return;
      }

      try {
        presenceAudioContext = new AudioContextClass();
        const source =
          presenceAudioContext.createMediaElementSource(presenceAudio);
        presenceAnalyser = presenceAudioContext.createAnalyser();
        presenceAnalyser.fftSize = 64;
        presenceAnalyser.smoothingTimeConstant = 0.72;
        presenceFrequencyData = new Uint8Array(
          presenceAnalyser.frequencyBinCount,
        );
        source.connect(presenceAnalyser);
        presenceAnalyser.connect(presenceAudioContext.destination);
      } catch {
        presenceAudioContext = undefined;
        presenceAnalyser = undefined;
        presenceFrequencyData = undefined;
        return;
      }
    }

    if (presenceAudioContext.state === "suspended") {
      await presenceAudioContext.resume();
    }
  }

  function updatePresenceWave() {
    const bars = presenceWaveBars();

    if (
      reducedMotion.matches ||
      !presenceAnalyser ||
      !presenceFrequencyData ||
      !bars.length
    ) {
      return;
    }

    presenceAnalyser.getByteFrequencyData(presenceFrequencyData);
    const bins = [1, 3, 6, 10, 14];

    for (const [index, bar] of bars.entries()) {
      const strength = presenceFrequencyData[bins[index]] / 255;
      bar.style.transform = `scaleY(${0.34 + strength * 1.18})`;
    }
  }

  function resetPresenceWave() {
    for (const bar of presencePlayer.querySelectorAll(
      ".audio-story__wave i",
    )) {
      bar.style.removeProperty("transform");
    }
  }

  function presenceDuration() {
    if (Number.isFinite(presenceAudio.duration) && presenceAudio.duration > 0) {
      return presenceAudio.duration;
    }

    return (
      Number(presenceSceneButtons[activePresenceScene]?.dataset.duration) || 0
    );
  }

  function syncPresenceStoryline(progress = 0) {
    for (const [index, button] of presenceSceneButtons.entries()) {
      const sceneProgress =
        index < activePresenceScene
          ? 1
          : index === activePresenceScene
            ? progress
            : 0;

      button.style.setProperty(
        "--scene-progress",
        `${Math.min(1, sceneProgress) * 100}%`,
      );
    }
  }

  function syncPresenceContext(animate = false) {
    presencePlayer.style.setProperty(
      "--active-scene-index",
      String(activePresenceScene),
    );
    window.cancelAnimationFrame(presenceContextFrame);

    for (const [index, context] of presenceContexts.entries()) {
      const isActive = index === activePresenceScene;
      context.hidden = !isActive;
      context.classList.remove("is-context-entering");

      if (isActive && animate && !reducedMotion.matches) {
        presenceContextFrame = window.requestAnimationFrame(() => {
          context.classList.add("is-context-entering");
        });
      }
    }
  }

  function updatePresenceProgress() {
    const duration = presenceDuration();
    const isPlaying = !presenceAudio.paused && !presenceAudio.ended;
    const progress = duration
      ? Math.min(1, presenceAudio.currentTime / duration)
      : 0;

    syncPresenceStoryline(progress);

    if (isPlaying) {
      updatePresenceWave();
      presenceProgressFrame = window.requestAnimationFrame(
        updatePresenceProgress,
      );
    }
  }

  function syncPresenceControls() {
    const isPlaying = !presenceAudio.paused && !presenceAudio.ended;

    for (const [index, button] of presenceSceneButtons.entries()) {
      const isActive = index === activePresenceScene;
      const label =
        isActive && isPlaying
          ? button.dataset.pauseLabel
          : button.dataset.playLabel;
      const title = button.dataset.sceneTitle || "";

      button.setAttribute("aria-pressed", String(isActive));
      button.dataset.playing = String(isActive && isPlaying);
      button.setAttribute("aria-label", title ? `${label}: ${title}` : label);
    }

    window.cancelAnimationFrame(presenceProgressFrame);
    if (!isPlaying) {
      resetPresenceWave();
    }
    updatePresenceProgress();
  }

  function trackPresenceStart() {
    if (presenceStartTracked) {
      return;
    }

    presenceStartTracked = true;
    reachGoal("presence_audio_start");
  }

  async function playPresenceScene() {
    try {
      await ensurePresenceAnalyser();
      await presenceAudio.play();
      trackPresenceStart();
    } catch {
      syncPresenceControls();
    }
  }

  async function selectPresenceScene(index, shouldPlay = true) {
    const nextButton = presenceSceneButtons[index];

    if (!nextButton) {
      return;
    }

    activePresenceScene = index;
    syncPresenceContext(true);
    const nextSource = nextButton.dataset.audioSrc;

    if (nextSource && presenceAudio.getAttribute("src") !== nextSource) {
      presenceAudio.setAttribute("src", nextSource);
      presenceAudio.load();
    } else {
      presenceAudio.currentTime = 0;
    }

    resetPresenceWave();
    syncPresenceControls();

    if (shouldPlay) {
      await playPresenceScene();
    }
  }

  for (const [index, button] of presenceSceneButtons.entries()) {
    button.addEventListener("click", async () => {
      if (index !== activePresenceScene) {
        await selectPresenceScene(index);
        return;
      }

      if (!presenceAudio.paused) {
        presenceAudio.pause();
        return;
      }

      if (
        presenceAudio.ended ||
        (Number.isFinite(presenceAudio.duration) &&
          presenceAudio.currentTime > presenceAudio.duration - 0.3)
      ) {
        presenceAudio.currentTime = 0;
      }

      await playPresenceScene();
    });
  }

  presenceAudio.addEventListener("play", syncPresenceControls);
  presenceAudio.addEventListener("pause", syncPresenceControls);
  presenceAudio.addEventListener("ended", () => {
    resetPresenceWave();
    syncPresenceControls();
  });
  presenceAudio.addEventListener("loadedmetadata", syncPresenceControls);
  presenceAudio.addEventListener("error", syncPresenceControls);
  reducedMotion.addEventListener("change", resetPresenceWave);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      presenceAudio.pause();
    }
  });
  syncPresenceContext();
  syncPresenceControls();
}

const heroPeaks = document.querySelector(".hero-peaks");

if (heroPeaks && !reducedMotion.matches) {
  if ("IntersectionObserver" in window) {
    const heroPeaksObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          entry.target.classList.add("is-peaks-entering");
          heroPeaksObserver.unobserve(entry.target);
        }
      },
      { threshold: 0.25 },
    );

    heroPeaksObserver.observe(heroPeaks);
  } else {
    heroPeaks.classList.add("is-peaks-entering");
  }
}

const sectionLabels = [...document.querySelectorAll(".section-label")];

if (sectionLabels.length && !reducedMotion.matches) {
  if ("IntersectionObserver" in window) {
    const sectionLabelObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          entry.target.classList.add("is-rule-entering");
          sectionLabelObserver.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -10%", threshold: 0.55 },
    );

    for (const sectionLabel of sectionLabels) {
      sectionLabelObserver.observe(sectionLabel);
    }
  }
}

const velocityCuts = [...document.querySelectorAll(".velocity-cut")];

if (velocityCuts.length && !reducedMotion.matches) {
  if ("IntersectionObserver" in window) {
    const velocityCutObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          entry.target.classList.add("is-velocity-entering");
          velocityCutObserver.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8%", threshold: 0.45 },
    );

    for (const velocityCut of velocityCuts) {
      velocityCut.classList.add("is-velocity-prepared");
      velocityCutObserver.observe(velocityCut);
    }
  }
}

for (const storyVideoFrame of document.querySelectorAll(
  "[data-story-video-frame]",
)) {
  const storyVideo = storyVideoFrame.querySelector("[data-story-video]");
  const storyVideoToggle = storyVideoFrame.querySelector(
    "[data-story-video-toggle]",
  );

  if (!storyVideo || !storyVideoToggle) {
    continue;
  }

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
      document.visibilityState === "visible" &&
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
  document.addEventListener("visibilitychange", syncStoryVideoPlayback);
  syncStoryVideoToggle();
}

const eventStatus = document.querySelector("[data-event-status]");

if (eventStatus) {
  const start = new Date(eventStatus.dataset.start);
  const end = new Date(eventStatus.dataset.end);
  const now = phaseFixture
    ? new Date(phaseFixtureDates[phaseFixture])
    : new Date();
  const value = eventStatus.querySelector("[data-status-value]");
  const label = eventStatus.querySelector("[data-status-label]");
  const update = eventStatus.querySelector("[data-status-update]");
  const updateText = eventStatus.querySelector("[data-status-update-text]");
  const updateSource = eventStatus.querySelector("[data-status-source]");
  const railElement = eventStatus.querySelector(".event-status__rail");
  const rail = [
    ...eventStatus.querySelectorAll("[data-status-day]"),
  ];
  const day = 86_400_000;
  let visibleSegments = 31;
  let progressSegments = 0;
  let statusTimeline = "project";
  let showLiveUpdate = false;
  let footerStatusText = "";
  let footerCountValue = "";
  let footerCountLabel = "";
  let footerPrefixMode = "before";
  let projectPhase = "before";
  let calendarPhase = "far";

  if (now < start) {
    const days = Math.max(1, Math.ceil((start - now) / day));
    const calendarDetails = document.querySelector("[data-calendar-details]");
    const nearStartDays = Number.parseInt(
      calendarDetails?.dataset.calendarNearDays || "30",
      10,
    );
    calendarPhase = days <= nearStartDays ? "near" : "far";
    visibleSegments = 12;
    statusTimeline = "calendar";
    progressSegments = Math.max(
      0,
      Math.min(
        visibleSegments,
        now.getFullYear() < start.getFullYear() ? 0 : now.getMonth() + 1,
      ),
    );
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
    footerCountValue = String(days);
    footerCountLabel = form.replace(
      eventStatus.dataset.lang === "ru"
        ? /\s+до\s+старта$/u
        : /\s+to\s+start$/u,
      "",
    );
    footerStatusText = `${footerCountValue} ${footerCountLabel}`;
  } else if (now < end) {
    const projectDay = Math.min(31, Math.floor((now - start) / day) + 1);
    progressSegments = projectDay;
    showLiveUpdate = true;
    footerPrefixMode = "active";
    projectPhase = "active";
    calendarPhase = "active";
    value.textContent = String(projectDay).padStart(2, "0");
    label.textContent = eventStatus.dataset.active;
    footerCountValue = value.textContent;
    footerCountLabel = label.textContent;
    footerStatusText = `${footerCountValue} ${footerCountLabel}`;
  } else {
    progressSegments = 31;
    showLiveUpdate = true;
    footerPrefixMode = "finished";
    projectPhase = "finished";
    calendarPhase = "finished";
    value.textContent = "31/31";
    label.textContent = eventStatus.dataset.finished;
    footerStatusText = label.textContent;
  }

  railElement?.style.setProperty(
    "--status-segment-count",
    String(visibleSegments),
  );
  if (railElement) {
    railElement.dataset.statusTimeline = statusTimeline;
  }

  rail.forEach((segment, index) => {
    segment.hidden = index >= visibleSegments;
    segment.classList.toggle("is-elapsed", index < progressSegments);
    segment.classList.toggle(
      "is-current",
      progressSegments > 0 && index === progressSegments - 1,
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

      updateText.textContent = `${eventStatus.dataset.latestUpdate}: ${parts.join(" · ")}`;
      if (
        updateSource &&
        eventStatus.dataset.liveSourceLabel &&
        eventStatus.dataset.liveSourceUrl
      ) {
        updateSource.textContent = `${eventStatus.dataset.sourceLabel}: ${eventStatus.dataset.liveSourceLabel}`;
        updateSource.href = eventStatus.dataset.liveSourceUrl;
        updateSource.hidden = false;
      }
    } else {
      updateText.textContent = eventStatus.dataset.statusPending;
      if (updateSource) updateSource.hidden = true;
    }

    update.hidden = false;
  }

  const diaryLive = document.querySelector("[data-diary-live]");
  const diaryCountdown = diaryLive?.querySelector("[data-diary-countdown]");
  const diaryCountdownLabel = diaryLive?.querySelector(
    "[data-diary-countdown-label]",
  );

  if (diaryLive) {
    const campaignStart = new Date(diaryLive.dataset.campaignStart);
    const campaignDuration = Math.max(day, start - campaignStart);
    const projectDuration = Math.max(day, end - start);
    const diaryProgress =
      projectPhase === "before"
        ? Math.max(0, Math.min(campaignDuration, now - campaignStart)) /
          campaignDuration
        : projectPhase === "active"
          ? Math.max(0, Math.min(projectDuration, now - start)) / projectDuration
          : 1;
    diaryLive.style.setProperty(
      "--diary-progress",
      String(diaryProgress),
    );

    const timelineNow = diaryLive.querySelector("[data-timeline-now]");
    if (timelineNow) {
      timelineNow.hidden = projectPhase !== "before";
      timelineNow.textContent =
        timelineNow.dataset.before || timelineNow.textContent;
    }
  }

  if (diaryCountdown) {
    diaryCountdown.textContent = value.textContent;
    syncOpticalStart(diaryCountdown);
  }

  if (diaryCountdownLabel) {
    diaryCountdownLabel.textContent =
      projectPhase === "finished"
        ? diaryLive.dataset.finishedCountLabel
        : label.textContent;
  }

  const partnerCountdown = document.querySelector("[data-partner-countdown]");

  if (partnerCountdown) {
    partnerCountdown.textContent = `${value.textContent} · ${label.textContent}`;
  }

  for (const menuStatus of document.querySelectorAll("[data-menu-status]")) {
    const menuValue = menuStatus.querySelector("[data-menu-status-value]");
    const menuLabel = menuStatus.querySelector("[data-menu-status-label]");

    if (menuValue) {
      menuValue.textContent = value.textContent;
      syncOpticalStart(menuValue);
    }

    if (menuLabel) {
      menuLabel.textContent = label.textContent;
    }

    menuStatus.setAttribute(
      "aria-label",
      `${value.textContent} ${label.textContent}`,
    );
  }

  const headerProgress = Math.max(
    0,
    Math.min(12, Math.round((progressSegments / visibleSegments) * 12)),
  );

  for (const headerRail of document.querySelectorAll(".header-status__rail")) {
    [...headerRail.children].forEach((segment, index) => {
      segment.classList.toggle("is-elapsed", index < headerProgress);
      segment.classList.toggle(
        "is-current",
        headerProgress > 0 && index === headerProgress - 1,
      );
    });
  }

  const footerCountdown = document.querySelector("[data-footer-countdown]");
  const footerPrefix = document.querySelector("[data-footer-prefix]");

  if (footerCountdown) {
    footerCountdown.textContent = footerStatusText;
    syncOpticalStart(footerCountdown);

    const numericTarget = Number.parseInt(footerCountValue, 10);

    if (Number.isFinite(numericTarget) && footerCountLabel) {
      const countValue = document.createElement("span");
      const countSizer = document.createElement("span");
      const countLive = document.createElement("span");
      const countLabel = document.createElement("span");
      const countAccessible = document.createElement("span");
      countValue.dataset.footerCountdownValue = "";
      countSizer.dataset.footerCountdownSizer = "";
      countLive.dataset.footerCountdownLive = "";
      countLabel.dataset.footerCountdownLabel = "";
      countValue.setAttribute("aria-hidden", "true");
      countLabel.setAttribute("aria-hidden", "true");
      countSizer.textContent = footerCountValue;
      countLive.textContent = footerCountValue;
      countLabel.textContent = footerCountLabel;
      countAccessible.className = "sr-only";
      countAccessible.textContent = footerStatusText;
      countValue.append(countSizer, countLive);
      footerCountdown.replaceChildren(countValue, countLabel, countAccessible);
    }
  }

  if (footerPrefix && footerPrefixMode !== "before") {
    footerPrefix.textContent = footerPrefix.dataset[footerPrefixMode];
  }

  document.body.dataset.projectPhase = projectPhase;
  document.body.dataset.calendarPhase = calendarPhase;
  if (phaseFixture) {
    document.body.dataset.phaseFixture = phaseFixture;
  }
  if (calendarFixture) {
    document.body.dataset.calendarFixture = calendarFixture;
  }

  for (const phaseCopy of document.querySelectorAll("[data-phase-copy]")) {
    const copy = phaseCopy.dataset[projectPhase];

    if (copy) {
      phaseCopy.textContent = copy;
    }
  }

  for (const phaseItem of document.querySelectorAll(
    "[data-project-phase-item]",
  )) {
    if (phaseItem.dataset.projectPhaseItem === projectPhase) {
      phaseItem.setAttribute("aria-current", "step");
    } else {
      phaseItem.removeAttribute("aria-current");
    }
  }

  const calendarDetails = document.querySelector("[data-calendar-details]");

  if (calendarDetails) {
    const calendarReady =
      calendarDetails.dataset.calendarReady === "true" ||
      calendarFixture === "confirmed";
    const calendarSegments = [
      ...calendarDetails.querySelectorAll("[data-calendar-start]"),
    ];
    const projectDate = new Date(now.getTime() + 3 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const currentSegment =
      calendarPhase === "active"
        ? calendarSegments.find(
            (segment) =>
              segment.dataset.calendarStart <= projectDate &&
              segment.dataset.calendarEnd >= projectDate,
          )
        : null;
    const shouldOpenCalendar =
      calendarFixture === "open" ||
      calendarPhase === "active" ||
      calendarPhase === "finished" ||
      (calendarPhase === "near" && calendarReady);

    document.body.dataset.calendarReady = String(calendarReady);
    calendarDetails.open = shouldOpenCalendar;

    for (const phaseCopy of document.querySelectorAll(
      "[data-calendar-phase-copy]",
    )) {
      const copy = phaseCopy.dataset[calendarPhase];

      if (copy) {
        phaseCopy.textContent = copy;
      }
    }

    for (const segment of calendarSegments) {
      if (segment === currentSegment) {
        segment.setAttribute("aria-current", "step");
      } else {
        segment.removeAttribute("aria-current");
      }
    }

    const calendarCurrent = document.querySelector("[data-calendar-current]");

    if (calendarCurrent) {
      calendarCurrent.hidden = !currentSegment;

      if (currentSegment) {
        const currentLink = calendarCurrent.querySelector(
          "[data-calendar-current-link]",
        );
        const currentDate = calendarCurrent.querySelector(
          "[data-calendar-current-date]",
        );
        const currentTitle = calendarCurrent.querySelector(
          "[data-calendar-current-title]",
        );
        const currentValue = calendarCurrent.querySelector(
          "[data-calendar-current-value]",
        );

        if (currentLink) currentLink.href = `#${currentSegment.id}`;
        if (currentDate) {
          currentDate.textContent = currentSegment.dataset.calendarDate || "";
        }
        if (currentTitle) {
          currentTitle.textContent = currentSegment.dataset.calendarLabel || "";
        }
        if (currentValue) {
          currentValue.textContent = currentSegment.dataset.calendarValue || "";
        }
      }
    }

    const revealCalendarTarget = () => {
      const targetId = window.location.hash.slice(1);
      const target = targetId ? document.getElementById(targetId) : null;

      if (target && calendarDetails.contains(target)) {
        calendarDetails.open = true;
      }
    };
    let calendarOpenTracked = false;

    calendarDetails.querySelector("summary")?.addEventListener("click", () => {
      if (!calendarDetails.open && !calendarOpenTracked) {
        reachGoal("calendar_open", { phase: calendarPhase });
        calendarOpenTracked = true;
      }
    });
    window.addEventListener("hashchange", revealCalendarTarget);
    revealCalendarTarget();
  }

  syncOpticalStart(value);
}

for (const analyticsTarget of document.querySelectorAll(
  "[data-analytics-goal]",
)) {
  analyticsTarget.addEventListener("click", () => {
    reachGoal(analyticsTarget.dataset.analyticsGoal);
  });
}

const diaryStories = document.querySelector("[data-diary-stories]");

if (diaryStories) {
  const diaryStoryTabs = [
    ...diaryStories.querySelectorAll("[data-diary-story-tab]"),
  ];
  const diaryStoryPanels = [
    ...diaryStories.querySelectorAll("[data-diary-story-panel]"),
  ];
  const diaryStoryRail = diaryStories.querySelector("[data-diary-story-tabs]");
  const diaryStoryNewer = diaryStories.querySelector("[data-diary-story-newer]");
  const diaryStoryEarlier = diaryStories.querySelector(
    "[data-diary-story-earlier]",
  );
  const diaryStoryPositionCurrent = diaryStories.querySelector(
    "[data-diary-story-position-current]",
  );
  const diaryStoryPosition = diaryStories.querySelector(
    "[data-diary-story-position]",
  );
  const diaryStoryPositionTemplate =
    diaryStoryPosition?.dataset.diaryStoryPositionTemplate || "";
  const diaryStoryMotionTimers = new WeakMap();
  let activeDiaryIndex = Math.max(
    0,
    diaryStoryTabs.findIndex(
      (tab) => tab.getAttribute("aria-selected") === "true",
    ),
  );
  let diaryStoriesVisible = false;

  const revealDiaryStoryTab = (tab) => {
    if (!diaryStoryRail || !tab) return;

    const tabStart = tab.offsetLeft;
    const tabEnd = tabStart + tab.offsetWidth;
    const visibleStart = diaryStoryRail.scrollLeft;
    const visibleEnd = visibleStart + diaryStoryRail.clientWidth;

    if (tabStart < visibleStart) {
      diaryStoryRail.scrollTo({ left: tabStart });
    } else if (tabEnd > visibleEnd) {
      diaryStoryRail.scrollTo({
        left: Math.max(0, tabEnd - diaryStoryRail.clientWidth),
      });
    }
  };

  const syncDiaryStoryNavigation = (index) => {
    const current = index + 1;
    const total = diaryStoryTabs.length;

    if (diaryStoryPositionCurrent) {
      diaryStoryPositionCurrent.textContent = String(current).padStart(2, "0");
    }
    if (diaryStoryPosition) {
      diaryStoryPosition.textContent = diaryStoryPositionTemplate
        .replace("{current}", String(current))
        .replace("{total}", String(total));
    }
    if (diaryStoryNewer) diaryStoryNewer.disabled = index <= 0;
    if (diaryStoryEarlier) {
      diaryStoryEarlier.disabled = index >= diaryStoryTabs.length - 1;
    }
  };

  const activateDiaryStory = (
    tab,
    { focus = false, reveal = false, animate = diaryStoriesVisible } = {},
  ) => {
    const panelId = tab?.getAttribute("aria-controls");
    if (!panelId) return;

    const nextDiaryIndex = diaryStoryTabs.indexOf(tab);
    const diaryDirection = nextDiaryIndex >= activeDiaryIndex ? 1 : -1;

    for (const storyTab of diaryStoryTabs) {
      const isActive = storyTab === tab;
      storyTab.setAttribute("aria-selected", String(isActive));
      storyTab.tabIndex = isActive ? 0 : -1;
    }

    for (const panel of diaryStoryPanels) {
      const isActive = panel.id === panelId;
      const previousTimer = diaryStoryMotionTimers.get(panel);

      if (previousTimer) {
        window.clearTimeout(previousTimer);
        diaryStoryMotionTimers.delete(panel);
      }

      panel.classList.remove("is-diary-entering");
      panel.classList.remove(
        "is-diary-entering--forward",
        "is-diary-entering--backward",
      );
      panel.hidden = !isActive;

      if (!isActive) {
        for (const video of panel.querySelectorAll("video")) {
          video.pause();
        }
      } else if (animate && !reducedMotion.matches) {
        panel.classList.add(
          diaryDirection >= 0
            ? "is-diary-entering--forward"
            : "is-diary-entering--backward",
        );
        void panel.offsetWidth;
        panel.classList.add("is-diary-entering");

        const timer = window.setTimeout(() => {
          panel.classList.remove(
            "is-diary-entering",
            "is-diary-entering--forward",
            "is-diary-entering--backward",
          );
          diaryStoryMotionTimers.delete(panel);
        }, 920);
        diaryStoryMotionTimers.set(panel, timer);
      }
    }

    activeDiaryIndex = nextDiaryIndex;
    syncDiaryStoryNavigation(activeDiaryIndex);

    if (reveal) {
      revealDiaryStoryTab(tab);
    }
    if (focus) tab.focus();
  };

  if (diaryStoryTabs.length && diaryStoryPanels.length) {
    for (const [index, tab] of diaryStoryTabs.entries()) {
      tab.addEventListener("click", (event) => {
        event.preventDefault();
        activateDiaryStory(tab, { reveal: true });
        history.replaceState(null, "", tab.hash);
      });

      tab.addEventListener("keydown", (event) => {
        let nextIndex = null;

        if (event.key === "ArrowRight") nextIndex = index + 1;
        if (event.key === "ArrowLeft") nextIndex = index - 1;
        if (event.key === "Home") nextIndex = 0;
        if (event.key === "End") nextIndex = diaryStoryTabs.length - 1;
        if (nextIndex === null) return;

        event.preventDefault();
        const nextTab = diaryStoryTabs.at(
          (nextIndex + diaryStoryTabs.length) % diaryStoryTabs.length,
        );
        activateDiaryStory(nextTab, { focus: true, reveal: true });
        history.replaceState(null, "", nextTab.hash);
      });
    }

    diaryStoryNewer?.addEventListener("click", () => {
      const nextTab = diaryStoryTabs[activeDiaryIndex - 1];
      if (!nextTab) return;

      activateDiaryStory(nextTab, { reveal: true });
      history.replaceState(null, "", nextTab.hash);
    });

    diaryStoryEarlier?.addEventListener("click", () => {
      const nextTab = diaryStoryTabs[activeDiaryIndex + 1];
      if (!nextTab) return;

      activateDiaryStory(nextTab, { reveal: true });
      history.replaceState(null, "", nextTab.hash);
    });

    const hashTab = diaryStoryTabs.find(
      (tab) => tab.hash === window.location.hash,
    );
    const initialTab =
      hashTab ||
      diaryStoryTabs.find((tab) => tab.getAttribute("aria-selected") === "true") ||
      diaryStoryTabs[0];

    activateDiaryStory(initialTab, {
      reveal: Boolean(hashTab),
      animate: false,
    });
    diaryStories.classList.add("has-diary-stories");

    if ("IntersectionObserver" in window) {
      const diaryStoriesObserver = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) {
            return;
          }

          diaryStoriesVisible = true;
          diaryStoriesObserver.disconnect();
        },
        { threshold: 0.2 },
      );

      diaryStoriesObserver.observe(diaryStories);
    } else {
      diaryStoriesVisible = true;
    }
  }
}

const diaryMediaGalleries = [
  ...document.querySelectorAll("[data-diary-gallery]"),
];

for (const gallery of diaryMediaGalleries) {
  const mediaTabs = [...gallery.querySelectorAll("[data-diary-media-tab]")];
  const mediaPanels = [...gallery.querySelectorAll("[data-diary-media-panel]")];

  if (!mediaTabs.length || mediaTabs.length !== mediaPanels.length) {
    continue;
  }

  const mediaRail = gallery.querySelector("[data-diary-media-tabs]");
  const mediaPrevious = gallery.querySelector("[data-diary-media-previous]");
  const mediaNext = gallery.querySelector("[data-diary-media-next]");
  const mediaPositionCurrent = gallery.querySelector(
    "[data-diary-media-position-current]",
  );
  const mediaPosition = gallery.querySelector("[data-diary-media-position]");
  const mediaKind = gallery.querySelector("[data-diary-media-kind]");
  const mediaPositionTemplate =
    mediaPosition?.dataset.diaryMediaPositionTemplate || "";
  let activeMediaIndex = Math.max(
    0,
    mediaTabs.findIndex(
      (tab) => tab.getAttribute("aria-selected") === "true",
    ),
  );

  const revealMediaTab = (tab) => {
    if (!mediaRail || !tab) return;

    const tabStart = tab.offsetLeft;
    const tabEnd = tabStart + tab.offsetWidth;
    const visibleStart = mediaRail.scrollLeft;
    const visibleEnd = visibleStart + mediaRail.clientWidth;

    if (tabStart < visibleStart) {
      mediaRail.scrollTo({ left: tabStart });
    } else if (tabEnd > visibleEnd) {
      mediaRail.scrollTo({
        left: Math.max(0, tabEnd - mediaRail.clientWidth),
      });
    }
  };

  const syncMediaNavigation = (index) => {
    const current = index + 1;
    const total = mediaTabs.length;
    const label = mediaTabs[index]?.dataset.diaryMediaLabel || "";

    if (mediaPositionCurrent) {
      mediaPositionCurrent.textContent = String(current).padStart(2, "0");
    }
    if (mediaKind) mediaKind.textContent = label;
    if (mediaPosition) {
      mediaPosition.textContent = mediaPositionTemplate
        .replace("{current}", String(current))
        .replace("{total}", String(total))
        .replace("{label}", label);
    }
    if (mediaPrevious) mediaPrevious.disabled = index <= 0;
    if (mediaNext) mediaNext.disabled = index >= total - 1;
  };

  const activateMedia = (
    tab,
    { focus = false, reveal = false } = {},
  ) => {
    const panelId = tab?.getAttribute("aria-controls");
    if (!panelId) return;

    for (const mediaTab of mediaTabs) {
      const isActive = mediaTab === tab;
      mediaTab.setAttribute("aria-selected", String(isActive));
      mediaTab.tabIndex = isActive ? 0 : -1;
    }

    for (const panel of mediaPanels) {
      const isActive = panel.id === panelId;
      panel.hidden = !isActive;
      if (!isActive) {
        for (const video of panel.querySelectorAll("video")) {
          video.pause();
        }
      }
    }

    activeMediaIndex = mediaTabs.indexOf(tab);
    syncMediaNavigation(activeMediaIndex);
    if (reveal) revealMediaTab(tab);
    if (focus) tab.focus();
  };

  for (const [index, tab] of mediaTabs.entries()) {
    tab.addEventListener("click", () => {
      activateMedia(tab, { reveal: true });
    });

    tab.addEventListener("keydown", (event) => {
      let nextIndex = null;

      if (event.key === "ArrowRight") nextIndex = index + 1;
      if (event.key === "ArrowLeft") nextIndex = index - 1;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = mediaTabs.length - 1;
      if (nextIndex === null) return;

      event.preventDefault();
      const nextTab = mediaTabs.at(
        (nextIndex + mediaTabs.length) % mediaTabs.length,
      );
      activateMedia(nextTab, { focus: true, reveal: true });
    });
  }

  mediaPrevious?.addEventListener("click", () => {
    const previousTab = mediaTabs[activeMediaIndex - 1];
    if (previousTab) activateMedia(previousTab, { reveal: true });
  });

  mediaNext?.addEventListener("click", () => {
    const nextTab = mediaTabs[activeMediaIndex + 1];
    if (nextTab) activateMedia(nextTab, { reveal: true });
  });

  activateMedia(mediaTabs[activeMediaIndex]);
  gallery.classList.add("has-media-gallery");
}

const diaryVideos = [...document.querySelectorAll("[data-diary-video]")];

for (const diaryVideo of diaryVideos) {
  const diaryVideoFrame =
    diaryVideo.closest("[data-diary-media-panel]") ||
    diaryVideo.closest(".diary__media");
  const diaryVideoPlay = diaryVideoFrame?.querySelector(
    "[data-diary-video-play]",
  );
  let diaryStarted = false;
  let diaryCompleted = false;

  if (diaryVideoPlay && diaryVideoFrame) {
    diaryVideo.controls = false;
    diaryVideoFrame.classList.add("has-custom-control");

    diaryVideoPlay.addEventListener("click", async () => {
      diaryVideo.controls = true;

      try {
        await diaryVideo.play();
      } catch {
        diaryVideo.controls = true;
        diaryVideoFrame.classList.remove("has-custom-control");
      }
    });

    diaryVideo.addEventListener("error", () => {
      diaryVideo.controls = true;
      diaryVideoFrame.classList.remove("has-custom-control");
    });
  }

  diaryVideo.addEventListener("play", () => {
    for (const otherVideo of diaryVideos) {
      if (otherVideo !== diaryVideo) otherVideo.pause();
    }

    diaryVideoFrame?.classList.add("has-started");

    if (!diaryStarted) {
      reachGoal("diary_video_start");
      diaryStarted = true;
    }
  });

  diaryVideo.addEventListener("ended", () => {
    diaryVideoFrame?.classList.remove("has-started");

    if (!diaryCompleted) {
      reachGoal("diary_video_complete");
      diaryCompleted = true;
    }
  });
}

const desktopNavigation = window.matchMedia("(min-width: 961px)");
const menuFocusableSelector = [
  "summary",
  "a[href]",
  "button:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");
const menuIsolationState = new Map();

function getMenuFocusables(navigation) {
  return [...navigation.querySelectorAll(menuFocusableSelector)].filter(
    (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        !element.inert &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    },
  );
}

function syncMenuIsolation(navigation) {
  const header = navigation.closest(".site-header");

  if (navigation.open) {
    const targets = [
      ...[...document.body.children].filter(
        (element) => element !== header && !["SCRIPT", "STYLE"].includes(element.tagName),
      ),
      ...[...(header?.children || [])].filter(
        (element) => element !== navigation,
      ),
    ];

    for (const target of targets) {
      if (!menuIsolationState.has(target)) {
        menuIsolationState.set(target, target.inert);
      }
      target.inert = true;
    }
    return;
  }

  for (const [target, wasInert] of menuIsolationState) {
    target.inert = wasInert;
  }
  menuIsolationState.clear();
}

function syncNavigationMode() {
  for (const navigation of document.querySelectorAll(".nav-shell")) {
    navigation.removeAttribute("open");
    const toggle = navigation.querySelector(".menu-toggle");
    if (toggle?.dataset.menuOpenLabel) {
      toggle.setAttribute("aria-label", toggle.dataset.menuOpenLabel);
    }
    syncMenuIsolation(navigation);
  }
}

syncNavigationMode();
desktopNavigation.addEventListener?.("change", syncNavigationMode);

// Shared icon-motion token: critically damped (c = 2 * sqrt(k)), no bounce.
const iconMorphSpring = Object.freeze({ stiffness: 900, damping: 60 });

for (const navigation of document.querySelectorAll(".nav-shell")) {
  const icon = navigation.querySelector("[data-menu-morph-src]");
  if (icon) {
    import(new URL(icon.dataset.menuMorphSrc, document.baseURI).href)
      .then(({ createMorph }) => {
        const path = icon.querySelector("path");
        const closedPath = path.getAttribute("d");
        const openPath = path.dataset.openPath;
        const currentPath = () => navigation.open ? openPath : closedPath;
        const morph = createMorph(path, currentPath(), { reducedMotion: "user" });
        const syncIcon = () => {
          if (reducedMotion.matches) morph.set(currentPath());
          else morph.morphTo(currentPath(), iconMorphSpring);
        };

        navigation.addEventListener("toggle", syncIcon);
        reducedMotion.addEventListener("change", syncIcon);
        icon.setAttribute("data-morph-ready", "");
      })
      .catch(() => {
        // Optional enhancement: native details and the CSS icon still work.
      });
  }

  navigation.addEventListener("toggle", () => {
    const toggle = navigation.querySelector(".menu-toggle");
    const toggleLabel = navigation.open
      ? toggle?.dataset.menuCloseLabel
      : toggle?.dataset.menuOpenLabel;
    if (toggle && toggleLabel) toggle.setAttribute("aria-label", toggleLabel);
    syncMenuIsolation(navigation);

    if (navigation.open) {
      restoreMenuPreview();
      reachGoal("menu_open", { location: "header" });
    }
  });

  navigation.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      navigation.removeAttribute("open");
    }
  });

}

document.addEventListener("keydown", (event) => {
  const openNavigation = document.querySelector(".nav-shell[open]");

  if (event.key === "Tab" && openNavigation) {
    const focusables = getMenuFocusables(openNavigation);
    const first = focusables[0];
    const last = focusables.at(-1);
    const active = document.activeElement;

    if (!first || !last) {
      event.preventDefault();
      return;
    }

    if (!openNavigation.contains(active)) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (event.key === "Escape") {
    for (const navigation of document.querySelectorAll(".nav-shell[open]")) {
      navigation.removeAttribute("open");
      syncMenuIsolation(navigation);
      navigation.querySelector("summary")?.focus();
    }
  }

});

for (const languageSwitch of document.querySelectorAll("[data-language-switch]")) {
  languageSwitch.addEventListener("click", () => {
    reachGoal("language_switch", {
      language: languageSwitch.hreflang,
      location: languageSwitch.closest(".site-nav")
        ? "menu"
        : languageSwitch.closest("footer")
          ? "footer"
          : "header",
    });

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

if (siteHeader && heroSection) {
  const heroHeaderTrigger = heroSection.querySelector(".hero__kicker");
  let heroHeaderFrame = 0;

  function syncHeroHeaderState() {
    heroHeaderFrame = 0;

    if (!heroHeaderTrigger) {
      siteHeader.classList.toggle(
        "is-over-hero",
        heroSection.getBoundingClientRect().bottom >
          siteHeader.getBoundingClientRect().bottom,
      );
      return;
    }

    const headerBottom = siteHeader.getBoundingClientRect().bottom;
    const firstTextTop = heroHeaderTrigger.getBoundingClientRect().top;

    siteHeader.classList.toggle(
      "is-over-hero",
      firstTextTop > headerBottom + 12,
    );
  }

  function requestHeroHeaderSync() {
    if (!heroHeaderFrame) {
      heroHeaderFrame = requestAnimationFrame(syncHeroHeaderState);
    }
  }

  syncHeroHeaderState();
  window.addEventListener("scroll", requestHeroHeaderSync, { passive: true });
  window.addEventListener("resize", requestHeroHeaderSync);
}

const headerNavigationLinks = [
  ...document.querySelectorAll(".site-nav [data-nav-track]"),
];
const menuPreviewIndex = document.querySelector("[data-menu-preview-index]");
const menuPreviewTitle = document.querySelector("[data-menu-preview-title]");
const menuPreviewImage = document.querySelector("[data-menu-preview-image]");
const menuPreviewLinks = headerNavigationLinks.filter(
  (link) => link.dataset.navIndex,
);
const menuPreviewPointer = window.matchMedia(
  "(hover: hover) and (pointer: fine)",
);
function syncMenuPreviewCopy(index, title) {
  if (!menuPreviewIndex || !menuPreviewTitle) return;

  menuPreviewIndex.dataset.currentIndex = index;
  menuPreviewIndex.textContent = index;
  menuPreviewTitle.textContent = title;
}

function syncMenuPreview(link) {
  if (!link?.dataset.navIndex || !menuPreviewIndex || !menuPreviewTitle) return;

  syncMenuPreviewCopy(
    link.dataset.navIndex,
    link.dataset.navTitle || link.textContent.trim(),
  );

  if (menuPreviewImage) {
    menuPreviewImage.style.objectPosition =
      link.dataset.navPosition || "50% 50%";
  }

  if (
    menuPreviewImage &&
    link.dataset.navImage &&
    menuPreviewImage.getAttribute("src") !== link.dataset.navImage
  ) {
    menuPreviewImage.setAttribute("src", link.dataset.navImage);
  }
}

function restoreMenuPreview() {
  syncMenuPreview(
    menuPreviewLinks.find((link) => link.getAttribute("aria-current") === "location") ||
      menuPreviewLinks[0],
  );
}

for (const link of menuPreviewLinks) {
  link.addEventListener("pointerenter", () => {
    if (menuPreviewPointer.matches) syncMenuPreview(link);
  });
  link.addEventListener("focus", () => {
    if (link.matches(":focus-visible")) syncMenuPreview(link);
  });
}

document.querySelector(".site-nav__primary")?.addEventListener(
  "pointerleave",
  restoreMenuPreview,
);
document.querySelector(".site-nav__primary")?.addEventListener("focusout", () => {
  requestAnimationFrame(() => {
    if (!document.querySelector(".site-nav__primary")?.contains(document.activeElement)) {
      restoreMenuPreview();
    }
  });
});

for (const link of headerNavigationLinks) {
  link.addEventListener("click", () => {
    reachGoal("chapter_navigation", {
      chapter: link.hash.slice(1) || "top",
    });
  });
}
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
    let activeItem =
      headerNavigationTargets.find(({ link }) => link.hash === "#about") ||
      headerNavigationTargets[0];

    const orderedTargets = [...headerNavigationTargets].sort(
      (first, second) => first.target.offsetTop - second.target.offsetTop,
    );

    for (const item of orderedTargets) {
      if (item.target.offsetTop <= readingLine) {
        activeItem = item;
      }
    }

    const navigationIsOpen = Boolean(siteHeader.querySelector(".nav-shell[open]"));
    const headerIsCondensed = navigationIsOpen
      ? headerWasCondensed
      : desktopNavigation.matches &&
        window.scrollY > Math.min(220, window.innerHeight * 0.2);

    siteHeader.style.setProperty("--header-progress", String(progress));
    siteHeader.classList.toggle("is-condensed", headerIsCondensed);

    headerWasCondensed = headerIsCondensed;

    for (const item of headerNavigationTargets) {
      if (item === activeItem) {
        item.link.setAttribute("aria-current", "location");
      } else {
        item.link.removeAttribute("aria-current");
      }
    }

    const currentChapter = siteHeader.querySelector("[data-current-chapter]");

    if (currentChapter) {
      currentChapter.textContent =
        activeItem.link.dataset.navTitle || activeItem.link.textContent.trim();
    }

    const primaryNavigation = document.querySelector(".site-nav__primary");
    const hasPointerPreview =
      menuPreviewPointer.matches && primaryNavigation?.matches(":hover");
    const hasKeyboardPreview =
      primaryNavigation?.contains(document.activeElement) &&
      document.activeElement?.matches?.(":focus-visible");

    if (!hasPointerPreview && !hasKeyboardPreview) {
      restoreMenuPreview();
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
