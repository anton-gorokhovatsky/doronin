import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { validateProjectStatus } from "./project-status-validation.mjs";

const outputRoot = resolve(process.argv[2] || "preview");
const pages = [
  ["ru", resolve(outputRoot, "index.html")],
  ["en", resolve(outputRoot, "en/index.html")],
];
const failures = [];
const projectStatus = JSON.parse(
  await readFile(resolve("src/project-status.json"), "utf8"),
);
const projectStatusErrors = validateProjectStatus(projectStatus);
const analyticsRegistry = JSON.parse(
  await readFile(resolve("src/analytics-goals.json"), "utf8"),
);
const analyticsGoalIds = analyticsRegistry.goals.map(({ id }) => id);
const analyticsGoalIdSet = new Set(analyticsGoalIds);
const triggeredAnalyticsGoals = new Set();
const requiredAnalyticsGoals = [
  "menu_open",
  "chapter_navigation",
  "project_explore",
  "partner_interest",
  "language_switch",
  "theme_change",
  "hero_video_pause",
  "hero_video_resume",
  "proof_open",
  "sound_scene_select",
  "sound_story_start",
  "sound_story_complete",
  "diary_video_start",
  "diary_video_complete",
  "diary_open",
  "film_open",
  "contact_email",
  "contact_telegram",
];

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

for (const [lang, path] of pages) {
  const html = await readFile(path, "utf8");
  const embeddedAnalyticsRegistry = html.match(
    /<script type="application\/json" id="analytics-goal-registry">([^<]+)<\/script>/,
  )?.[1];
  const staticAnalyticsGoals = [
    ...html.matchAll(/\bdata-analytics-goal="([a-z0-9_-]+)"/g),
  ].map(([, goal]) => goal);
  for (const goal of staticAnalyticsGoals) {
    triggeredAnalyticsGoals.add(goal);
  }
  const textFragments = html
    .replace(/<svg[\s\S]*?<\/svg>/g, " ")
    .split(/<[^>]+>/g);
  const visibleText = html
    .replace(/<svg[\s\S]*?<\/svg>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t\r\n]+/g, " ");

  expect(
    html.includes(`<html lang="${lang}">`),
    `${lang}: неверный или отсутствующий lang`,
  );
  expect(
    (html.match(/<h1\b/g) || []).length === 1,
    `${lang}: на странице должен быть ровно один h1`,
  );
  expect(
    (html.match(/<link\b[^>]*\brel="stylesheet"/g) || []).length === 1,
    `${lang}: production должен загружать один собранный CSS`,
  );
  expect(
    [...html.matchAll(/<img\b[^>]*>/g)].every(([image]) =>
      /\balt="[^"]*"/.test(image),
    ),
    `${lang}: у каждого изображения должен быть alt`,
  );
  expect(
    !/[↗↑↓]/u.test(visibleText),
    `${lang}: текстовые стрелки должны быть заменены системными SVG-иконками`,
  );
  expect(
    !/(?:anesterova88@gmail\.com|@alraunean|\+7\s*903)/iu.test(visibleText),
    `${lang}: контактные данные не должны быть видимым текстом`,
  );
  expect(
    !textFragments.some((fragment) => /\d \d{3}(?:\D|$)/u.test(fragment)),
    `${lang}: разряды чисел должны разделяться узким неразрывным пробелом`,
  );
  expect(
    !/ — /u.test(visibleText),
    `${lang}: перед длинным тире нужен неразрывный пробел`,
  );
  expect(!/\.{3}/u.test(visibleText), `${lang}: использовать знак многоточия`);
  expect(
    (html.match(/class="icon icon--/g) || []).length >= 8,
    `${lang}: ожидаются единые SVG-иконки для действий`,
  );
  expect(
    /<header\b[\s\S]*?<details class="nav-shell"[\s\S]*?<\/header>[\s\S]*?<section class="hero"[\s\S]*?class="hero__media-toggle"/u.test(
      html,
    ) &&
      !/<header\b[\s\S]*?class="hero__media-toggle"[\s\S]*?<\/header>/u.test(
        html,
      ),
    `${lang}: меню относится к шапке, а управление видео — к кадру первого экрана`,
  );
  const headerNavigation =
    html.match(/<nav class="site-nav"[\s\S]*?<\/nav>/u)?.[0] || "";
  const headerChapterTargets = [
    "#about",
    "#distance",
    "#viktor",
    "#proof",
    "#adventures",
    "#interviews",
    "#partners",
  ];
  expect(
    headerNavigation.includes('class="site-nav__live"') &&
      headerNavigation.includes('href="#diary"') &&
      (headerNavigation.match(/class="site-nav__link"/g) || []).length ===
        headerChapterTargets.length &&
      headerChapterTargets.every((target) =>
        headerNavigation.includes(`href="${target}"`),
      ),
    `${lang}: меню должно содержать отдельный живой дневник и семь реальных глав страницы`,
  );
  expect(
    html.includes('<details class="nav-shell">') &&
      !html.includes('<details class="nav-shell" open>'),
    `${lang}: оглавление должно открываться по запросу, а не занимать шапку списком по умолчанию`,
  );
  const heroMediaControls =
    html.match(
      /<div class="hero__media-controls">([\s\S]*?)<\/div>/u,
    )?.[1] || "";
  expect(
    heroMediaControls.includes("data-video-toggle") &&
      !heroMediaControls.includes("data-sound-toggle") &&
      html.includes('class="audio-story"') &&
      html.includes("data-sound-player") &&
      !html.includes('class="audio-story__toggle"') &&
      (html.match(/\bdata-scene-index="/g) || []).length === 5 &&
      (html.match(/class="audio-story__wave"/g) || []).length === 5 &&
      (html.match(/assets\/audio-scene-\d{2}\.m4a/g) || []).length === 6,
    `${lang}: видео и пятичастная звуковая история должны оставаться двумя независимыми сценариями`,
  );
  const heroVideoTag =
    html.match(/<video\b[^>]*\bdata-hero-video\b[^>]*>/su)?.[0] || "";
  expect(
    /\bmuted\b/u.test(heroVideoTag) &&
      /\bplaysinline\b/u.test(heroVideoTag) &&
      /\bposter="[^"]+"/u.test(heroVideoTag) &&
      !/\bautoplay\b/u.test(heroVideoTag),
    `${lang}: фоновое видео должно запускаться только без звука и сохранять постерный fallback`,
  );
  expect(
    (html.match(/\bdata-theme-option="/g) || []).length === 6 &&
      !html.includes('class="header-theme"'),
    `${lang}: тема должна быть доступна в общем меню и подвале в трёх явных режимах без отдельного dropdown`,
  );
  expect(
    (html.match(/\bdata-status-day\b/g) || []).length === 31,
    `${lang}: шкала статуса должна отражать все 31 день проекта`,
  );
  expect(
    (html.match(/class="partner-format"/g) || []).length === 3 &&
      (html.match(/class="partner-process__step"/g) || []).length === 3 &&
      (html.match(/class="partner-proof__metric"/g) || []).length === 3,
    `${lang}: партнёрский сценарий должен содержать три формата, три шага и три доказательства`,
  );
  expect(
    html.includes('id="interviews"') &&
      (html.match(/class="interview-card(?:\s|")/g) || []).length === 8 &&
      (html.match(/interview-card--featured/g) || []).length === 1 &&
      (html.match(/interview-card--index/g) || []).length === 7,
    `${lang}: интервью должны содержать один главный выпуск и индекс остальных семи`,
  );
  expect(
    html.includes('class="partners__intro"') &&
      html.includes('class="partners__pitch"') &&
      html.includes('class="partners__offer"') &&
      html.includes('class="partners__closing"') &&
      html.includes('class="partners__cta"') &&
      html.includes("data-partner-countdown") &&
      html.indexOf('class="partner-formats"') <
        html.indexOf('class="partners__closing"'),
    `${lang}: партнёрский экран должен собираться из вводной, редакционной матрицы и общего финального блока`,
  );
  expect(
    !html.includes('class="partners__discussion"') &&
      (html.match(/class="partners__channels"[\s\S]*?<\/div>/u)?.[0].match(
        /<a\b/gu,
      ) || []).length === 2,
    `${lang}: финальный контакт должен выделять два канала связи без повтора партнёрских направлений`,
  );
  expect(
    html.includes('class="site-footer__after-credits"') &&
      html.includes("data-footer-countdown"),
    `${lang}: в подвале должна быть послетитровая реплика`,
  );
  expect(
    html.includes('id="diary"') &&
      html.includes("https://t.me/doroninvdele/484") &&
      html.includes("assets/diary-2026-03-23.mp4") &&
      html.includes("data-diary-video") &&
      html.includes("data-diary-video-play") &&
      (html.match(/class="diary__fact"/g) || []).length === 2 &&
      (html.match(/data-project-phase-item="/g) || []).length === 3,
    `${lang}: дневник должен содержать видео подтверждённого эпизода и три состояния проекта`,
  );
  expect(
    html.includes('class="proof-sources"') &&
      html.includes("https://vkvideo.ru/video-224465212_456239107") &&
      [87, 90, 91, 94, 97].every((suffix) =>
        html.includes(`https://vkvideo.ru/video-224465212_4562390${suffix}`),
      ),
    `${lang}: доказательный слой должен ссылаться на пять серий и фильм`,
  );
  expect(
    (html.match(/\bdata-sound-context="/g) || []).length === 5,
    `${lang}: каждая звуковая сцена должна иметь редакционный контекст`,
  );
  expect(
    staticAnalyticsGoals.every((goal) => analyticsGoalIdSet.has(goal)),
    `${lang}: HTML не должен отправлять цели вне единого реестра Метрики`,
  );
  expect(
    embeddedAnalyticsRegistry &&
      JSON.stringify(JSON.parse(embeddedAnalyticsRegistry)) ===
        JSON.stringify(analyticsRegistry),
    `${lang}: страница должна получать точный машиночитаемый реестр целей Метрики`,
  );
  expect(
    [...html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)].every(([link]) =>
      /\brel="noopener noreferrer"/.test(link),
    ),
    `${lang}: внешние ссылки в новой вкладке должны быть безопасными`,
  );

  if (lang === "ru") {
    expect(
      !textFragments.some((fragment) =>
        /(?<![\p{L}\p{N}])(?:а|в|во|до|за|и|из|к|ко|на|не|о|об|от|по|с|со|у) (?=[\p{L}\p{N}«])/u.test(
          fragment,
        ),
      ),
      "ru: короткие предлоги и союзы не должны оставаться в конце строки",
    );
    expect(
      visibleText.includes("в мире"),
      "ru: типограф должен связывать короткие предлоги со следующим словом",
    );
    expect(
      visibleText.includes("11 111 км"),
      "ru: масштаб проекта должен иметь типографские разделители",
    );
    expect(
      visibleText.includes("≈1,3 млн") &&
        visibleText.includes("92 000+") &&
        visibleText.includes("Проверено 31 июля 2026"),
      "ru: просмотры сериала и фильма должны быть актуальными и датированными",
    );
    expect(
      visibleText.includes("Экипировка") &&
        visibleText.includes("Технологии") &&
        visibleText.includes("Медиа"),
      "ru: названия партнёрских направлений должны оставаться короткими",
    );
    expect(
      visibleText.includes("Дневник подготовки") &&
        !visibleText.includes(">Дневник подготовки Виктора<"),
      "ru: послетитровая ссылка не должна повторять имя героя",
    );
    expect(
      visibleText.includes("О герое") &&
        visibleText.includes("Сообщество") &&
        visibleText.includes("Движение") &&
        visibleText.includes("Вместе") &&
        visibleText.includes("Фото — Женя Ханай") &&
        visibleText.includes("19 июня 2026"),
      "ru: фотосерия о герое должна сохранять утверждённые главы, авторство и даты",
    );
  } else {
    expect(
      !textFragments.some((fragment) =>
        /\b(?:a|an|and|at|by|for|in|of|on|or|the|to) (?=[A-Za-z0-9“])/u.test(
          fragment,
        ),
      ),
      "en: короткие служебные слова должны держаться со следующим словом",
    );
    expect(
      visibleText.includes("December 1, 2026"),
      "en: полная дата должна быть неразрывной",
    );
    expect(
      visibleText.includes("Equipment") &&
        visibleText.includes("Technology") &&
        visibleText.includes("Media"),
      "en: названия партнёрских направлений должны оставаться короткими",
    );
    expect(
      visibleText.includes("Training diary") &&
        !html.includes(">Viktor’s training diary<"),
      "en: послетитровая ссылка не должна повторять имя героя",
    );
    expect(
      visibleText.includes("≈1.3M") &&
        visibleText.includes("92,000+") &&
        visibleText.includes("Checked July 31, 2026"),
      "en: series and film views must be current and dated",
    );
    expect(
      visibleText.includes("About Viktor") &&
        visibleText.includes("Community") &&
        visibleText.includes("Motion") &&
        visibleText.includes("Together") &&
        visibleText.includes("Photography — Zhenya Khanai") &&
        visibleText.includes("June 19, 2026"),
      "en: the Viktor photo story must preserve the approved chapters, credit and dates",
    );
  }

  expect(
    !html.includes("fonts.googleapis.com") &&
      !html.includes("fonts.gstatic.com") &&
      !html.includes("family=Manrope"),
    `${lang}: основной шрифт должен загружаться локально без внешнего font-сервиса`,
  );
  expect(
    (html.match(/data-motion-option=/g) || []).length === 2 &&
      (html.match(/data-analytics-option=/g) || []).length === 2 &&
      (html.match(/data-theme-option=/g) || []).length === 6 &&
      (html.match(/data-language-switch/g) || []).length === 2,
    `${lang}: меню и подвал должны содержать полный набор локали, темы, движения и аналитики`,
  );
}

const css = await readFile(resolve(outputRoot, "assets/styles.css"), "utf8");
const app = await readFile(resolve(outputRoot, "assets/app.js"), "utf8");
for (const [, goal] of app.matchAll(/\breachGoal\("([a-z0-9_-]+)"/g)) {
  triggeredAnalyticsGoals.add(goal);
}
const styleModuleNames = [
  "00-foundations-navigation.css",
  "10-hero-audio.css",
  "20-editorial-distance-story.css",
  "30-proof-adventures-interviews.css",
  "40-partners-footer.css",
  "50-responsive.css",
  "60-themes-accessibility.css",
];
const sourceStyleManifest = await readFile(resolve("src/assets/styles.css"), "utf8");
const sourceStyleBundle = (
  await Promise.all(
    styleModuleNames.map((file) =>
      readFile(resolve("src/assets/styles", file), "utf8"),
    ),
  )
).join("");
const [logoSvg, faviconAdaptive, faviconLight, faviconDark] = await Promise.all(
  ["logo.svg", "favicon-adaptive.svg", "favicon-light.svg", "favicon-dark.svg"].map(
    (file) => readFile(resolve(outputRoot, `assets/${file}`), "utf8"),
  ),
);
const svgPaths = (svg) => [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map(([, path]) => path);
const normalizeCss = (value) => value.replace(/\s+/g, " ").trim();
const normalizedCss = normalizeCss(css);
const productionGlassMaterial = normalizeCss(`
  --glass-material:
    linear-gradient(135deg, rgba(18, 67, 49, 0.26), rgba(2, 24, 17, 0.18)),
    linear-gradient(rgba(241, 245, 237, 0.035), rgba(241, 245, 237, 0)),
    linear-gradient(rgba(2, 30, 21, 0.72), rgba(2, 24, 17, 0.72));
  --glass-border: rgba(217, 226, 217, 0.24);
  --glass-filter: blur(22px) saturate(1.16);
  --glass-shadow: 0 1.25rem 3.5rem rgba(0, 0, 0, 0.18);
`);
const audioStoryRule = css.match(/\.audio-story\s*\{([^}]*)\}/s)?.[1] || "";
const diaryRule = css.match(/\.diary\s*\{([^}]*)\}/s)?.[1] || "";
const mobileNavLinkRules = [
  ...css.matchAll(/\.site-nav__link\s*\{([^}]*)\}/gs),
].map(([, rule]) => rule);

expect(
  sourceStyleManifest ===
    `${styleModuleNames.map((file) => `@import "./styles/${file}";`).join("\n")}\n` &&
    sourceStyleBundle === css,
  "css: семь исходных модулей должны без дрейфа собираться в один production styles.css",
);
expect(
  projectStatusErrors.length === 0 &&
    app.includes("[data-status-update-text]") &&
    app.includes("[data-status-source]") &&
    app.includes("dataset.liveSourceUrl"),
  `status: схема, локали, HTTPS-источник и вывод подтверждённого обновления должны быть валидны${projectStatusErrors.length ? ` (${projectStatusErrors.join("; ")})` : ""}`,
);
expect(
  css.includes("hanging-punctuation: first allow-end last"),
  "css: отсутствует progressive enhancement для висячей пунктуации",
);
expect(
  /--type-display-hero:\s*clamp\([^;]*calc\(/s.test(css) &&
    /--type-display-section:\s*clamp\([^;]*calc\(/s.test(css) &&
    /--type-metric-total:\s*clamp\([^;]*calc\(/s.test(css),
  "css: display-заголовки и метрики должны зависеть от rem и viewport",
);
expect(
  /font-family:\s*"Commissioner"[\s\S]*?Commissioner-Cyrillic\.woff2[\s\S]*?font-weight:\s*400 800/s.test(
    css,
  ) &&
    /font-family:\s*"Commissioner"[\s\S]*?Commissioner-Latin\.woff2[\s\S]*?font-weight:\s*400 800/s.test(
      css,
    ),
  "css: Commissioner должен быть локальным variable-шрифтом для кириллицы и латиницы",
);
expect(
  css.includes("text-wrap: balance") && css.includes("text-wrap: pretty"),
  "css: отсутствуют правила балансировки заголовков и абзацев",
);
expect(
  app.includes('statusTimeline = "calendar"') &&
    app.includes("now.getMonth() + 1"),
  "js: предстартовая шкала должна показывать текущий календарный месяц",
);
expect(
  css.includes(
    '.event-status__rail[data-status-timeline="calendar"] span:nth-child(12)',
  ),
  "css: декабрь должен завершать календарную шкалу красной зоной",
);
expect(
  css.includes(".button:hover .icon--down") &&
    css.includes(".button:hover .icon--external") &&
    !css.includes(".button:hover .icon {"),
  "css: направление hover-анимации должно зависеть от смысла SVG-иконки",
);
expect(
  css.includes(".contacts a:hover") &&
    css.includes(".site-footer__utility a:hover"),
  "css: текстовые действия должны иметь единое hover-состояние",
);
expect(
  css.includes(".site-footer__cta:hover") &&
    css.includes(".partners__channels a:hover") &&
    css.includes(".interview-card:hover h3"),
  "css: партнёрские и редакционные действия должны иметь ясное интерактивное состояние",
);
expect(
  css.includes(".diary__media") &&
    css.includes(".proof-sources__grid") &&
    css.includes(".interview-card--index .interview-card__media") &&
    css.includes(".partner-process__list"),
  "css: дневник, источники, мобильный индекс интервью и партнёрский процесс должны быть оформлены",
);
expect(
  normalizedCss.split(productionGlassMaterial).length === 3 &&
    (css.match(/background:\s*var\(--glass-material\)/g) || []).length >= 7 &&
    css.includes(".site-header:has(.nav-shell[open])::before") &&
    !css.includes("--panel-material:") &&
    !css.includes("--glass-surface-soft:") &&
    !css.includes("--glass-surface-strong:"),
  "css: материал должен буквально совпадать с production-рецептом во всех темах",
);
expect(
  [faviconAdaptive, faviconLight, faviconDark].every(
    (svg) =>
      svg.includes('viewBox="0 0 512 231"') &&
      JSON.stringify(svgPaths(svg)) === JSON.stringify(svgPaths(logoSvg)),
  ) &&
    faviconAdaptive.includes("prefers-color-scheme: dark") &&
    faviconLight.includes('fill="#000"') &&
    faviconDark.includes('fill="#fff"'),
  "favicon: полный знак из logo.svg должен сохранять точный кроп и контраст в system/light/dark",
);
expect(
  /border-top:\s*1px solid var\(--line-light\)/.test(audioStoryRule) &&
    !/border-bottom:/.test(audioStoryRule) &&
    /padding-top:\s*clamp\(2\.75rem,\s*4\.5vw,\s*4\.5rem\)/.test(
      diaryRule,
    ) &&
    mobileNavLinkRules.some((rule) => /border:\s*0/.test(rule)) &&
    !/\.site-nav__live\s*\{[^}]*border-bottom:\s*1px solid var\(--line-light\)/s.test(
      css,
    ) &&
    !/\.site-nav__utility\s*\{[^}]*border-top:\s*1px solid var\(--line-light\)/s.test(
      css,
    ) &&
    /\.partners::before\s*\{[^}]*grid-row:\s*1\s*\/\s*4/s.test(css) &&
    /\.partners::after\s*\{[^}]*grid-row:\s*1\s*\/\s*4/s.test(css),
  "css: разделители должны оставаться только на смысловых границах без двойной линии audio → diary",
);
expect(
  (css.match(/:root\.theme-dark\s*\{/g) || []).length === 1 &&
    !css.includes(':root[data-theme="dark"]') &&
    !css.includes("@media (prefers-color-scheme: dark)") &&
    app.includes("syncResolvedTheme") &&
    app.includes('classList.toggle(\n    "theme-dark"'),
  "theme: ночные токены должны иметь один источник и единый resolved-theme класс",
);
expect(
  css.includes("@media (prefers-reduced-motion: reduce)") &&
    /matchMedia\(\s*"\(prefers-reduced-motion: reduce\)"\s*,?\s*\)/s.test(app) &&
    app.includes('classList.toggle(\n    "motion-reduced"') &&
    app.includes("heroVideo.pause()"),
  "motion: reduced-motion должен отключать автоматическое движение и останавливать первый экран",
);
expect(
  css.includes(":focus-visible") &&
    css.includes("outline: 3px solid var(--acid)"),
  "css: клавиатурный фокус должен оставаться заметным",
);
expect(
  css.includes('--body: "Commissioner"') &&
    css.includes("--sans: var(--body)") &&
    !css.includes('--body: "Manrope"'),
  "css: основной и нейтральный текстовые слои должны использовать Commissioner",
);
expect(
  analyticsRegistry.counterId === 111159425 &&
    new Set(analyticsGoalIds).size === analyticsGoalIds.length &&
    JSON.stringify([...analyticsGoalIds].sort()) ===
      JSON.stringify([...requiredAnalyticsGoals].sort()) &&
    analyticsGoalIds.every((goal) => triggeredAnalyticsGoals.has(goal)) &&
    [...triggeredAnalyticsGoals].every((goal) => analyticsGoalIdSet.has(goal)) &&
    analyticsRegistry.goals.every(
      ({ id, params }) =>
        /^[a-z0-9_-]+$/.test(id) &&
        Array.isArray(params) &&
        params.every(
          (param) =>
            ["chapter", "language", "location", "scene", "theme"].includes(
              param,
            ),
        ),
    ) &&
    app.includes("analyticsSafeValue") &&
    app.includes("analyticsGoals.get(goal)") &&
    app.includes("https://mc.yandex.ru/metrika/tag.js?id=") &&
    app.includes('window.ym(analyticsRegistry.counterId, "init"') &&
    app.includes('window.ym(analyticsRegistry.counterId, "destruct"') &&
    app.includes('localStorage.getItem("analytics") !== "off"'),
  "analytics: полный privacy-safe реестр должен точно совпадать с реальными HTML/JS-триггерами",
);
expect(
  app.includes('diaryVideoFrame.classList.add("has-custom-control")') &&
    app.includes("diaryVideo.controls = true"),
  "js: фирменный запуск дневника должен прогрессивно возвращать нативное управление",
);
expect(
  app.includes("heroVideoSources") &&
    app.includes('source.addEventListener("error", handleHeroVideoSourceError)') &&
    app.includes("videoToggle.hidden = true"),
  "js: отказ всех подходящих hero-video источников должен оставлять постер без ложного управления",
);
expect(
  app.includes("document.body.dataset.projectPhase = projectPhase") &&
    app.includes("phaseFixtureDates") &&
    app.includes("localFixtureHost") &&
    app.includes("document.body.dataset.phaseFixture = phaseFixture") &&
    app.includes('requestedTextScale === "200"') &&
    css.includes('html[data-text-fixture="200"]') &&
    app.includes("[data-project-phase-item]") &&
    app.includes("[data-phase-copy]"),
  "js: подготовка, 31 день и архив должны иметь три состояния и локальные детерминированные fixtures",
);

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Content, typography, and structure checks passed.");
}
