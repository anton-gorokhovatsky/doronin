import { access, readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { createDiaryContent } from "./content/diary/index.mjs";
import { validateProjectPlan } from "./project-plan-validation.mjs";
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
const projectPlan = JSON.parse(
  await readFile(resolve("src/project-plan.json"), "utf8"),
);
const projectStatusErrors = validateProjectStatus(projectStatus);
const projectPlanErrors = validateProjectPlan(projectPlan);
const analyticsRegistry = JSON.parse(
  await readFile(resolve("src/analytics-goals.json"), "utf8"),
);
const analyticsGoalIds = analyticsRegistry.goals.map(({ id }) => id);
const analyticsGoalIdSet = new Set(analyticsGoalIds);
const analyticsDocumentation = await readFile(
  resolve("docs/analytics-goals.md"),
  "utf8",
);
const documentedAnalyticsGoalIds = [
  ...analyticsDocumentation.matchAll(/`([a-z][a-z0-9_]+)`/g),
].map(([, goal]) => goal);
const triggeredAnalyticsGoals = new Set();
const requiredAnalyticsGoals = [
  "menu_open",
  "chapter_navigation",
  "project_explore",
  "partner_interest",
  "diary_explore",
  "language_switch",
  "theme_change",
  "hero_video_pause",
  "hero_video_resume",
  "presence_audio_start",
  "proof_open",
  "diary_video_start",
  "diary_video_complete",
  "diary_open",
  "calendar_open",
  "diary_follow",
  "film_open",
  "contact_email",
  "contact_telegram",
];
const retiredProductionAssets = [
  "audio-scene-02.m4a",
  "audio-scene-03.m4a",
  "distance-bike-motion.mp4",
  "distance-bike-presence.mp4",
  "distance-run-motion.mp4",
  "distance-run-presence.mp4",
  "distance-swim-motion.mp4",
  "distance-swim-presence.mp4",
  "effort-breath.mp3",
];
const diaryByLocale = {
  ru: createDiaryContent("ru"),
  en: createDiaryContent("en"),
};

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findAnchorByClass(html, className) {
  return html.match(
    new RegExp(
      `<a\\b[^>]*class="[^"]*\\b${escapeRegExp(className)}\\b[^"]*"[^>]*>[\\s\\S]*?<\\/a>`,
      "u",
    ),
  )?.[0] || "";
}

function compactMarkupText(markup) {
  return markup
    .replace(/<svg[\s\S]*?<\/svg>/gu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

async function listRelativeFiles(root, relativeRoot = "") {
  const entries = await readdir(resolve(root, relativeRoot), {
    withFileTypes: true,
  });
  const files = [];
  for (const entry of entries) {
    const relativePath = relativeRoot
      ? `${relativeRoot}/${entry.name}`
      : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await listRelativeFiles(root, relativePath)));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files;
}

for (const asset of retiredProductionAssets) {
  try {
    await access(resolve(outputRoot, "assets", asset));
    failures.push(`production: устаревший файл ${asset} не должен попадать в новую сборку`);
  } catch {
    // Expected: the accepted triathlon assets only live in doronin-og and Git history.
  }
}

for (const [lang, path] of pages) {
  const html = await readFile(path, "utf8");
  const diary = diaryByLocale[lang];
  const diaryFactCount = diary.entries.reduce(
    (total, entry) => total + entry.facts.length,
    0,
  );
  const diaryVideoCount = diary.entries.filter((entry) => entry.video).length;
  const diaryImageCount = diary.entries.length - diaryVideoCount;
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
  const semanticNumberText = [
    html
      .replace(/<(?:script|style)\b[\s\S]*?<\/(?:script|style)>/giu, " ")
      .replace(/<svg[\s\S]*?<\/svg>/giu, " ")
      .replace(/<[^>]+>/g, " "),
    ...[...html.matchAll(/\b(?:alt|aria-label)="([^"]*)"/gu)].map(
      ([, value]) => value,
    ),
  ]
    .join(" ")
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
    !(lang === "ru"
      ? /(?<!\d)\d[\u00A0\u202F]\d{3}(?!\d)/u
      : /(?<!\d)\d,\d{3}(?!\d)/u
    ).test(semanticNumberText),
    `${lang}: четырёхзначные числа должны писаться слитно`,
  );
  expect(
    !/(?<!\d)\d{5}(?!\d)/u.test(semanticNumberText),
    `${lang}: в пятизначных числах нужен локальный неразрывный разделитель после двух знаков`,
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
    headerNavigation.includes('class="site-nav__diary"') &&
      headerNavigation.includes('href="#diary"') &&
      (headerNavigation.match(/class="site-nav__link"/g) || []).length ===
        headerChapterTargets.length &&
      headerChapterTargets.every((target) =>
        headerNavigation.includes(`href="${target}"`),
      ),
    `${lang}: меню должно содержать отдельный живой дневник и семь реальных глав страницы`,
  );
  const actionCopy =
    lang === "ru"
      ? {
          explore: "Посмотреть форматы участия",
          discuss: "Обсудить участие",
          email: "Написать по почте",
          telegram: "Написать в Telegram",
        }
      : {
          explore: "View partnership options",
          discuss: "Discuss a partnership",
          email: "Send an email",
          telegram: "Message on Telegram",
        };
  const heroPartnerAction = findAnchorByClass(html, "button--primary");
  const discussionActions = [
    findAnchorByClass(html, "header-cta"),
    findAnchorByClass(html, "site-nav__cta"),
    findAnchorByClass(html, "site-footer__cta"),
  ];
  const contactActions = [
    ...html.matchAll(
      /<a\b[^>]*class="[^"]*\bcontact-action\b[^"]*"[^>]*>[\s\S]*?<\/a>/gu,
    ),
  ].map(([anchor]) => anchor);
  expect(
    heroPartnerAction.includes('href="#partners"') &&
      heroPartnerAction.includes('data-analytics-goal="partner_interest"') &&
      heroPartnerAction.includes('icon--down') &&
      compactMarkupText(heroPartnerAction) === actionCopy.explore,
    `${lang}: действие первого экрана должно вести к форматам участия и буквально называть этот переход`,
  );
  expect(
    discussionActions.every(
      (anchor) =>
        anchor.includes('href="#partner-contact"') &&
        anchor.includes('data-analytics-goal="partner_interest"') &&
        compactMarkupText(anchor) === actionCopy.discuss,
    ) &&
      discussionActions[1].includes('icon--down') &&
      discussionActions[2].includes('icon--up'),
    `${lang}: каждое действие обсуждения участия должно вести в один контактный модуль с направленной SVG-иконкой`,
  );
  expect(
    contactActions.length === 2 &&
      contactActions[0].includes('href="mailto:') &&
      contactActions[0].includes('data-analytics-goal="contact_email"') &&
      compactMarkupText(contactActions[0]) === actionCopy.email &&
      contactActions[1].includes('href="https://t.me/') &&
      contactActions[1].includes('data-analytics-goal="contact_telegram"') &&
      compactMarkupText(contactActions[1]) === actionCopy.telegram,
    `${lang}: почта и Telegram должны оставаться двумя явно названными внешними каналами`,
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
      !heroMediaControls.includes("data-sound-toggle"),
    `${lang}: управление фоновым видео должно оставаться отдельным контролом первого экрана`,
  );
  const distanceIndex = html.indexOf('id="distance"');
  const presenceIndex = html.indexOf('id="presence"');
  const athleteIndex = html.indexOf('id="viktor"');
  expect(
    presenceIndex > distanceIndex &&
      athleteIndex > presenceIndex &&
      html.includes('class="audio-story"') &&
      html.includes("data-presence-player") &&
      (html.match(/\bdata-presence-scene\b/g) || []).length === 3 &&
      (html.match(/\bdata-presence-context\b/g) || []).length === 3 &&
      html.includes("audio-scene-01.m4a") &&
      html.includes("audio-scene-04.m4a") &&
      html.includes("audio-scene-05.m4a") &&
      !html.includes("audio-scene-02.m4a") &&
      !html.includes("audio-scene-03.m4a"),
    `${lang}: глава присутствия должна стоять между календарём и портретом, оставаться добровольной и содержать только три уместные архивные сцены`,
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
      (html.match(/class="partner-proof__link"/g) || []).length === 1,
    `${lang}: партнёрский сценарий должен содержать три формата, три шага и одну ссылку на доказательства`,
  );
  expect(
    html.includes('id="interviews"') &&
      html.includes('class="interviews__archive"') &&
      html.includes('class="interview-grid interview-grid--archive"') &&
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
      html.includes('class="diary-live"') &&
      html.includes("data-diary-countdown") &&
      html.includes('data-analytics-goal="diary_follow"') &&
      html.includes('id="diary-archive"') &&
      diary.entries.every(
        (entry) =>
          html.includes(entry.href) &&
          (!entry.video || html.includes(`assets/${entry.video}`)) &&
          html.includes(`assets/${entry.image}`),
      ) &&
      (html.match(/data-diary-video(?=\s|>)/g) || []).length ===
        diaryVideoCount &&
      (html.match(/data-diary-video-play(?=\s|>)/g) || []).length ===
        diaryVideoCount &&
      (html.match(/data-diary-image(?=\s|>)/g) || []).length ===
        diaryImageCount &&
      html.includes("data-diary-story-position-current") &&
      html.includes("data-diary-story-newer") &&
      html.includes("data-diary-story-earlier") &&
      (html.match(/data-diary-story-tab(?=\s|>)/g) || []).length ===
        diary.entries.length &&
      (html.match(/data-diary-story-panel/g) || []).length ===
        diary.entries.length &&
      (html.match(/class="diary__fact"/g) || []).length === diaryFactCount &&
      (html.match(/data-project-phase-item="/g) || []).length === 3,
    `${lang}: дневник должен соединять живой путь к старту, все структурированные записи и три состояния проекта`,
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
    html.includes('class="bike-calendar"') &&
      html.includes('class="bike-calendar__details"') &&
      html.includes("data-calendar-details") &&
      html.includes('data-calendar-ready="false"') &&
      html.includes('data-calendar-near-days="30"') &&
      html.includes("data-calendar-current") &&
      (html.match(/data-calendar-phase-copy/g) || []).length === 2 &&
      (html.match(/class="bike-calendar__segment bike-calendar__segment--/g) || [])
        .length === projectPlan.segments.length &&
      (html.match(/id="calendar-segment-\d{2}"/g) || []).length ===
        projectPlan.segments.length &&
      (html.match(/<li style="--calendar-order:/g) || []).length ===
      projectPlan.specialSequenceKm.length &&
      projectPlan.specialSequenceKm.every((distance) =>
        html.includes(`>${distance}</strong>`),
      ),
    `${lang}: календарь должен оставлять пять вершин на поверхности и рендерить все сегменты плана в фазовом раскрытии`,
  );
  expect(
    (html.match(/class="bike-calendar__operator /g) || []).length === 2 &&
      html.includes('bike-calendar__operator--plus') &&
      html.includes('bike-calendar__operator--equals'),
    `${lang}: календарная формула должна сохранять оба видимых арифметических знака`,
  );
  expect(
    html.includes('class="hero-peaks"') &&
      (html.match(/data-date="2026-12-/g) || []).length === 5,
    `${lang}: первый экран должен показывать пять календарных вершин`,
  );
  expect(
    html.includes('class="bike-calendar__finish-date"') &&
      html.includes('class="bike-calendar__segment-detail bike-calendar__finish-detail"'),
    `${lang}: финиш должен объяснять последний календарный день, а не выглядеть новой дистанцией`,
  );
  expect(
    html.includes("54\u00a0×\u00a036"),
    `${lang}: передача 54 × 36 должна оставаться одним типографическим атомом`,
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
      ["13–14 декабря", "20–21 декабря", "29–30 декабря"].every(
        (range) => html.includes(range),
      ) && !/>\d{1,2}–\d{1,2} декабрь</u.test(html),
      "ru: диапазоны календаря должны использовать родительный падеж месяца",
    );
    expect(
      !textFragments.some((fragment) =>
        /(?<![\p{L}\p{N}])(?:а|в|во|до|за|и|из|к|ко|на|не|о|об|от|по|с|со|у) (?=[\p{L}\p{N}«])/u.test(
          fragment,
        ),
      ),
      "ru: короткие предлоги и союзы не должны оставаться в конце строки",
    );
    expect(
      !/\b(?:а|в|во|до|за|и|из|к|ко|на|не|о|об|от|по|с|со|у) (?=[\p{L}\p{N}«])/u.test(
        visibleText,
      ),
      "ru: типограф должен связывать короткие предлоги со следующим словом",
    );
    expect(
      visibleText.includes("11 111 км"),
      "ru: масштаб проекта должен иметь типографские разделители",
    );
    expect(
      visibleText.includes("≈1,3 млн") &&
        visibleText.includes("92,1 тыс.") &&
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
      visibleText.includes("Дневник пути к старту") &&
        visibleText.includes("Не ждать старта. Проходить путь вместе.") &&
        !visibleText.includes(">Дневник подготовки Виктора<"),
      "ru: живой дневник и послетитровая ссылка должны вести к пути без повтора имени героя",
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
      visibleText.includes("Road-to-start diary") &&
        visibleText.includes("Don’t just wait") &&
        visibleText.includes("Follow the road there.") &&
        !html.includes(">Viktor’s training diary<"),
      "en: the live diary and after-credits route must express the journey without repeating Viktor’s name",
    );
    expect(
      visibleText.includes("≈1.3M") &&
        visibleText.includes("92.1k") &&
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
    !headerNavigation.includes("data-motion-option") &&
      !headerNavigation.includes("data-analytics-option") &&
      (headerNavigation.match(/data-theme-option=/g) || []).length === 3 &&
      (headerNavigation.match(/data-language-switch/g) || []).length === 1 &&
      (html.match(/data-theme-option=/g) || []).length === 6 &&
      (html.match(/data-language-switch/g) || []).length === 2,
    `${lang}: полноэкранное меню должно оставлять только близко сгруппированные язык и тему, дублируемые в подвале`,
  );
}

const generatedHtml = (
  await Promise.all(pages.map(([, path]) => readFile(path, "utf8")))
).join("\n");
const css = await readFile(resolve(outputRoot, "assets/styles.css"), "utf8");
const app = await readFile(resolve(outputRoot, "assets/app.js"), "utf8");
const referencedAssetNames = new Set([
  ...`${generatedHtml}\n${css}`.matchAll(
    /\bassets\/([a-z0-9][a-z0-9._/-]*)/giu,
  ),
  ...css.matchAll(/url\(["']?\.\/([a-z0-9][a-z0-9._/-]*)/giu),
].map((match) => match[1]));
const builtAssetNames = await listRelativeFiles(resolve(outputRoot, "assets"));
const missingAssetNames = [...referencedAssetNames].filter(
  (assetName) => !builtAssetNames.includes(assetName),
);
const unreferencedAssetNames = builtAssetNames.filter(
  (assetName) => !referencedAssetNames.has(assetName),
);
for (const [, goal] of app.matchAll(/\breachGoal\("([a-z0-9_-]+)"/g)) {
  triggeredAnalyticsGoals.add(goal);
}
const styleModuleNames = [
  "00-foundations-navigation.css",
  "10-hero-audio.css",
  "20-editorial-distance-story.css",
  "21-diary-responsive.css",
  "25-bike-calendar.css",
  "30-proof-adventures-interviews.css",
  "31-proof-responsive.css",
  "40-partners-footer.css",
  "50-responsive.css",
  "55-editorial-menu.css",
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
const themeInitSource = await readFile(resolve("src/assets/theme-init.js"), "utf8");
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
const diaryRule = css.match(/\.diary\s*\{([^}]*)\}/s)?.[1] || "";
const mobileNavLinkRules = [
  ...css.matchAll(/\.site-nav__link\s*\{([^}]*)\}/gs),
].map(([, rule]) => rule);
const typographyRoleTokens = [
  "--type-display-hero",
  "--type-number-total",
  "--type-chapter",
  "--type-chapter-compact",
  "--type-copy",
  "--type-copy-lead",
  "--type-service",
  "--type-service-strong",
];
const retiredTypographyTokens = [
  "--type-micro",
  "--type-label",
  "--type-action",
  "--type-caption",
  "--type-body",
  "--type-body-large",
  "--type-lead",
  "--type-display-section",
  "--type-metric-",
];
const viewportOnlyTypeClamps =
  sourceStyleBundle.match(
    /font-size:\s*clamp\([^;]*,\s*-?(?:\d+\.?\d*|\.\d+)vw\s*,/g,
  ) || [];
const mobileMicraHeadingRule = css.match(
  /\.manifesto h2,\s*\.section-heading h2,\s*\.section-heading--compact > h2,\s*\.diary-live__copy h2,\s*\.athlete__copy h2,\s*\.proof h2,\s*\.interviews__heading h2,\s*\.partners h2,\s*\.partners__cta,\s*\.site-footer h2\s*\{([^}]*)\}/s,
)?.[1] || "";

expect(
  sourceStyleManifest ===
    `${styleModuleNames.map((file) => `@import "./styles/${file}";`).join("\n")}\n` &&
    sourceStyleBundle === css,
  "css: исходные модули должны без дрейфа собираться в один production styles.css",
);
expect(
  !/barlow|number-font-trial/i.test(
    `${sourceStyleManifest}\n${sourceStyleBundle}\n${themeInitSource}`,
  ),
  "typography: production должен использовать Micra без скрытого Barlow-режима",
);
expect(
  projectPlanErrors.length === 0 &&
    validateProjectPlan({ ...projectPlan, unconfirmedFacts: [] }).length === 0 &&
    projectPlan.targetDistanceKm === 11111 &&
    projectPlan.specialSequenceKm.join("→") === "333→555→777→999→1111",
  `plan: календарь, сумма и последовательность специальных этапов должны проходить каноническую проверку${projectPlanErrors.length ? ` (${projectPlanErrors.join("; ")})` : ""}`,
);
expect(
  projectStatusErrors.length === 0 &&
    app.includes("[data-status-update-text]") &&
    app.includes("[data-status-source]") &&
    app.includes("dataset.liveSourceUrl"),
  `status: схема, локали, HTTPS-источник и вывод подтверждённого обновления должны быть валидны${projectStatusErrors.length ? ` (${projectStatusErrors.join("; ")})` : ""}`,
);
expect(
  css.includes("hanging-punctuation: first allow-end last") &&
    /@media \(max-width:\s*640px\)[\s\S]*?\.proof h2\s*\{[^}]*hanging-punctuation:\s*none/s.test(
      css,
    ),
  "css: висячая пунктуация должна оставаться progressive enhancement без выхода кавычек на мобильном proof-заголовке",
);
expect(
  typographyRoleTokens.every((token) =>
    new RegExp(`${token}:\\s*clamp\\([^;]*calc\\(`, "s").test(css),
  ) &&
    retiredTypographyTokens.every((token) => !sourceStyleBundle.includes(token)) &&
    viewportOnlyTypeClamps.length === 0 &&
    css.includes("--leading-chapter: 1.02") &&
    css.includes("--leading-copy: 1.55") &&
    css.includes("--measure-lead: 42ch") &&
    css.includes("--measure-copy: 62ch"),
  `typography: четыре роли должны иметь rem + viewport scale, общие интервалы и меры без старых токенов${viewportOnlyTypeClamps.length ? ` (${viewportOnlyTypeClamps.join("; ")})` : ""}`,
);
expect(
  css.includes('[data-optical-start][data-optical-leading="1"]') &&
    app.includes('document.querySelectorAll("[data-optical-start]")') &&
    css.includes("--micra-leading-one-shift"),
  "typography: крупные числа должны подключать единую оптическую компенсацию начальной единицы",
);
expect(
  css.includes("--leading-mobile-micra: 1.12") &&
    mobileMicraHeadingRule.includes(
      "line-height: var(--leading-mobile-micra)",
    ),
  "typography: крупные мобильные заголовки Micra должны использовать один проверенный интерлиньяж",
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
  /\.bike-calendar\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s.test(
    css,
  ) &&
    /\.bike-calendar__sequence\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(15,/s.test(
      css,
    ) &&
    /\.bike-calendar__sequence li:nth-child\(1\)\s*\{[^}]*grid-column:\s*span 3/s.test(
      css,
    ) &&
    /\.bike-calendar__sequence li:nth-child\(3\)\s*\{[^}]*grid-column:\s*span 7/s.test(
      css,
    ) &&
    /\.bike-calendar__sequence li:nth-child\(5\)\s*\{[^}]*grid-column:\s*span 8/s.test(
      css,
    ) &&
    /\.bike-calendar__segment--finish\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/s.test(
      css,
    ) &&
    /\.bike-calendar__details\s*\{[^}]*border-top:\s*1px solid var\(--line-dark\)[^}]*border-bottom:\s*1px solid var\(--line-dark\)/s.test(
      css,
    ) &&
    /\.bike-calendar__details-body\s*\{[^}]*display:\s*grid[^}]*border-top:\s*1px solid var\(--line-dark\)/s.test(
      css,
    ) &&
    /@media \(max-width:\s*820px\)[\s\S]*?\.bike-calendar__sequence\s*\{[^}]*grid-template-columns:\s*1fr[^}]*width:\s*100%[^}]*min-width:\s*0/s.test(
      css,
    ),
  "css: календарь должен иметь фазовое раскрытие, одну колонку на mobile, две пропорциональные строки этапов и полноширинный финиш на desktop",
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
  /\.site-footer__nav\s*\{[^}]*grid-template-columns:\s*repeat\(2,[^}]*grid-template-rows:\s*auto repeat\(4,[^}]*grid-auto-flow:\s*column/s.test(
    sourceStyleBundle,
  ) &&
    /:root\.text-enlarged \.site-footer__nav\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)[^}]*grid-template-rows:\s*none[^}]*grid-auto-flow:\s*row/s.test(
      sourceStyleBundle,
    ),
  "css: навигация футера должна читаться 01–04 и 05–07 по колонкам, а при 200% — линейно",
);
expect(
  css.includes(".site-footer__cta:hover") &&
    css.includes(".partners__channels a:hover") &&
    css.includes(".interview-card:hover h3"),
  "css: партнёрские и редакционные действия должны иметь ясное интерактивное состояние",
);
expect(
  css.includes(".diary__media") &&
    css.includes(".diary__media > img") &&
    css.includes(".diary-stories__controls") &&
    css.includes(".proof-sources__grid") &&
    css.includes(".interview-card--index .interview-card__media") &&
    css.includes(".partner-process__list") &&
    css.includes("overscroll-behavior-x: none") &&
    css.includes("scroll-snap-stop: always") &&
    css.includes("touch-action: pan-x") &&
    generatedHtml.includes('data-diary-story-tab\n          draggable="false"') &&
    Object.values(diaryByLocale).every(
      (diary) =>
        generatedHtml.includes(`class="diary__range-count">${diary.rangeCount}`) &&
        generatedHtml.includes(`class="diary__range-start">${diary.rangeStart}`) &&
        generatedHtml.includes(`class="diary__range-end">${diary.rangeEnd}`),
    ),
  "css: дневник, источники, мобильный индекс интервью и партнёрский процесс должны быть оформлены",
);
expect(
  /\.hero__content\s*\{[^}]*position:\s*relative[^}]*z-index:\s*1[^}]*isolation:\s*isolate/s.test(
    css,
  ) &&
    /\.hero__kicker,\s*\.hero__intro\s*\{[^}]*z-index:\s*1[^}]*transform:\s*translateZ\(0\)/s.test(
      css,
    ) &&
    /\[data-footer-countdown-value\]\s*\{[^}]*justify-items:\s*end/s.test(
      css,
    ),
  "mobile: текст hero должен иметь стабильный paint-layer, а число футера — примыкать к подписи справа",
);
expect(
  /@media \(max-width:\s*640px\)[\s\S]*?\.hero__intro\s*\{[^}]*font-weight:\s*400/s.test(
    css,
  ) &&
    /\.audio-story::before\s*\{[^}]*background:\s*var\(--line-light\)/s.test(
      css,
    ),
  "mobile: вводный текст hero должен быть обычного веса, а граница звуковой главы — без отдельного кислотного рудимента",
);
expect(
  normalizedCss.split(productionGlassMaterial).length === 3 &&
    (css.match(/background:\s*var\(--glass-material\)/g) || []).length >= 6 &&
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
  !app.includes("data-sound-player") &&
    app.includes("data-presence-player") &&
    !app.includes("data-distance-story") &&
    !app.includes("data-distance-total") &&
    generatedHtml.includes("audio-scene-01.m4a") &&
    generatedHtml.includes("audio-scene-04.m4a") &&
    generatedHtml.includes("audio-scene-05.m4a") &&
    !generatedHtml.includes("audio-scene-02.m4a") &&
    !generatedHtml.includes("audio-scene-03.m4a") &&
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
    /\.partners__stage\s*\{[^}]*isolation:\s*isolate/s.test(css) &&
    /\.partners__stage-media\s*\{[^}]*position:\s*absolute/s.test(css) &&
    !/\.partners::(?:before|after)\s*\{[^}]*grid-row:/s.test(css),
  "css: удалённые триатлонные сценарии не должны оставаться в JS/HTML, а разделители — дублировать смысловые границы",
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
            ["chapter", "language", "location", "phase", "theme"].includes(
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
  new Set(documentedAnalyticsGoalIds).size === documentedAnalyticsGoalIds.length &&
    JSON.stringify([...documentedAnalyticsGoalIds].sort()) ===
      JSON.stringify([...analyticsGoalIds].sort()),
  "analytics: человекочитаемая документация должна перечислять ровно цели машиночитаемого реестра",
);
expect(
  missingAssetNames.length === 0 && unreferencedAssetNames.length === 0,
  `build: production должен содержать ровно используемые HTML/CSS-ассеты${missingAssetNames.length ? `; отсутствуют: ${missingAssetNames.join(", ")}` : ""}${unreferencedAssetNames.length ? `; не используются: ${unreferencedAssetNames.join(", ")}` : ""}`,
);
expect(
  app.includes('diaryStories.classList.add("has-diary-stories")') &&
    app.includes('storyTab.setAttribute("aria-selected", String(isActive))') &&
    app.includes("syncDiaryStoryNavigation") &&
    app.includes("[data-diary-story-earlier]") &&
    app.includes('document.querySelectorAll("[data-diary-video]")') &&
    app.includes('diaryVideoFrame.classList.add("has-custom-control")') &&
    app.includes("diaryVideo.controls = true"),
  "js: дневник должен переключать доступные записи и прогрессивно возвращать нативное управление видео",
);
expect(
  app.includes("heroVideoSources") &&
    app.includes('source.addEventListener("error", handleHeroVideoSourceError)') &&
    app.includes("videoToggle.hidden = true"),
  "js: отказ всех подходящих hero-video источников должен оставлять постер без ложного управления",
);
expect(
  app.includes("document.body.dataset.projectPhase = projectPhase") &&
    app.includes("document.body.dataset.calendarPhase = calendarPhase") &&
    app.includes("phaseFixtureDates") &&
    app.includes('near: "2026-11-15T12:00:00+03:00"') &&
    app.includes('calendarFixture === "confirmed"') &&
    app.includes('calendarPhase === "near" && calendarReady') &&
    app.includes('segment.setAttribute("aria-current", "step")') &&
    app.includes('reachGoal("calendar_open", { phase: calendarPhase })') &&
    app.includes("localFixtureHost") &&
    app.includes("document.body.dataset.phaseFixture = phaseFixture") &&
    app.includes('requestedTextScale === "200"') &&
    css.includes('html[data-text-fixture="200"]') &&
    app.includes("[data-project-phase-item]") &&
    app.includes("[data-phase-copy]"),
  "js: календарь должен различать дальнюю и ближнюю подготовку, текущий этап и архив с локальными детерминированными fixtures",
);

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Content, typography, and structure checks passed.");
}
