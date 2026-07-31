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
}
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

function reachGoal(goal, params = {}) {
  const definition = analyticsGoals.get(goal);

  if (!definition || typeof window.ym !== "function") {
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

const proofSources = document.querySelector(".proof-sources");

if (proofSources) {
  const proofSourcesSummary = proofSources.querySelector("summary");
  let proofSourcesRestoreFrame = 0;
  let proofSourcesPreviousScrollBehavior = null;

  function stopProofSourcesRestoration() {
    if (proofSourcesRestoreFrame) {
      cancelAnimationFrame(proofSourcesRestoreFrame);
      proofSourcesRestoreFrame = 0;
    }

    if (proofSourcesPreviousScrollBehavior !== null) {
      document.documentElement.style.scrollBehavior =
        proofSourcesPreviousScrollBehavior;
      proofSourcesPreviousScrollBehavior = null;
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
    root.style.scrollBehavior = "auto";
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
        stopProofSourcesRestoration();
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
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

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
  syncSoundControls();
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
  const distanceSequenceCurrent = distanceStory.querySelector(
    "[data-distance-sequence-current]",
  );
  const distanceSaveData = navigator.connection?.saveData === true;
  let activeDistanceIndex = 0;
  let distanceStoryVisible = false;

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

    if (distanceSequenceCurrent) {
      distanceSequenceCurrent.textContent = activeCard.dataset.distanceIndex;
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
    footerStatusText = `${days} ${form.replace(
      eventStatus.dataset.lang === "ru"
        ? /\s+до\s+старта$/u
        : /\s+to\s+start$/u,
      "",
    )}`;
  } else if (now < end) {
    const projectDay = Math.min(31, Math.floor((now - start) / day) + 1);
    progressSegments = projectDay;
    showLiveUpdate = true;
    footerPrefixMode = "active";
    projectPhase = "active";
    value.textContent = String(projectDay).padStart(2, "0");
    label.textContent = eventStatus.dataset.active;
    footerStatusText = `${value.textContent} ${label.textContent}`;
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

  const footerCountdown = document.querySelector("[data-footer-countdown]");
  const footerPrefix = document.querySelector("[data-footer-prefix]");

  if (footerCountdown) {
    footerCountdown.textContent = footerStatusText;
    syncOpticalStart(footerCountdown);
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

const diaryVideo = document.querySelector("[data-diary-video]");
const diaryVideoPlay = document.querySelector("[data-diary-video-play]");
const diaryVideoFrame = diaryVideo?.closest(".diary__media");

if (diaryVideo) {
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

function syncNavigationMode() {
  for (const navigation of document.querySelectorAll(".nav-shell")) {
    navigation.removeAttribute("open");
  }
}

syncNavigationMode();
desktopNavigation.addEventListener?.("change", syncNavigationMode);

for (const navigation of document.querySelectorAll(".nav-shell")) {
  navigation.addEventListener("toggle", () => {
    if (navigation.open) {
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
  if (event.key === "Escape") {
    for (const navigation of document.querySelectorAll(".nav-shell[open]")) {
      navigation.removeAttribute("open");
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
  ...document.querySelectorAll(".site-nav [data-nav-track]"),
];
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
