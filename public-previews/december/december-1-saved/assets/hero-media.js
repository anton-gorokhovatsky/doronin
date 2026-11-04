function setupHeroMedia(reducedMotion, reachGoal = () => {}) {
  // The same approved hero runs on the dated homepage and the permanent birthday page.
  // Confetti is a short burst, never a loop, and respects the shared motion preference.
  function setupBirthdayConfetti() {
    const root = document.documentElement;
    const greeting = document.querySelector(".birthday-greeting");
    const replay = document.querySelector("[data-birthday-replay]");
    const hero = greeting?.closest(".hero");
    const navigation = document.querySelector(".nav-shell");
    if (!hero || !replay || !root.classList.contains("has-birthday-greeting")) return;

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return;
    canvas.className = "birthday-confetti";
    canvas.setAttribute("aria-hidden", "true");
    canvas.hidden = true;
    hero.append(canvas);
    let frame = 0;

    function stop() {
      cancelAnimationFrame(frame);
      frame = 0;
      canvas.hidden = true;
    }

    function celebrate() {
      stop();
      if (reducedMotion.matches || document.hidden || navigation?.open ||
          !root.classList.contains("has-birthday-greeting")) return;
      const bounds = hero.getBoundingClientRect();
      const card = greeting.getBoundingClientRect();
      if (card.bottom < 0 || card.top > window.innerHeight) return;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(bounds.width * pixelRatio);
      canvas.height = Math.ceil(bounds.height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      const palette = getComputedStyle(greeting);
      const colors = ["--acid", "--paper", "--orange"].map(
        (name) => palette.getPropertyValue(name).trim(),
      );
      const pieces = Array.from({ length: bounds.width < 640 ? 84 : 140 }, (_, i) => {
        const angle = -Math.PI + Math.random() * Math.PI;
        const speed = 360 + Math.random() * 380;
        return {
          x: card.left - bounds.left + card.width * (i % 2 ? 0.9 : 0.1),
          y: card.top - bounds.top + card.height * 0.4,
          vx: Math.cos(angle) * speed * (bounds.width < 640 ? 0.65 : 1.3),
          vy: Math.sin(angle) * speed,
          delay: Math.random() * 0.24,
          size: 5 + Math.random() * 8,
          length: 1.3 + Math.random() * 1.5,
          rotation: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 14,
          color: colors[i % 7 < 4 ? 0 : i % 7 < 6 ? 1 : 2],
        };
      });
      const start = performance.now();
      canvas.hidden = false;

      function draw(now) {
        const elapsed = (now - start) / 1000;
        if (elapsed >= 4.6 || document.hidden || reducedMotion.matches ||
            !root.classList.contains("has-birthday-greeting")) {
          stop();
          return;
        }
        context.clearRect(0, 0, bounds.width, bounds.height);
        context.globalAlpha = Math.min(1, (4.6 - elapsed) / 0.8);
        for (const piece of pieces) {
          const t = elapsed - piece.delay;
          if (t < 0) continue;
          const x = piece.x + piece.vx * (1 - Math.exp(-t)) +
            Math.sin(t * 4 + piece.rotation) * 14 * t;
          const y = piece.y + piece.vy * t + 180 * t * t;
          context.save();
          context.translate(x, y);
          context.rotate(piece.rotation + piece.spin * t);
          context.scale(1, Math.max(0.16, Math.abs(Math.cos(t * 6 + piece.rotation))));
          context.fillStyle = piece.color;
          const w = piece.size;
          const h = w * piece.length;
          context.beginPath();
          context.moveTo(-w / 2, -h / 2);
          context.lineTo(w / 2, -h / 2);
          context.lineTo(w / 4, h / 2);
          context.lineTo(-w * 0.75, h / 2);
          context.closePath();
          context.fill();
          context.restore();
        }
        frame = requestAnimationFrame(draw);
      }
      frame = requestAnimationFrame(draw);
    }

    function syncMotion() {
      replay.hidden = reducedMotion.matches;
      if (reducedMotion.matches) stop();
    }
    syncMotion();
    replay.addEventListener("click", celebrate);
    navigation?.addEventListener("toggle", () => {
      if (navigation.open) stop();
    });
    reducedMotion.addEventListener("change", syncMotion);
    window.addEventListener("resize", stop, { passive: true });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop();
    });
    new MutationObserver(() => {
      if (!root.classList.contains("has-birthday-greeting")) stop();
    }).observe(root, { attributes: true, attributeFilter: ["class"] });
    document.fonts.ready.then(celebrate);
  }

  setupBirthdayConfetti();

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

    const regularPoster = heroVideo.getAttribute("poster");
    const regularSources = heroVideoSources.map(source => source.getAttribute("src"));
    let birthdayMode = null;
    function syncBirthdayVideo() {
      const active = document.documentElement.classList.contains("has-birthday-greeting");
      if (active === birthdayMode) return;
      const initialized = birthdayMode !== null;
      birthdayMode = active;
      if (!active && !initialized) return;
      document.querySelector(".hero").setAttribute("aria-labelledby", active ? "birthday-title" : "hero-title");
      heroVideo.poster = active ? heroVideo.dataset.birthdayPoster : regularPoster;
      for (const [index, source] of heroVideoSources.entries()) {
        source.src = active ? source.dataset.birthdaySrc : regularSources[index];
      }
      failedHeroVideoSources.clear();
      heroVideoUnavailable = false;
      videoToggle.hidden = false;
      heroVideo.load();
      if (initialized && !reducedMotion.matches && !userPausedVideo) playHeroVideo();
    }
    syncBirthdayVideo();
    new MutationObserver(syncBirthdayVideo).observe(document.documentElement, {
      attributes: true, attributeFilter: ["class"],
    });
    syncVideoToggle();

    if (!reducedMotion.matches && !heroVideoUnavailable) {
      playHeroVideo();
    }
  }
}
