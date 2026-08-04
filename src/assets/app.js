const requestParameters = new URLSearchParams(window.location.search);
const requestedTheme = requestParameters.get("theme");
const requestedPhase = requestParameters.get("phase");
const requestedTextScale = requestParameters.get("text");
const phaseFixtureDates = {
  before: "2026-07-31T12:00:00+03:00",
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
const effortAudio = document.querySelector("[data-effort-audio]");
const soundPlayer = document.querySelector("[data-sound-player]");
const soundSceneButtons = Array.from(
  document.querySelectorAll("[data-sound-scene]"),
);

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

if (effortAudio && soundPlayer && soundSceneButtons.length) {
  const audioStory = soundPlayer.closest("[data-audio-story]");
  const soundContexts = Array.from(
    document.querySelectorAll("[data-sound-context]"),
  );
  let activeSoundScene = Math.max(
    0,
    soundSceneButtons.findIndex(
      (button) => button.getAttribute("aria-pressed") === "true",
    ),
  );
  let soundProgressFrame = 0;
  let soundAudioContext;
  let soundAnalyser;
  let soundFrequencyData;
  let soundStoryStarted = false;
  let soundStoryCompleted = false;
  let soundSceneMotionTimer = 0;
  let audioStoryEntryTimer = 0;

  function animateAudioStoryEntry() {
    window.clearTimeout(audioStoryEntryTimer);

    if (!audioStory || reducedMotion.matches) {
      audioStory?.classList.remove("is-audio-entering");
      return;
    }

    audioStory.classList.remove("is-audio-entering");
    void audioStory.offsetWidth;
    audioStory.classList.add("is-audio-entering");

    audioStoryEntryTimer = window.setTimeout(() => {
      audioStory.classList.remove("is-audio-entering");
      audioStoryEntryTimer = 0;
    }, 1120);
  }

  function animateSoundScene(button, context, direction) {
    window.clearTimeout(soundSceneMotionTimer);

    for (const sceneButton of soundSceneButtons) {
      sceneButton.classList.remove("is-scene-entering");
    }

    for (const sceneContext of soundContexts) {
      sceneContext.classList.remove("is-context-entering");
    }

    if (!button || !context || reducedMotion.matches) {
      return;
    }

    const movesForward = direction >= 0;
    soundPlayer.style.setProperty(
      "--scene-shift",
      movesForward ? "2.4rem" : "-2.4rem",
    );
    soundPlayer.style.setProperty(
      "--scene-shift-soft",
      movesForward ? "1.25rem" : "-1.25rem",
    );
    soundPlayer.style.setProperty(
      "--scene-clip",
      movesForward ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)",
    );
    soundPlayer.style.setProperty(
      "--scene-sweep-from",
      movesForward ? "180% 0" : "-80% 0",
    );
    soundPlayer.style.setProperty(
      "--scene-sweep-to",
      movesForward ? "-80% 0" : "180% 0",
    );

    void soundPlayer.offsetWidth;
    button.classList.add("is-scene-entering");
    context.classList.add("is-context-entering");

    soundSceneMotionTimer = window.setTimeout(() => {
      button.classList.remove("is-scene-entering");
      context.classList.remove("is-context-entering");
      soundSceneMotionTimer = 0;
    }, 820);
  }

  function soundWaveBars() {
    return Array.from(
      soundSceneButtons[activeSoundScene]?.querySelectorAll(
        ".audio-story__wave i",
      ) || [],
    );
  }

  async function ensureSoundAnalyser() {
    if (!soundAudioContext) {
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext;

      if (!AudioContextClass) {
        return;
      }

      try {
        soundAudioContext = new AudioContextClass();
        const source = soundAudioContext.createMediaElementSource(effortAudio);
        soundAnalyser = soundAudioContext.createAnalyser();
        soundAnalyser.fftSize = 64;
        soundAnalyser.smoothingTimeConstant = 0.72;
        soundFrequencyData = new Uint8Array(
          soundAnalyser.frequencyBinCount,
        );
        source.connect(soundAnalyser);
        soundAnalyser.connect(soundAudioContext.destination);
      } catch {
        soundAudioContext = undefined;
        soundAnalyser = undefined;
        soundFrequencyData = undefined;
        return;
      }
    }

    if (soundAudioContext.state === "suspended") {
      await soundAudioContext.resume();
    }
  }

  function updateSoundWave() {
    const bars = soundWaveBars();

    if (!soundAnalyser || !soundFrequencyData || !bars.length) {
      return;
    }

    soundAnalyser.getByteFrequencyData(soundFrequencyData);
    const bins = [1, 3, 6, 10, 14];

    for (const [index, bar] of bars.entries()) {
      const strength = soundFrequencyData[bins[index]] / 255;
      bar.style.transform = `scaleY(${0.34 + strength * 1.18})`;
    }
  }

  function resetSoundWave() {
    for (const bar of soundPlayer.querySelectorAll(".audio-story__wave i")) {
      bar.style.removeProperty("transform");
    }
  }

  function soundDuration() {
    if (Number.isFinite(effortAudio.duration) && effortAudio.duration > 0) {
      return effortAudio.duration;
    }

    return Number(soundSceneButtons[activeSoundScene]?.dataset.duration) || 0;
  }

  function syncSoundStoryline(progress = 0) {
    for (const [index, button] of soundSceneButtons.entries()) {
      const sceneProgress =
        index < activeSoundScene
          ? 1
          : index === activeSoundScene
            ? progress
            : 0;

      button.style.setProperty(
        "--scene-progress",
        `${Math.min(1, sceneProgress) * 100}%`,
      );
    }
  }

  function updateSoundProgress() {
    const duration = soundDuration();
    const isPlaying = !effortAudio.paused && !effortAudio.ended;
    const progress = duration
      ? Math.min(1, effortAudio.currentTime / duration)
      : 0;

    syncSoundStoryline(progress);

    if (isPlaying) {
      updateSoundWave();
      soundProgressFrame = window.requestAnimationFrame(updateSoundProgress);
    }
  }

  function syncSoundControls() {
    const isPlaying = !effortAudio.paused && !effortAudio.ended;

    soundPlayer.style.setProperty(
      "--active-scene-index",
      String(activeSoundScene),
    );

    for (const [index, button] of soundSceneButtons.entries()) {
      const isActive = index === activeSoundScene;
      const label =
        isActive && isPlaying
          ? button.dataset.pauseLabel
          : button.dataset.playLabel;
      const title = button.dataset.sceneTitle || "";

      button.setAttribute("aria-pressed", String(isActive));
      button.dataset.playing = String(isActive && isPlaying);
      button.setAttribute("aria-label", title ? `${label}: ${title}` : label);
    }

    for (const [index, context] of soundContexts.entries()) {
      context.hidden = index !== activeSoundScene;
    }

    window.cancelAnimationFrame(soundProgressFrame);
    if (!isPlaying) {
      resetSoundWave();
    }
    updateSoundProgress();
  }

  function revealSoundScene(button) {
    const storyline = button.closest(".audio-story__storyline");
    const item = button.closest("li");

    if (!storyline || !item || window.matchMedia("(min-width: 641px)").matches) {
      return;
    }

    const storylineRect = storyline.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();

    storyline.scrollTo({
      left: storyline.scrollLeft + itemRect.left - storylineRect.left,
      behavior: reducedMotion.matches ? "auto" : "smooth",
    });
  }

  async function selectSoundScene(index, shouldPlay = true) {
    const nextButton = soundSceneButtons[index];

    if (!nextButton) {
      return;
    }

    const previousScene = activeSoundScene;
    activeSoundScene = index;
    const nextSource = nextButton.dataset.audioSrc;

    if (nextSource && effortAudio.getAttribute("src") !== nextSource) {
      effortAudio.setAttribute("src", nextSource);
      effortAudio.load();
    } else {
      effortAudio.currentTime = 0;
    }

    resetSoundWave();
    syncSoundControls();
    if (index !== previousScene) {
      animateSoundScene(
        nextButton,
        soundContexts[index],
        index > previousScene ? 1 : -1,
      );
    }
    revealSoundScene(nextButton);

    if (shouldPlay) {
      try {
        await ensureSoundAnalyser();
        await effortAudio.play();
      } catch {
        syncSoundControls();
      }
    }
  }

  for (const [index, button] of soundSceneButtons.entries()) {
    button.addEventListener("click", async () => {
      reachGoal("sound_scene_select", { scene: String(index + 1) });
      if (index !== activeSoundScene) {
        selectSoundScene(index);
        return;
      }

      if (!effortAudio.paused) {
        effortAudio.pause();
        return;
      }

      if (
        effortAudio.ended ||
        (Number.isFinite(effortAudio.duration) &&
          effortAudio.currentTime > effortAudio.duration - 0.3)
      ) {
        effortAudio.currentTime = 0;
      }

      try {
        await ensureSoundAnalyser();
        await effortAudio.play();
      } catch {
        syncSoundControls();
      }
    });
  }

  effortAudio.addEventListener("play", () => {
    if (!soundStoryStarted) {
      soundStoryStarted = true;
      reachGoal("sound_story_start");
    }

    syncSoundControls();
  });
  effortAudio.addEventListener("pause", syncSoundControls);
  effortAudio.addEventListener("ended", () => {
    if (activeSoundScene < soundSceneButtons.length - 1) {
      selectSoundScene(activeSoundScene + 1);
    } else {
      if (!soundStoryCompleted) {
        soundStoryCompleted = true;
        reachGoal("sound_story_complete");
      }

      syncSoundControls();
    }
  });
  effortAudio.addEventListener("loadedmetadata", syncSoundControls);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      effortAudio.pause();
    }
  });
  reducedMotion.addEventListener?.("change", (event) => {
    if (event.matches) {
      animateSoundScene();
      animateAudioStoryEntry();
    }
  });

  if (audioStory && "IntersectionObserver" in window) {
    const audioStoryObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          return;
        }

        animateAudioStoryEntry();
        audioStoryObserver.disconnect();
      },
      { threshold: 0.28 },
    );

    audioStoryObserver.observe(audioStory);
  }
  syncSoundControls();
}

const chapterRuleLabels = [
  ...document.querySelectorAll(".section-label"),
];

if (chapterRuleLabels.length && "IntersectionObserver" in window) {
  const chapterRuleObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }

        if (!reducedMotion.matches) {
          entry.target.classList.add("is-rule-entering");
        }
        chapterRuleObserver.unobserve(entry.target);
      }
    },
    { threshold: 0.65 },
  );

  for (const label of chapterRuleLabels) {
    chapterRuleObserver.observe(label);
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
  const distanceSequenceCurrent = distanceStory.querySelector(
    "[data-distance-sequence-current]",
  );
  const distanceSaveData = navigator.connection?.saveData === true;
  const distanceMotionTimers = new WeakMap();
  const distanceCardMotionTimers = new WeakMap();
  const distanceFrameMotionTimers = new WeakMap();
  let distanceStoryMotionTimer = 0;
  let activeDistanceIndex = 0;
  let distanceStoryVisible = false;

  function createDistanceMotionLayer(text, state, kind) {
    const layer = document.createElement("span");
    layer.className = `distance-motion__layer distance-motion__layer--${state}`;
    layer.setAttribute("aria-hidden", "true");

    if (kind === "value") {
      const token = document.createElement("span");
      token.className = "distance-motion__token";
      token.textContent = text;
      layer.append(token);
      return layer;
    }

    const characters = [...text];
    let glyphIndex = 0;

    for (const character of characters) {
      const glyph = document.createElement("span");

      glyph.textContent = character;

      if (/\s/u.test(character)) {
        glyph.className = "distance-motion__space";
      } else {
        glyph.className = "distance-motion__glyph";
        glyph.style.setProperty("--distance-motion-order", String(glyphIndex));
        glyphIndex += 1;
      }

      layer.append(glyph);
    }

    return layer;
  }

  function finishDistanceTextMotion(element, text) {
    const timers = distanceMotionTimers.get(element);

    if (timers) {
      window.clearTimeout(timers.width);
      window.clearTimeout(timers.finish);
      distanceMotionTimers.delete(element);
    }

    element.classList.remove(
      "distance-motion",
      "distance-motion--label",
      "distance-motion--value",
      "is-morphing",
    );
    element.style.removeProperty("width");
    element.textContent = text;
    element.dataset.motionText = text;

    if (element.matches("[data-optical-start]")) {
      syncOpticalStart(element);
    }
  }

  function morphDistanceText(element, nextText, kind) {
    if (!element) {
      return;
    }

    const text = String(nextText ?? "");
    const currentText = element.dataset.motionText ?? element.textContent;

    if (currentText === text) {
      element.dataset.motionText = text;
      return;
    }

    finishDistanceTextMotion(element, currentText);

    if (reducedMotion.matches || element.getClientRects().length === 0) {
      finishDistanceTextMotion(element, text);
      return;
    }

    const previousWidth = element.getBoundingClientRect().width;
    const outgoing = createDistanceMotionLayer(currentText, "outgoing", kind);
    const incoming = createDistanceMotionLayer(text, "incoming", kind);
    const glyphCount = [...text].filter((character) => !/\s/u.test(character)).length;
    const widthDelay = 180;
    const duration =
      kind === "value"
        ? 610
        : 610 + Math.min(glyphCount * 8, 80);

    element.dataset.motionText = text;
    element.replaceChildren(outgoing, incoming);
    element.classList.add(
      "distance-motion",
      `distance-motion--${kind}`,
      "is-morphing",
    );
    element.style.width = `${previousWidth}px`;

    const nextWidth = incoming.getBoundingClientRect().width;

    const widthTimer = window.setTimeout(() => {
      if (element.dataset.motionText === text) {
        element.style.width = `${nextWidth}px`;
      }
    }, widthDelay);

    const finishTimer = window.setTimeout(
      () => finishDistanceTextMotion(element, text),
      duration,
    );
    distanceMotionTimers.set(element, {
      width: widthTimer,
      finish: finishTimer,
    });
  }

  function animateDistanceCard(card) {
    if (!card || reducedMotion.matches) {
      return;
    }

    const previousTimer = distanceCardMotionTimers.get(card);

    if (previousTimer) {
      window.clearTimeout(previousTimer);
    }

    card.classList.remove("is-motion-entering");
    void card.offsetWidth;
    card.classList.add("is-motion-entering");

    const timer = window.setTimeout(() => {
      card.classList.remove("is-motion-entering");
      distanceCardMotionTimers.delete(card);
    }, 820);
    distanceCardMotionTimers.set(card, timer);
  }

  function animateDistanceStory(direction) {
    window.clearTimeout(distanceStoryMotionTimer);
    distanceStory.classList.remove(
      "is-distance-cutting",
      "is-distance-cutting--forward",
      "is-distance-cutting--backward",
    );

    if (reducedMotion.matches) {
      return;
    }

    distanceStory.classList.add(
      direction >= 0
        ? "is-distance-cutting--forward"
        : "is-distance-cutting--backward",
    );
    void distanceStory.offsetWidth;
    distanceStory.classList.add("is-distance-cutting");

    distanceStoryMotionTimer = window.setTimeout(() => {
      distanceStory.classList.remove(
        "is-distance-cutting",
        "is-distance-cutting--forward",
        "is-distance-cutting--backward",
      );
      distanceStoryMotionTimer = 0;
    }, 960);
  }

  function animateDistanceFrame(frame, direction) {
    for (const storyFrame of distanceFrames) {
      const previousTimer = distanceFrameMotionTimers.get(storyFrame);

      if (previousTimer) {
        window.clearTimeout(previousTimer);
        distanceFrameMotionTimers.delete(storyFrame);
      }

      storyFrame.classList.remove(
        "is-motion-entering",
        "is-motion-entering--forward",
        "is-motion-entering--backward",
      );
    }

    if (!frame || reducedMotion.matches) {
      return;
    }

    frame.classList.add(
      direction >= 0
        ? "is-motion-entering--forward"
        : "is-motion-entering--backward",
    );
    void frame.offsetWidth;
    frame.classList.add("is-motion-entering");

    const timer = window.setTimeout(() => {
      frame.classList.remove(
        "is-motion-entering",
        "is-motion-entering--forward",
        "is-motion-entering--backward",
      );
      distanceFrameMotionTimers.delete(frame);
    }, 960);
    distanceFrameMotionTimers.set(frame, timer);
  }

  function syncDistanceVideo() {
    for (const [videoIndex, video] of distanceVideos.entries()) {
      const shouldPlay =
        videoIndex === activeDistanceIndex &&
        distanceStoryVisible &&
        document.visibilityState === "visible" &&
        !reducedMotion.matches &&
        !distanceSaveData;

      if (shouldPlay) {
        if (video.paused && !video.ended) {
          video.play().catch(() => {});
        }
      } else {
        video.pause();
      }
    }
  }

  function setActiveDistance(index) {
    const activeCard = distanceCards[index];

    if (!activeCard) {
      return;
    }

    const previousDistanceIndex = activeDistanceIndex;
    const distanceChanged = index !== previousDistanceIndex;
    activeDistanceIndex = index;

    for (const [cardIndex, card] of distanceCards.entries()) {
      card.classList.toggle("is-active", cardIndex === index);
    }

    for (const [frameIndex, frame] of distanceFrames.entries()) {
      frame.classList.toggle("is-active", frameIndex === index);
    }

    morphDistanceText(
      distanceLiveIndex,
      activeCard.dataset.distanceIndex,
      "label",
    );

    morphDistanceText(
      distanceLiveLabel,
      activeCard.dataset.distanceLabel,
      "label",
    );
    morphDistanceText(
      distanceLiveValue,
      activeCard.dataset.distanceValue,
      "value",
    );

    if (distanceLiveUnit) {
      distanceLiveUnit.textContent = activeCard.dataset.distanceUnit;
    }

    morphDistanceText(
      distanceSequenceCurrent,
      activeCard.dataset.distanceIndex,
      "label",
    );

    for (const [stepIndex, step] of distanceSequence.entries()) {
      step.classList.toggle("is-active", stepIndex === index);
      step.classList.toggle("is-complete", stepIndex < index);
    }

    if (distanceChanged) {
      const nextVideo = distanceVideos[index];

      if (nextVideo?.readyState > 0) {
        nextVideo.currentTime = 0;
      }

      animateDistanceStory(index > previousDistanceIndex ? 1 : -1);
      animateDistanceFrame(
        distanceFrames[index],
        index > previousDistanceIndex ? 1 : -1,
      );
      animateDistanceCard(activeCard);
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

  reducedMotion.addEventListener?.("change", (event) => {
    syncDistanceVideo();

    if (event.matches) {
      window.clearTimeout(distanceStoryMotionTimer);
      distanceStory.classList.remove(
        "is-distance-cutting",
        "is-distance-cutting--forward",
        "is-distance-cutting--backward",
      );

      for (const card of distanceCards) {
        card.classList.remove("is-motion-entering");
      }

      animateDistanceFrame();

      for (const element of [
        distanceLiveIndex,
        distanceLiveLabel,
        distanceLiveValue,
        distanceSequenceCurrent,
      ]) {
        if (element?.dataset.motionText) {
          finishDistanceTextMotion(element, element.dataset.motionText);
        }
      }
    }
  });
  document.addEventListener("visibilitychange", syncDistanceVideo);
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

  if (now < start) {
    const days = Math.max(1, Math.ceil((start - now) / day));
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
  if (phaseFixture) {
    document.body.dataset.phaseFixture = phaseFixture;
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
  const diaryStoryMotionTimers = new WeakMap();
  let activeDiaryIndex = Math.max(
    0,
    diaryStoryTabs.findIndex(
      (tab) => tab.getAttribute("aria-selected") === "true",
    ),
  );
  let diaryStoriesVisible = false;

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
        panel.querySelector("video")?.pause();
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

    if (reveal) {
      tab.scrollIntoView({ block: "nearest", inline: "nearest" });
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

const diaryVideos = [...document.querySelectorAll("[data-diary-video]")];

for (const diaryVideo of diaryVideos) {
  const diaryVideoFrame = diaryVideo.closest(".diary__media");
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

for (const navigation of document.querySelectorAll(".nav-shell")) {
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
let menuPreviewMotionTimer = 0;

function animateMenuPreviewCopy(index, title) {
  if (!menuPreviewIndex || !menuPreviewTitle) return;

  window.clearTimeout(menuPreviewMotionTimer);

  const currentIndex =
    menuPreviewIndex.dataset.currentIndex ||
    menuPreviewIndex.textContent.trim();
  const currentTitle = menuPreviewTitle.textContent.trim();
  const previewChanged = currentIndex !== index || currentTitle !== title;

  menuPreviewIndex.dataset.currentIndex = index;
  menuPreviewTitle.classList.remove("is-changing");

  if (!previewChanged || reducedMotion.matches) {
    menuPreviewIndex.textContent = index;
    menuPreviewTitle.textContent = title;
    return;
  }

  menuPreviewIndex.textContent = index;
  menuPreviewTitle.textContent = title;
  void menuPreviewTitle.offsetWidth;
  menuPreviewTitle.classList.add("is-changing");

  menuPreviewMotionTimer = window.setTimeout(() => {
    menuPreviewTitle.classList.remove("is-changing");
    menuPreviewMotionTimer = 0;
  }, 520);
}

function syncMenuPreview(link) {
  if (!link?.dataset.navIndex || !menuPreviewIndex || !menuPreviewTitle) return;

  animateMenuPreviewCopy(
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
    menuPreviewImage.classList.remove("is-changing");
    requestAnimationFrame(() => menuPreviewImage.classList.add("is-changing"));
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
