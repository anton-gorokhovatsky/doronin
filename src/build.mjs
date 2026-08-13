import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createDiaryContent } from "./content/diary/index.mjs";
import { validateProjectPlan } from "./project-plan-validation.mjs";
import { validateProjectStatus } from "./project-status-validation.mjs";

const outputName = process.argv[2] || "preview";
const allowedOutputRoots = new Set([resolve("preview"), resolve("site")]);
const outputRoot = resolve(outputName);
if (!allowedOutputRoots.has(outputRoot)) {
  throw new Error("Build output must be either preview or site.");
}
const assetSource = resolve("src/assets");
const assetOutput = resolve(outputRoot, "assets");
const styleModulesRoot = resolve(assetSource, "styles");
const styleModuleNames = [
  "00-foundations-navigation.css",
  "10-hero-audio.css",
  "20-editorial-distance-story.css",
  "25-bike-calendar.css",
  "30-proof-adventures-interviews.css",
  "40-partners-footer.css",
  "50-responsive.css",
  "55-editorial-menu.css",
  "60-themes-accessibility.css",
];
const retiredAssetNames = new Set([
  "audio-scene-01.m4a",
  "audio-scene-02.m4a",
  "audio-scene-03.m4a",
  "audio-scene-04.m4a",
  "audio-scene-05.m4a",
  "distance-bike-motion.mp4",
  "distance-bike-presence.jpg",
  "distance-bike-presence.mp4",
  "distance-bike.jpg",
  "distance-run-motion.mp4",
  "distance-run-presence.jpg",
  "distance-run-presence.mp4",
  "distance-run.jpg",
  "distance-swim-motion.mp4",
  "distance-swim-presence.jpg",
  "distance-swim-presence.mp4",
  "distance-swim.jpg",
  "effort-breath.mp3",
  "velocity-run.jpg",
  "velocity-water.jpg",
]);
const styleBundle = (
  await Promise.all(
    styleModuleNames.map((file) => readFile(resolve(styleModulesRoot, file), "utf8")),
  )
).join("");
const projectStatus = JSON.parse(
  await readFile(resolve("src/project-status.json"), "utf8"),
);
const projectPlan = JSON.parse(
  await readFile(resolve("src/project-plan.json"), "utf8"),
);
const projectPlanErrors = validateProjectPlan(projectPlan);
if (projectPlanErrors.length) {
  throw new Error(
    `Invalid project plan:\n${projectPlanErrors.map((error) => `- ${error}`).join("\n")}`,
  );
}
const projectStatusErrors = validateProjectStatus(projectStatus);
if (projectStatusErrors.length) {
  throw new Error(
    `Invalid project status:\n${projectStatusErrors.map((error) => `- ${error}`).join("\n")}`,
  );
}
const analyticsRegistry = JSON.parse(
  await readFile(resolve("src/analytics-goals.json"), "utf8"),
);
const analyticsRegistryJson = JSON.stringify(analyticsRegistry).replace(
  /</g,
  "\\u003c",
);
const assetVersion = createHash("sha256")
  .update(styleBundle)
  .update(await readFile(resolve(assetSource, "app.js")))
  .update(await readFile(resolve(assetSource, "theme-init.js")))
  .digest("hex")
  .slice(0, 10);
const heroVideoVersion = createHash("sha256")
  .update(await readFile(resolve(assetSource, "hero-loop.mp4")))
  .update(await readFile(resolve(assetSource, "hero-loop-mobile.mp4")))
  .digest("hex")
  .slice(0, 10);
const editorialVideoVersion = createHash("sha256")
  .update(await readFile(resolve(assetSource, "story-recovery.mp4")))
  .digest("hex")
  .slice(0, 10);

await rm(outputRoot, { recursive: true, force: true });

const shared = {
  email: "anesterova88@gmail.com",
  telegramHref: "https://t.me/alraunean",
  viktorTelegramHref: "https://t.me/doroninvdele",
  viktorInstagramHref: "https://www.instagram.com/victordoronin/",
  filmHref: "https://vkvideo.ru/video-224465212_456239107",
  serialHrefs: [
    "https://vkvideo.ru/video-224465212_456239087",
    "https://vkvideo.ru/video-224465212_456239090",
    "https://vkvideo.ru/video-224465212_456239091",
    "https://vkvideo.ru/video-224465212_456239094",
    "https://vkvideo.ru/video-224465212_456239097",
  ],
  dustyDumbbellsHref: "https://dustydumbbells.com/",
  gastrodinamikaHref: "https://www.instagram.com/gstrdnmc/",
  photoHref: "https://khanayphoto.ru/",
  designHref: "https://anton-gorokhovatsky.github.io/design/",
  startDate: "2026-12-01",
  endDate: "2026-12-31",
};

const hasVerifiedProjectStatus =
  projectStatus.verified === true &&
  typeof projectStatus.updatedAt === "string" &&
  projectStatus.updatedAt.length > 0 &&
  Number.isFinite(projectStatus.distanceKm) &&
  projectStatus.distanceKm >= 0 &&
  ["ru", "en"].every(
    (lang) =>
      typeof projectStatus.discipline?.[lang] === "string" &&
      projectStatus.discipline[lang].length > 0,
  );

const locales = {
  ru: {
    lang: "ru",
    outputPath: "index.html",
    assetBase: "./",
    alternateHref: "./en/",
    alternateLabel: "EN",
    canonical: "https://11111.life/",
    alternateCanonical: "https://11111.life/en/",
    title: "11 111 км за 31 день — Виктор Доронин",
    description:
      "Виктор Доронин планирует преодолеть 11 111 км на велосипеде за декабрь: 22 базовых дня и пять специальных этапов от 333 до 1111 км.",
    socialImage: "https://11111.life/assets/share-ru.jpg",
    socialAlt: "11 111 км на велосипеде за 31 день. Виктор Доронин. Старт 1 декабря 2026 года.",
    skip: "Перейти к содержанию",
    homeLabel: "11 111 — на главную",
    menu: "Меню",
    menuClose: "Закрыть меню",
    navLiveKicker: "Сейчас",
    navLiveLabel: "Дневник",
    navRouteKicker: "Маршрут · 07 глав",
    navDiaryLabel: "Дневник пути к старту",
    navDiaryNote: "Оставшиеся дни, тренировки и решения Виктора",
    nav: [
      ["#about", "Проект"],
      ["#distance", "Календарь"],
      ["#viktor", "О герое"],
      ["#proof", "Фильм «1111»"],
      ["#adventures", "Приключения"],
      ["#interviews", "Интервью"],
      ["#partners", "Партнёрам"],
    ],
    headerCta: "Обсудить участие",
    hero: {
      kicker: "1–31 декабря 2026 · Виктор Доронин",
      lineOne: ["11 111", "км"],
      lineTwo: ["31", "день"],
      accent: "НА ВЕЛОСИПЕДЕ",
      intro:
        "Базовый ритм — 333 км в день. Пять специальных этапов поднимают дистанцию до финального этапа на 1111 км.",
      imageAlt: "Виктор Доронин на велосипеде во время скоростного заезда",
      videoPlay: "Включить видео",
      videoPause: "Пауза",
      primaryCta: "Обсудить участие",
      secondaryCta: "Следить за дневником",
      statusFallback: "Старт 1 декабря 2026",
      statusMeta: "11 111 км · 31 день",
      beforeForms: ["день до старта", "дня до старта", "дней до старта"],
      activeLabel: "день из 31",
      finishedLabel: "Плановый период проекта завершён",
      latestUpdate: "Последнее подтверждённое обновление",
      sourceLabel: "Источник",
      statusPending:
        "Подтверждённые данные появятся после обновления команды",
      footLabel: "Одна дистанция · пять вершин",
      footText: "333 → 555 → 777 → 999 → 1111",
    },
    diary: createDiaryContent("ru"),
    manifesto: {
      eyebrow: "Одна большая цель",
      title: "Проехать 11 111 километров за декабрь.",
      text:
        "Между вершинами Виктор возвращается к базовой дистанции. Три длиннейших этапа — 777, 999 и 1111 км — проходят как непрерывные заезды без деления на суточные части.",
    },
    distance: {
      eyebrow: "Декабрь 2026 · 31 день",
      title: "Календарь с нарастающей нагрузкой",
      intro:
        "Между специальными этапами остаются базовые блоки для рабочего ритма и подготовки к следующему испытанию.",
      totalLabel: "Общая дистанция",
      totalValue: "11 111",
      totalUnit: "км",
      specialLabel: "Специальный этап",
      baseLabel: "Базовый блок",
      finishLabel: "Финиш проекта",
      continuousLabel: "Один непрерывный заезд",
      oneDayLabel: "Один день",
      dailyLabel: "в день",
      totalBlockLabel: "за блок",
      baseSummary: "22 базовых дня",
      specialSummary: "5 специальных этапов",
      rideSummary: "30 дней движения",
      baseMetricLabel: "базовых дня",
      specialMetricLabel: "специальных этапов",
      rideMetricLabel: "дней движения",
      finishMetricLabel: "декабря · финиш проекта",
      rhythmTitle: "Базовая единица проекта — 333 км",
      rhythmText:
        "20 базовых дней — по 333 км; ещё два — по 338 км. Так до финала Виктор набирает ровно 10 000 км.",
      formulaLabel: "7336 плюс 3775 равно 11 111 километров",
      formulaBase: "7336",
      formulaSpecial: "3775",
      formulaResult: "11 111",
    },
    viktor: {
      eyebrow: "О герое",
      title: "Виктор Доронин",
      lead: "47 лет. Не создаёт образ — живёт в нём.",
      body: `Идеолог сообществ <a href="${shared.dustyDumbbellsHref}" target="_blank" rel="noopener noreferrer">«Пыльные гантели»</a> и&nbsp;<a href="${shared.gastrodinamikaHref}" target="_blank" rel="noopener noreferrer">«Гастродинамика»</a>, друг, мотиватор и&nbsp;спортсмен-любитель с опытом больших дистанций.`,
      imageAlt: "Виктор Доронин на дистанции в пустыне",
      achievements: [
        ["4×", "участник чемпионата мира WC Ironman Kona"],
        ["252,8 км", "Marathon des Sables в Сахаре"],
        ["17 696 м", "двойной Everesting за один заезд"],
        ["58 часов", "ультратриатлон 1111 км без сна"],
      ],
      quote: "История — не выдумка.<br>Это его жизнь.",
    },
    story: {
      label: "Тренировки, усилие и люди рядом",
      videoPlay: "Включить фрагмент",
      videoPause: "Пауза",
      credit: "Фото — Женя Ханай",
      dates: "22 мая — 19 июня 2026",
      items: [
        {
          image: "story-leads-community.jpg",
          width: "1800",
          height: "1200",
          alt: "Виктор Доронин стоит спиной к камере перед большой группой бегунов на стадионе",
          caption: "Сообщество",
          date: "2026-06-02",
          dateLabel: "2 июня 2026",
        },
        {
          image: "story-pace-close.jpg",
          width: "1400",
          height: "1800",
          alt: "Виктор Доронин бежит в группе по залитой солнцем дорожке",
          caption: "Темп",
          date: "2026-05-22",
          dateLabel: "22 мая 2026",
        },
        {
          image: "story-recovery.jpg",
          video: "story-recovery.mp4",
          width: "1600",
          height: "900",
          alt: "Виктор Доронин восстанавливается сразу после тяжёлого усилия",
          caption: "Цена усилия",
        },
        {
          image: "story-support.jpg",
          width: "1400",
          height: "1800",
          alt: "Улыбающийся Виктор Доронин пожимает руки участникам тренировки",
          caption: "Поддержка",
          date: "2026-05-31",
          dateLabel: "31 мая 2026",
        },
        {
          image: "story-motion-city.jpg",
          width: "3500",
          height: "2333",
          alt: "Виктор Доронин бежит рядом с другими спортсменами по залитой солнцем дорожке",
          caption: "Движение",
          date: "2026-06-19",
          dateLabel: "19 июня 2026",
        },
        {
          image: "story-community-wide.jpg",
          width: "1800",
          height: "1200",
          alt: "Виктор Доронин и большая группа участников тренировки позируют на стадионе",
          caption: "Вместе",
          date: "2026-06-02",
          dateLabel: "2 июня 2026",
        },
      ],
    },
    proof: {
      eyebrow: "Мы уже делали это",
      title: "Проект «1111» — доказанная формула",
      body:
        "Аудитория готова к длинным форматам. Честность работает лучше глянца. История продолжает жить после финиша.",
      metrics: [
        ["≈1,3 млн", "просмотров пяти серий и фильма"],
        ["92 000+", "просмотров фильма"],
        ["+310%", "рост аудитории героя"],
        ["25+", "федеральных СМИ"],
      ],
      filmCta: "Смотреть фильм о проекте «1111»",
      externalLabel: "Откроется ВКонтакте в новой вкладке",
      sourcesTitle: "Факты и источники",
      sourcesUpdated: "Проверено 31 июля 2026",
      sourceLabel: "Источники",
      sources: [
        {
          title: "≈1,3 млн просмотров",
          body:
            "Пять серий — 233, 239, 231, 231 и 273 тыс.; фильм — 92,1 тыс. Суммарно — около 1,299 млн просмотров.",
          links: [
            ["Серия 1", shared.serialHrefs[0]],
            ["Серия 2", shared.serialHrefs[1]],
            ["Серия 3", shared.serialHrefs[2]],
            ["Серия 4", shared.serialHrefs[3]],
            ["Серия 5", shared.serialHrefs[4]],
            ["Фильм", shared.filmHref],
          ],
        },
        {
          title: "Спортивная история Виктора",
          body:
            "Участие в чемпионатах мира Ironman и Marathon des Sables подтверждены описанием документального проекта.",
          links: [["Описание фильма", shared.filmHref]],
        },
        {
          title: "+310% и 25+ СМИ",
          body:
            "Результаты коммуникационной кампании проекта «1111» по данным команды проекта.",
          links: [],
        },
        {
          title: "Новый проект «11 111»",
          body:
            "Дистанция 11 111 км — отдельный велосипедный проект. Его календарный план опубликован выше; фактический результат будет зафиксирован после старта.",
          links: [],
        },
      ],
    },
    adventures: {
      eyebrow: "Не первый предел",
      title: "Другие приключения героя",
      watch: "Смотреть на YouTube",
      items: [
        {
          title: "Marathon des Sables 2024",
          meta: "252 км по пустыне Сахара",
          image: "adventure-marathon.jpg",
          href: "https://www.youtube.com/watch?v=OxE1IAUpjlc",
        },
        {
          title: "Tour de Kamyshin 2024",
          meta: "Виктор Доронин и супергерои · 500 км на велосипеде",
          image: "adventure-kamyshin.jpg",
          href: "https://www.youtube.com/watch?v=TtEKqOWKDV0",
        },
        {
          title: "Ладога",
          meta: "Трёхдневное велопутешествие по Ленинградской области",
          image: "adventure-ladoga.jpg",
          href: "https://www.youtube.com/watch?v=vxilFkecjYk",
        },
      ],
    },
    interviews: {
      eyebrow: "Интервью",
      title: "Своими словами",
      intro:
        "Разговоры, в которых видны опыт больших дистанций, работа над собой и способность собирать вокруг движения людей.",
      watch: "Смотреть интервью",
      items: [
        {
          title: "Проект «1111»: 58 часов без сна",
          source: "SPORTFERMA",
          image: "interview-01.jpg",
          href: "https://youtu.be/4H2fddBQ6VQ",
        },
        {
          title: "252 км по Сахаре",
          source: "Спорт-Марафон",
          image: "interview-02.jpg",
          href: "https://youtu.be/YKywKAqJF4I",
        },
        {
          title: "Гастродинамика: триатлон со вкусом",
          source: "Siberman",
          image: "interview-03.jpg",
          href: "https://youtu.be/FyYYLrvR-Hc",
        },
        {
          title: "Как трижды попасть на Кону",
          source: "Бег Вреден live",
          image: "interview-04.jpg",
          href: "https://youtu.be/Iggevbibf8w",
        },
        {
          title: "Dusty Диалоги",
          source: "Пыльные гантели",
          image: "interview-05.jpg",
          href: "https://youtu.be/FuHM9yD1fa4",
        },
        {
          title: "Пыльные гантели: как устроено сообщество",
          source: "SPORTFERMA",
          image: "interview-06.jpg",
          href: "https://youtu.be/xrOSk5OpYCA",
        },
        {
          title: "Зачем бегуну плавать и ездить на велосипеде",
          source: "RUN FAQ",
          image: "interview-07.jpg",
          href: "https://youtu.be/-tTE9Wk-kIo",
        },
        {
          title: "Полезные виды спорта для бегуна",
          source: "RUN FAQ",
          image: "interview-08.jpg",
          href: "https://youtu.be/c4Q4KwM5oVQ",
        },
      ],
    },
    partners: {
      eyebrow: "Партнёрам",
      title: "Пройти вместе",
      imageAlt: "Виктор Доронин среди участников бегового старта.",
      lead: "Не интеграция.<br>Общий путь.",
      body:
        "11 111 км начинаются задолго до первого километра. Мы приглашаем тех, кто хочет не наблюдать со стороны, а пройти эту историю вместе с Виктором — до старта, все 31 день и после финиша.",
      formatsLabel: "Направления участия",
      formats: [
        [
          "Экипировка",
          "Продукт становится частью ежедневной дистанции и честно показывается в работе.",
        ],
        [
          "Технологии",
          "Данные, связь и контроль помогают сделать 31 день понятными аудитории.",
        ],
        [
          "Медиа",
          "Вместе фиксируем реальный ход проекта и превращаем его в последовательную медийную историю.",
        ],
      ],
      processLabel: "Как начинается работа",
      process: [
        [
          "Сверяем задачу",
          "Определяем, что партнёр хочет изменить и где это честно встречается с проектом.",
        ],
        [
          "Собираем роль",
          "Фиксируем формат, ресурсы, контент и измеримый результат.",
        ],
        [
          "Проходим путь",
          "Ведём работу от первого решения до итогового результата.",
        ],
      ],
      proofLabel: "Опыт, который уже работает",
      proof: [
        ["≈1,3 млн", "просмотров пяти серий и фильма"],
        ["+310%", "рост аудитории"],
        ["25+", "федеральных СМИ"],
      ],
      cta: "Обсудить участие",
      mailSubject: "Партнёрство с проектом 11 111",
      contacts: "Контакт",
      emailLabel: "Написать Анне Нестеровой",
      telegramLabel: "Написать Анне Нестеровой в Telegram",
      emailCta: "Написать по почте",
      telegramCta: "Написать в Telegram",
      person: "Анна Нестерова",
    },
    footer: {
      kicker: "11 111 км · 31 день · Виктор Доронин",
      titleLineOne: "История начинается через",
      titleActive: "История идёт",
      titleFinished: "История продолжается",
      titleLineTwo: "скоро",
      afterCredits: "Следить за дневником",
      navLabel: "Навигация",
      contactLabel: "Связаться",
      utilityLabel: "Сайт",
      languageLabel: "Язык",
      languageCurrent: "Русский",
      languageAlternate: "English",
      themeLabel: "Тема",
      themeSystem: "Система",
      themeLight: "Светлая",
      themeDark: "Тёмная",
      settingsLabel: "Настройки",
      motionLabel: "Движение",
      motionSystem: "Система",
      motionReduced: "Меньше",
      analyticsLabel: "Аналитика",
      analyticsOn: "Вкл",
      analyticsOff: "Выкл",
      emailCta: "Написать по почте",
      telegramCta: "Написать в Telegram",
      partnerCta: "Обсудить участие",
      languageCta: "English version",
      legal: "2026 ИП Доронин В. В. · ИНН 344 406 202 270",
      designCredit: "Дизайн и разработка",
      top: "Наверх",
    },
  },
  en: {
    lang: "en",
    outputPath: "en/index.html",
    assetBase: "../",
    alternateHref: "../",
    alternateLabel: "RU",
    canonical: "https://11111.life/en/",
    alternateCanonical: "https://11111.life/",
    title: "11,111 km in 31 days — Viktor Doronin",
    description:
      "Viktor Doronin plans to ride 11,111 km in December: 22 base days and five special stages rising from 333 to 1111 km.",
    socialImage: "https://11111.life/assets/share-en.jpg",
    socialAlt: "11,111 km by bike in 31 days. Viktor Doronin. Starts December 1, 2026.",
    skip: "Skip to content",
    homeLabel: "11 111 — home",
    menu: "Menu",
    menuClose: "Close menu",
    navLiveKicker: "Now",
    navLiveLabel: "Diary",
    navRouteKicker: "Route · 07 chapters",
    navDiaryLabel: "Road-to-start diary",
    navDiaryNote: "The remaining days, Viktor’s training and decisions",
    nav: [
      ["#about", "Project"],
      ["#distance", "Calendar"],
      ["#viktor", "Protagonist"],
      ["#proof", "Film “1111”"],
      ["#adventures", "Adventures"],
      ["#interviews", "Interviews"],
      ["#partners", "Partners"],
    ],
    headerCta: "Discuss partnership",
    hero: {
      kicker: "December 1–31, 2026 · Viktor Doronin",
      lineOne: ["11,111", "km"],
      lineTwo: ["31", "days"],
      accent: "BY BIKE",
      intro:
        "The base rhythm is 333 km a day. Five special stages raise the distance to a final 1111 km stage.",
      imageAlt: "Viktor Doronin riding at speed during a cycling event",
      videoPlay: "Play video",
      videoPause: "Pause",
      primaryCta: "Discuss a partnership",
      secondaryCta: "Follow the diary",
      statusFallback: "Starts December 1, 2026",
      statusMeta: "11,111 km · 31 days",
      beforeForms: ["day to start", "days to start", "days to start"],
      activeLabel: "day of 31",
      finishedLabel: "The scheduled project period has ended",
      latestUpdate: "Latest verified update",
      sourceLabel: "Source",
      statusPending: "Verified figures will appear after the team’s update",
      footLabel: "One distance · five peaks",
      footText: "333 → 555 → 777 → 999 → 1111",
    },
    diary: createDiaryContent("en"),
    manifesto: {
      eyebrow: "One defining goal",
      title: "To ride 11,111 kilometres in December.",
      text:
        "Between peaks, Viktor returns to the base distance. The three longest stages — 777, 999 and 1111 km — are continuous rides, not divided into daily legs.",
    },
    distance: {
      eyebrow: "December 2026 · 31 days",
      title: "A calendar built to escalate",
      intro:
        "Base blocks between the special stages preserve a working rhythm and create a clear approach to the next test.",
      totalLabel: "Total distance",
      totalValue: "11,111",
      totalUnit: "km",
      specialLabel: "Special stage",
      baseLabel: "Base block",
      finishLabel: "Project finish",
      continuousLabel: "One continuous ride",
      oneDayLabel: "One day",
      dailyLabel: "per day",
      totalBlockLabel: "for the block",
      baseSummary: "22 base days",
      specialSummary: "5 special stages",
      rideSummary: "30 days in motion",
      baseMetricLabel: "base days",
      specialMetricLabel: "special stages",
      rideMetricLabel: "days in motion",
      finishMetricLabel: "December · project finish",
      rhythmTitle: "The project’s base unit is 333 km",
      rhythmText:
        "Twenty base days cover 333 km each; two more cover 338 km. This brings Viktor to exactly 10,000 km before the final stage.",
      formulaLabel: "7336 plus 3775 equals 11,111 kilometres",
      formulaBase: "7336",
      formulaSpecial: "3775",
      formulaResult: "11,111",
    },
    viktor: {
      eyebrow: "About Viktor",
      title: "Viktor Doronin",
      lead: "47. He does not build an image&nbsp;—<br>he lives it.",
      body: `A driving force behind the <a href="${shared.dustyDumbbellsHref}" target="_blank" rel="noopener noreferrer">Dusty Dumbbells</a> and&nbsp;<a href="${shared.gastrodinamikaHref}" target="_blank" rel="noopener noreferrer">Gastrodinamika</a> communities, a friend, a motivator, and an amateur athlete experienced in extreme endurance.`,
      imageAlt: "Viktor Doronin racing through the desert",
      achievements: [
        ["4×", "Ironman World Championship Kona participant"],
        ["252.8 km", "Marathon des Sables in the Sahara"],
        ["17,696 m", "Double Everesting elevation gain in one ride"],
        ["58 hours", "1111 km ultra-triathlon without sleep"],
      ],
      quote: "He does not sell a story.<br>He lives it.",
    },
    story: {
      label: "Training, effort and the people around him",
      videoPlay: "Play clip",
      videoPause: "Pause",
      credit: "Photography — Zhenya Khanai",
      dates: "May 22–June 19, 2026",
      items: [
        {
          image: "story-leads-community.jpg",
          width: "1800",
          height: "1200",
          alt: "Viktor Doronin stands with his back to the camera before a large group of runners on a track",
          caption: "Community",
          date: "2026-06-02",
          dateLabel: "June 2, 2026",
        },
        {
          image: "story-pace-close.jpg",
          width: "1400",
          height: "1800",
          alt: "Viktor Doronin runs with a group along a sunlit track",
          caption: "Pace",
          date: "2026-05-22",
          dateLabel: "May 22, 2026",
        },
        {
          image: "story-recovery.jpg",
          video: "story-recovery.mp4",
          width: "1600",
          height: "900",
          alt: "Viktor Doronin recovering immediately after a hard effort",
          caption: "The cost of effort",
        },
        {
          image: "story-support.jpg",
          width: "1400",
          height: "1800",
          alt: "A smiling Viktor Doronin clasps hands with people after training",
          caption: "Support",
          date: "2026-05-31",
          dateLabel: "May 31, 2026",
        },
        {
          image: "story-motion-city.jpg",
          width: "3500",
          height: "2333",
          alt: "Viktor Doronin runs alongside other athletes on a sunlit path",
          caption: "Motion",
          date: "2026-06-19",
          dateLabel: "June 19, 2026",
        },
        {
          image: "story-community-wide.jpg",
          width: "1800",
          height: "1200",
          alt: "Viktor Doronin and a large training group pose together on a track",
          caption: "Together",
          date: "2026-06-02",
          dateLabel: "June 2, 2026",
        },
      ],
    },
    proof: {
      eyebrow: "We have done it before",
      title: "Project “1111” — a proven formula",
      body:
        "The audience embraces long-form stories. Honesty outperforms gloss. The project lives on after the finish.",
      metrics: [
        ["≈1.3M", "views across five episodes and the film"],
        ["92,000+", "film views"],
        ["+310%", "growth in Viktor’s audience"],
        ["25+", "federal media outlets"],
      ],
      filmCta: "Watch the film about Project “1111”",
      externalLabel: "Opens VK in a new tab",
      sourcesTitle: "Facts and sources",
      sourcesUpdated: "Checked July 31, 2026",
      sourceLabel: "Sources",
      sources: [
        {
          title: "≈1.3M views",
          body:
            "The five episodes have 233k, 239k, 231k, 231k and 273k views; the film has 92.1k. Combined total: approximately 1.299M views.",
          links: [
            ["Episode 1", shared.serialHrefs[0]],
            ["Episode 2", shared.serialHrefs[1]],
            ["Episode 3", shared.serialHrefs[2]],
            ["Episode 4", shared.serialHrefs[3]],
            ["Episode 5", shared.serialHrefs[4]],
            ["Film", shared.filmHref],
          ],
        },
        {
          title: "Viktor’s sporting record",
          body:
            "Ironman World Championship participation and Marathon des Sables are documented in the film description.",
          links: [["Film description", shared.filmHref]],
        },
        {
          title: "+310% and 25+ media outlets",
          body:
            "Communication results from Project “1111”, as reported by the project team.",
          links: [],
        },
        {
          title: "The new “11 111” project",
          body:
            "The 11,111 km distance is a separate cycling project. Its calendar plan is published above; the actual result will be documented after the start.",
          links: [],
        },
      ],
    },
    adventures: {
      eyebrow: "Not his first limit",
      title: "More of Viktor’s adventures",
      watch: "Watch on YouTube",
      items: [
        {
          title: "Marathon des Sables 2024",
          meta: "252 km across the Sahara",
          image: "adventure-marathon.jpg",
          href: "https://www.youtube.com/watch?v=OxE1IAUpjlc",
        },
        {
          title: "Tour de Kamyshin 2024",
          meta: "Viktor Doronin and superheroes · 500 km by bike",
          image: "adventure-kamyshin.jpg",
          href: "https://www.youtube.com/watch?v=TtEKqOWKDV0",
        },
        {
          title: "Ladoga",
          meta: "A three-day cycling journey across the Leningrad Region",
          image: "adventure-ladoga.jpg",
          href: "https://www.youtube.com/watch?v=vxilFkecjYk",
        },
      ],
    },
    interviews: {
      eyebrow: "Interviews",
      title: "In his own words",
      intro:
        "Conversations that reveal his experience of long-distance challenges, work on himself, and ability to bring people together through movement.",
      watch: "Watch the interview",
      items: [
        {
          title: "Project “1111”: 58 hours without sleep",
          source: "SPORTFERMA",
          image: "interview-01.jpg",
          href: "https://youtu.be/4H2fddBQ6VQ",
        },
        {
          title: "252 km across the Sahara",
          source: "Sport-Marafon",
          image: "interview-02.jpg",
          href: "https://youtu.be/YKywKAqJF4I",
        },
        {
          title: "Gastrodynamics: triathlon with flavour",
          source: "Siberman",
          image: "interview-03.jpg",
          href: "https://youtu.be/FyYYLrvR-Hc",
        },
        {
          title: "How to qualify for Kona three times",
          source: "Running Is Bad Live",
          image: "interview-04.jpg",
          href: "https://youtu.be/Iggevbibf8w",
        },
        {
          title: "Dusty Dialogues",
          source: "Dusty Dumbbells",
          image: "interview-05.jpg",
          href: "https://youtu.be/FuHM9yD1fa4",
        },
        {
          title: "Dusty Dumbbells: how the community works",
          source: "SPORTFERMA",
          image: "interview-06.jpg",
          href: "https://youtu.be/xrOSk5OpYCA",
        },
        {
          title: "Why runners should swim and cycle",
          source: "RUN FAQ",
          image: "interview-07.jpg",
          href: "https://youtu.be/-tTE9Wk-kIo",
        },
        {
          title: "Cross-training for runners",
          source: "RUN FAQ",
          image: "interview-08.jpg",
          href: "https://youtu.be/c4Q4KwM5oVQ",
        },
      ],
    },
    partners: {
      eyebrow: "For partners",
      title: "Take the journey together",
      imageAlt: "Viktor Doronin among runners before the start.",
      lead: "Not an integration.<br>A shared journey.",
      body:
        "11,111 km begin long before the first kilometre. We invite those who want to do more than watch from the sidelines — to follow this story with Viktor before the start, through all 31 days and beyond the finish.",
      formatsLabel: "Ways to participate",
      formats: [
        [
          "Equipment",
          "The product becomes part of the daily distance and is shown honestly at work.",
        ],
        [
          "Technology",
          "Data, connectivity and monitoring make all 31 days legible to the audience.",
        ],
        [
          "Media",
          "Together, we document the project as it unfolds and shape it into one coherent media story.",
        ],
      ],
      processLabel: "How the work begins",
      process: [
        [
          "Align the objective",
          "Define what the partner wants to change and where that meets the project honestly.",
        ],
        [
          "Build the role",
          "Set the format, resources, content and a measurable outcome.",
        ],
        [
          "Share the journey",
          "Work from the first decision to the final result.",
        ],
      ],
      proofLabel: "Experience that already works",
      proof: [
        ["≈1.3M", "views across five episodes and the film"],
        ["+310%", "audience growth"],
        ["25+", "federal media outlets"],
      ],
      cta: "Discuss a partnership",
      mailSubject: "Partnership with Project 11 111",
      contacts: "Contact",
      emailLabel: "Email Anna Nesterova",
      telegramLabel: "Message Anna Nesterova on Telegram",
      emailCta: "Send an email",
      telegramCta: "Message on Telegram",
      person: "Anna Nesterova",
    },
    footer: {
      kicker: "11,111 km · 31 days · Viktor Doronin",
      titleLineOne: "The story begins in",
      titleActive: "The story is unfolding",
      titleFinished: "The story continues",
      titleLineTwo: "soon",
      afterCredits: "Follow the diary",
      navLabel: "Navigation",
      contactLabel: "Get in touch",
      utilityLabel: "Website",
      languageLabel: "Language",
      languageCurrent: "English",
      languageAlternate: "Русский",
      themeLabel: "Theme",
      themeSystem: "System",
      themeLight: "Light",
      themeDark: "Dark",
      settingsLabel: "Settings",
      motionLabel: "Motion",
      motionSystem: "System",
      motionReduced: "Reduced",
      analyticsLabel: "Analytics",
      analyticsOn: "On",
      analyticsOff: "Off",
      emailCta: "Send an email",
      telegramCta: "Message on Telegram",
      partnerCta: "Discuss a partnership",
      languageCta: "Русская версия",
      legal: "2026 · Sole proprietor Viktor Doronin · TIN 344 406 202 270",
      designCredit: "Design and development",
      top: "Back to top",
    },
  },
};

// Menu-only film stills come from the project folder supplied by the client;
// section media below keeps its own editorial crop and loading contract.
const navigationPreviews = [
  { file: "hero.jpg", position: "50% 50%" },
  { file: "nav-adventures-film.jpg", position: "57% 50%" },
  { file: "portrait.jpg", position: "62% 50%" },
  { file: "nav-film-detail.jpg", position: "50% 50%" },
  { file: "nav-adventures-aerial-straight.jpg", position: "50% 50%" },
  { file: "nav-interview-studio.jpg", position: "58% 50%" },
  { file: "partner-community-motion.jpg", position: "50% 50%" },
];

function renderNav(items, { track = false, assetBase = "" } = {}) {
  return items
    .map(([href, label], index) => {
      const analyticsGoal = ["#about", "#distance"].includes(href)
        ? "project_explore"
        : href === "#partners"
          ? "partner_interest"
          : "";
      const analyticsAttribute = analyticsGoal
        ? ` data-analytics-goal="${analyticsGoal}"`
        : "";
      const trackingAttributes = track
        ? ` data-nav-track data-nav-title="${label}" data-nav-index="${String(index + 1).padStart(2, "0")}" data-nav-image="${assetBase}assets/${navigationPreviews[index].file}" data-nav-position="${navigationPreviews[index].position}"`
        : "";

      return `<a class="site-nav__link" href="${href}"${analyticsAttribute}${trackingAttributes}>${label}</a>`;
    })
    .join("");
}

function renderThemeSwitcher(l) {
  return `
    <div class="theme-switcher" role="group" aria-label="${l.footer.themeLabel}">
      <span class="theme-switcher__label">${l.footer.themeLabel}</span>
      <div class="theme-switcher__options">
        <button type="button" data-theme-option="system" aria-pressed="true">${l.footer.themeSystem}</button>
        <button type="button" data-theme-option="light" aria-pressed="false">${l.footer.themeLight}</button>
        <button type="button" data-theme-option="dark" aria-pressed="false">${l.footer.themeDark}</button>
      </div>
    </div>`;
}

function renderMenuSettings(l) {
  return `
    <div class="site-nav__settings" aria-label="${l.footer.settingsLabel}">
      <div class="site-nav__setting site-nav__setting--language">
        <span class="site-nav__setting-label">${l.footer.languageLabel}</span>
        <div class="site-nav__setting-options">
          <span data-language-code="${l.lang.toUpperCase()}" aria-current="page">${l.footer.languageCurrent}</span>
          <a data-language-switch href="${l.alternateHref}" hreflang="${l.lang === "ru" ? "en" : "ru"}">${l.footer.languageAlternate}</a>
        </div>
      </div>
      <div class="site-nav__setting" role="group" aria-label="${l.footer.themeLabel}">
        <span class="site-nav__setting-label">${l.footer.themeLabel}</span>
        <div class="site-nav__setting-options site-nav__setting-options--theme">
          <button type="button" data-theme-option="system" aria-pressed="true">${l.footer.themeSystem}</button>
          <button type="button" data-theme-option="light" aria-pressed="false">${l.footer.themeLight}</button>
          <button type="button" data-theme-option="dark" aria-pressed="false">${l.footer.themeDark}</button>
        </div>
      </div>
    </div>`;
}

const icons = {
  mail: `
    <svg class="icon icon--mail" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M2.5 4.25h11v7.5h-11zM3 4.75 8 8.5l5-3.75"></path>
    </svg>`,
  telegram: `
    <svg class="icon icon--telegram" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="m2.5 7.5 11-4.25-3.2 9.5-3.2-3-2.25 1.65.7-3.15 5.2-3.1-4.3 3.8"></path>
    </svg>`,
  external: `
    <svg class="icon icon--external" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M4 12 12 4M6 4h6v6"></path>
    </svg>`,
  down: `
    <svg class="icon icon--down" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M8 3v10M4.5 9.5 8 13l3.5-3.5"></path>
    </svg>`,
  up: `
    <svg class="icon icon--up" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M8 13V3M4.5 6.5 8 3l3.5 3.5"></path>
    </svg>`,
};

function formatProjectNumber(value, lang) {
  if (value < 10000) return String(value);
  return new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-US").format(value);
}

function formatCalendarDate(dateValue, lang) {
  return new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${dateValue}T00:00:00Z`));
}

function formatCalendarRange(segment, lang) {
  if (segment.startDate === segment.endDate) {
    return formatCalendarDate(segment.startDate, lang);
  }
  const startDate = new Date(`${segment.startDate}T00:00:00Z`);
  const endDate = new Date(`${segment.endDate}T00:00:00Z`);
  const startDay = Number(segment.startDate.slice(-2));
  const endDay = Number(segment.endDate.slice(-2));

  if (startDate.getUTCMonth() === endDate.getUTCMonth()) {
    const month = new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "en-US", {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    })
      .formatToParts(endDate)
      .find((part) => part.type === "month")?.value;
    return lang === "ru"
      ? `${startDay}–${endDay} ${month}`
      : `${month} ${startDay}–${endDay}`;
  }

  return `${formatCalendarDate(segment.startDate, lang)}–${formatCalendarDate(segment.endDate, lang)}`;
}

function renderCalendarSegments(plan, l) {
  let cumulativeDistance = 0;

  return plan.segments
    .map((segment, index) => {
      cumulativeDistance += segment.totalDistanceKm;
      const value = formatProjectNumber(segment.totalDistanceKm, l.lang);
      const cumulative = formatProjectNumber(cumulativeDistance, l.lang);
      const label =
        segment.kind === "special"
          ? l.distance.specialLabel
          : segment.kind === "base"
            ? l.distance.baseLabel
            : l.distance.finishLabel;
      const detail =
        segment.kind === "special"
          ? segment.calendarDays > 1
            ? l.distance.continuousLabel
            : l.distance.oneDayLabel
          : segment.kind === "base"
            ? `${formatProjectNumber(segment.dailyDistanceKm, l.lang)}\u00a0${l.distance.totalUnit} ${l.distance.dailyLabel} · ${formatProjectNumber(segment.totalDistanceKm, l.lang)}\u00a0${l.distance.totalUnit} ${l.distance.totalBlockLabel}`
            : "";

      return `
        <article class="bike-calendar__segment bike-calendar__segment--${segment.kind}" style="--calendar-order:${index}">
          <div class="bike-calendar__segment-meta">
            <span>${String(index + 1).padStart(2, "0")}</span>
            <time datetime="${segment.startDate}">${formatCalendarRange(segment, l.lang)}</time>
          </div>
          <div class="bike-calendar__segment-main">
            <p class="bike-calendar__segment-label">${label}</p>
            ${
              segment.kind === "finish"
                ? `<strong class="bike-calendar__finish-mark" data-optical-start>31</strong>`
                : `<p class="bike-calendar__segment-value" data-optical-start><strong>${value}</strong><span>${l.distance.totalUnit}</span></p>`
            }
            ${detail ? `<p class="bike-calendar__segment-detail">${detail}</p>` : ""}
          </div>
          <p class="bike-calendar__cumulative"><span>${l.distance.totalLabel}</span><strong>${cumulative}\u00a0${l.distance.totalUnit}</strong></p>
        </article>`;
    })
    .join("");
}

function renderSpecialSequence(plan, l) {
  const stages = plan.segments.filter((segment) => segment.kind === "special");
  const totalDistance = stages.reduce(
    (total, stage) => total + stage.totalDistanceKm,
    0,
  );

  return stages
    .map(
      (stage, index) => `
        <li style="--calendar-order:${index};--stage-distance:${stage.totalDistanceKm};--stage-share:${((stage.totalDistanceKm / totalDistance) * 100).toFixed(6)}%">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <strong data-optical-start>${formatProjectNumber(stage.totalDistanceKm, l.lang)}</strong>
          <time datetime="${stage.startDate}">${formatCalendarRange(stage, l.lang)}</time>
        </li>`,
    )
    .join("");
}

function renderMetrics(items, className) {
  return items
    .map(
      ([value, label]) => {
        const glyphCount = Array.from(value.replaceAll(/\s/g, "")).length;
        const density = glyphCount <= 3 ? "short" : glyphCount <= 5 ? "medium" : "long";

        return `
        <div class="${className}" data-metric-density="${density}">
          <strong data-optical-start>${value}</strong>
          <span>${label}</span>
        </div>`;
      },
    )
    .join("");
}

function renderDiaryTabs(entries) {
  return entries
    .map(
      (entry, index) => `
        <a
          class="diary-stories__tab"
          id="diary-tab-${entry.date}"
          href="#diary-entry-${entry.date}"
          role="tab"
          aria-controls="diary-entry-${entry.date}"
          aria-selected="${index === 0 ? "true" : "false"}"
          data-diary-story-tab
          draggable="false"
        >
          <span class="diary-stories__index">${entry.index}</span>
          <span class="diary-stories__thumb" aria-hidden="true">
            <img
              src="${entry.image}"
              alt=""
              width="720"
              height="1280"
              loading="lazy"
              decoding="async"
            >
          </span>
          <time datetime="${entry.date}">${entry.dateLabel}</time>
          <strong>${entry.tabLabel}</strong>
        </a>`,
    )
    .join("");
}

function renderDiaryEntries(entries, l) {
  return entries
    .map(
      (entry, index) => `
        <article
          class="diary-story"
          id="diary-entry-${entry.date}"
          role="tabpanel"
          aria-labelledby="diary-tab-${entry.date}"
          tabindex="0"
          data-diary-story-panel
        >
          <figure class="diary__media">
            <video
              src="${l.assetBase}assets/${entry.video}"
              poster="${l.assetBase}assets/${entry.image}"
              width="720"
              height="1280"
              preload="${index === 0 ? "metadata" : "none"}"
              controls
              playsinline
              aria-label="${entry.videoLabel}"
              data-diary-video
            ></video>
            <button
              class="diary__play"
              type="button"
              aria-label="${entry.videoPlayLabel}"
              data-diary-video-play
            >
              <span class="diary__play-label">${entry.videoPlayCta}</span>
              <span class="diary__play-meta">
                <time datetime="${entry.videoDurationIso}">${entry.videoDuration}</time>
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="m9 6 9 6-9 6Z"></path>
                </svg>
              </span>
            </button>
            <figcaption class="sr-only">${entry.imageAlt}</figcaption>
          </figure>
          <div class="diary__copy">
            <h3>${entry.title}</h3>
            <p class="diary__lead">${entry.lead}</p>
            <div class="diary__facts">
              ${renderMetrics(entry.facts, "diary__fact")}
            </div>
            <p class="diary__note">${entry.note}</p>
            <a
              class="text-link text-link--dark"
              href="${entry.href}"
              data-analytics-goal="diary_open"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span class="text-link__label">${entry.cta}</span>
              ${icons.external}
              <span class="sr-only">${entry.externalLabel}</span>
            </a>
          </div>
        </article>`,
    )
    .join("");
}

function renderPartnerFormats(partners) {
  return partners.formats
    .map(
      ([title, body], index) => `
        <li class="partner-format">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <strong>${title}</strong>
          <p>${body}</p>
        </li>`,
    )
    .join("");
}

function renderPartnerProcess(partners) {
  return partners.process
    .map(
      ([title, body], index) => `
        <li class="partner-process__step">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <strong>${title}</strong>
          <p>${body}</p>
        </li>`,
    )
    .join("");
}

function renderProofSources(proof) {
  return proof.sources
    .map(
      (source, index) => `
        <article class="proof-source">
          <span class="proof-source__index" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
          <h3>${source.title}</h3>
          <p>${source.body}</p>
          ${
            source.links.length
              ? `<div class="proof-source__links">
                  <span>${proof.sourceLabel}</span>
                  <div>
                    ${source.links
                      .map(
                        ([label, href]) =>
                          `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}${icons.external}</a>`,
                      )
                      .join("")}
                  </div>
                </div>`
              : ""
          }
        </article>`,
    )
    .join("");
}

function renderProjectPhases(diary) {
  return diary.phases
    .map(
      ([phase, title, body]) => `
        <li data-project-phase-item="${phase}">
          <span>${title}</span>
          <p>${body}</p>
        </li>`,
    )
    .join("");
}

function renderAdventures(items, l) {
  return items
    .map(
      (item) => `
        <a class="adventure-card" href="${item.href}" target="_blank" rel="noopener noreferrer">
          <div class="adventure-card__media">
            <img src="${l.assetBase}assets/${item.image}" alt="" loading="lazy" width="1280" height="720">
          </div>
          <div class="adventure-card__copy">
            <div>
              <h3>${item.title}</h3>
              <p>${item.meta}</p>
            </div>
            <span class="adventure-card__action">${l.adventures.watch}${icons.external}</span>
          </div>
        </a>`,
    )
    .join("");
}

function renderInterviews(items, l) {
  return items
    .map(
      (item, index) => `
        <a
          class="interview-card${index === 0 ? " interview-card--featured" : " interview-card--index"}"
          href="${item.href}"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="${l.interviews.watch}: ${item.title}"
        >
          <div class="interview-card__media">
            <img
              src="${l.assetBase}assets/${item.image}"
              alt=""
              loading="lazy"
              width="960"
              height="540"
            >
          </div>
          <div class="interview-card__copy">
            <p class="interview-card__meta">
              <span>${String(index + 1).padStart(2, "0")}</span>
              ${item.source}
            </p>
            <h3>${item.title}</h3>
            <span class="interview-card__action">
              ${l.interviews.watch}
              ${icons.external}
            </span>
          </div>
        </a>`,
    )
    .join("");
}

function renderStory(items, l) {
  return items
    .map(
      (item, index) => `
        <figure
          class="story-frame${item.video ? " story-frame--motion" : ""}"
          ${item.video ? "data-story-video-frame" : ""}
        >
          <div class="story-frame__media">
            ${
              item.video
                ? `<video
                    data-story-video
                    muted
                    loop
                    playsinline
                    preload="metadata"
                    poster="${l.assetBase}assets/${item.image}"
                    aria-hidden="true"
                  >
                    <source src="${l.assetBase}assets/${item.video}?v=${editorialVideoVersion}" type="video/mp4">
                  </video>
                  <button
                    class="story-frame__video-toggle"
                    type="button"
                    data-story-video-toggle
                    data-play-label="${l.story.videoPlay}"
                    data-pause-label="${l.story.videoPause}"
                    aria-label="${l.story.videoPlay}"
                    aria-pressed="false"
                  >
                    <span class="story-frame__video-toggle-icon" aria-hidden="true"><i></i><i></i></span>
                    <span class="sr-only" data-story-video-toggle-label>${l.story.videoPlay}</span>
                  </button>`
                : `<img
                    src="${l.assetBase}assets/${item.image}"
                    alt="${item.alt}"
                    width="${item.width}"
                    height="${item.height}"
                    loading="lazy"
                  >`
            }
          </div>
          <figcaption>
            <span aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
            <strong>${item.caption}</strong>
            ${
              item.date
                ? `<time datetime="${item.date}">${item.dateLabel}</time>`
                : ""
            }
          </figcaption>
        </figure>`,
    )
    .join("");
}

function renderHeroLine([value, unit]) {
  return `<span data-optical-start>${value}<wbr> ${unit}</span>`;
}

const shortWords = {
  ru: /(?<![\p{L}\p{N}])(а|в|во|до|за|и|из|к|ко|на|не|о|об|от|по|с|со|у)\s+(?=[\p{L}\p{N}«])/giu,
  en: /\b(a|an|and|at|by|for|in|of|on|or|the|to)\s+(?=[A-Za-z0-9“])/giu,
};

const units = {
  ru: /(бассейнов|года|день|дня|дней|декабря|категориях|км|кругов|лет|марафона|метров|минут|млн|м|переправы|просмотров|СМИ|часа|часов)/giu,
  en: /(categories|crossings|days?|hours?|km|laps|lengths|marathons|metres?|minutes|outlets|views|years?)/giu,
};

function typographText(value, lang) {
  let text = value
    .replace(/\.{3}/g, "…")
    .replace(/\s+—\s+/g, "\u00A0— ")
    .replace(/(\d) (?=\d{3}(?:\D|$))/g, "$1\u202F");

  const unitPattern = new RegExp(
    `(\\d[\\d\\u202F]*(?:[,.]\\d+)?(?:\\+|×)?(?:–\\d+)?)\\s+${units[lang].source}(?!\\p{L})`,
    "giu",
  );
  text = text.replace(unitPattern, "$1\u00A0$2");

  if (lang === "ru") {
    text = text
      .replace(/(?<!\p{L})(ИП|ИНН)\s+(?=[А-ЯA-Z0-9])/gu, "$1\u00A0")
      .replace(/(?<!\p{L})([А-ЯЁ])\.\s+([А-ЯЁ])\./gu, "$1.\u00A0$2.");
  } else {
    text = text.replace(
      /\b(December)\s+(\d{1,2}),\s+(\d{4})/gu,
      "$1\u00A0$2,\u00A0$3",
    );
  }

  for (let pass = 0; pass < 3; pass += 1) {
    text = text.replace(shortWords[lang], "$1\u00A0");
  }

  return text;
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function typographHtml(html, lang) {
  const textNodes = html
    .split(/(<[^>]+>)/g)
    .map((part) => (part.startsWith("<") ? part : typographText(part, lang)))
    .join("");

  return textNodes
    .replace(
      /\b(alt|aria-label|content|data-before(?:-one|-few|-many)?|data-active|data-finished|data-latest-update|data-status-pending|data-live-discipline|data-live-note)="([^"]*)"/g,
      (attribute, name, value) => `${name}="${typographText(value, lang)}"`,
    )
    .replace(/[ \t]+$/gm, "");
}

function renderPage(l) {
  const encodedSubject = encodeURIComponent(l.partners.mailSubject);
  const mailHref = `mailto:${shared.email}?subject=${encodedSubject}`;
  const statusForms = l.hero.beforeForms.map((form) => form.replaceAll('"', "&quot;"));
  const liveStatus = hasVerifiedProjectStatus
    ? {
        updatedAt: projectStatus.updatedAt,
        distanceKm: String(projectStatus.distanceKm),
        discipline: escapeAttribute(projectStatus.discipline[l.lang]),
        note: escapeAttribute(projectStatus.note?.[l.lang] || ""),
        sourceLabel: escapeAttribute(projectStatus.source.label[l.lang]),
        sourceUrl: escapeAttribute(projectStatus.source.url),
      }
    : {
        updatedAt: "",
        distanceKm: "",
        discipline: "",
        note: "",
        sourceLabel: "",
        sourceUrl: "",
      };

  return typographHtml(`<!doctype html>
<html lang="${l.lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="theme-color" content="#f1f5ed" media="(prefers-color-scheme: light)" data-theme-color="light">
  <meta name="theme-color" content="#040c0d" media="(prefers-color-scheme: dark)" data-theme-color="dark">
  <title>${l.title}</title>
  <meta name="description" content="${l.description}">
  <link rel="canonical" href="${l.canonical}">
  <link rel="alternate" hreflang="${l.lang}" href="${l.canonical}">
  <link rel="alternate" hreflang="${l.lang === "ru" ? "en" : "ru"}" href="${l.alternateCanonical}">
  <link rel="alternate" hreflang="x-default" href="https://11111.life/">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="11 111">
  <meta property="og:title" content="${l.title}">
  <meta property="og:description" content="${l.description}">
  <meta property="og:url" content="${l.canonical}">
  <meta property="og:image" content="${l.socialImage}">
  <meta property="og:image:secure_url" content="${l.socialImage}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${l.socialAlt}">
  <meta property="og:locale" content="${l.lang === "ru" ? "ru_RU" : "en_US"}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${l.title}">
  <meta name="twitter:description" content="${l.description}">
  <meta name="twitter:image" content="${l.socialImage}">
  <meta name="twitter:image:alt" content="${l.socialAlt}">
  <link
    rel="icon"
    href="${l.assetBase}assets/favicon-adaptive.svg"
    type="image/svg+xml"
    data-favicon
    data-system-href="${l.assetBase}assets/favicon-adaptive.svg"
    data-light-href="${l.assetBase}assets/favicon-light.svg"
    data-dark-href="${l.assetBase}assets/favicon-dark.svg"
  >
  <script src="${l.assetBase}assets/theme-init.js?v=${assetVersion}"></script>
  <link rel="stylesheet" href="${l.assetBase}assets/styles.css?v=${assetVersion}">
  <script src="${l.assetBase}assets/app.js?v=${assetVersion}" defer></script>
</head>
<body data-project-phase="before">
  <script type="application/json" id="analytics-goal-registry">${analyticsRegistryJson}</script>
  <a class="skip-link" href="#main">${l.skip}</a>

  <header class="site-header is-over-hero">
    <a class="site-logo" href="#top" aria-label="${l.homeLabel}">
      <img src="${l.assetBase}assets/logo.svg" alt="" width="512" height="231">
    </a>

    <div class="header-status" data-menu-status aria-live="polite">
      <span class="header-status__reading">
        <strong data-menu-status-value data-optical-start>…</strong>
        <span data-menu-status-label>${l.hero.statusFallback}</span>
      </span>
      <span class="header-status__rail" aria-hidden="true">
        ${Array.from({ length: 12 }, () => "<i></i>").join("")}
      </span>
    </div>

    <details class="nav-shell">
      <summary
        class="menu-toggle"
        aria-label="${l.menu}"
        data-menu-open-label="${l.menu}"
        data-menu-close-label="${l.menuClose}"
      >
        <span class="menu-toggle__label">${l.menu}</span>
        <span class="menu-toggle__current" data-current-chapter>${l.nav[0][1]}</span>
        <span class="menu-toggle__icon" aria-hidden="true"></span>
      </summary>
      <nav class="site-nav" aria-label="${l.menu}">
        <div class="site-nav__chapters">
          <div class="site-nav__preview" aria-hidden="true">
            <figure class="site-nav__preview-media">
              <img
                src="${l.assetBase}assets/${navigationPreviews[0].file}"
                alt=""
                width="1600"
                height="900"
                style="object-position: ${navigationPreviews[0].position}"
                data-menu-preview-image
              >
            </figure>
            <span class="site-nav__preview-kicker">${l.navRouteKicker}</span>
            <strong class="site-nav__preview-index" data-menu-preview-index>01</strong>
            <span class="site-nav__preview-title" data-menu-preview-title>${l.nav[0][1]}</span>
          </div>
          <div class="site-nav__primary">
            ${renderNav(l.nav, { track: true, assetBase: l.assetBase })}
          </div>
        </div>
        <div class="site-nav__utility" aria-label="${l.footer.settingsLabel}">
          <div class="site-nav__journey">
            <a
              class="site-nav__diary"
              href="#diary"
              data-nav-track
              data-nav-title="${l.navLiveLabel}"
            >
              <span class="site-nav__diary-copy">
                <span class="site-nav__diary-title">
                  <strong>${l.navDiaryLabel}</strong>
                  ${icons.down}
                </span>
                <small>${l.navDiaryNote}</small>
              </span>
            </a>
            <div class="site-nav__status" data-menu-status>
              <span class="site-nav__status-meta">${l.hero.statusMeta}</span>
              <div class="site-nav__status-reading">
                <strong data-menu-status-value data-optical-start>…</strong>
                <span data-menu-status-label>${l.hero.statusFallback}</span>
              </div>
            </div>
          </div>
          <div class="site-nav__actions">
            ${renderMenuSettings(l)}
            <a class="site-nav__cta action-primary" href="${mailHref}" data-analytics-goal="contact_email"><span>${l.footer.partnerCta}</span>${icons.external}</a>
          </div>
        </div>
      </nav>
    </details>

    <div class="header-actions">
      <a class="header-cta" href="#partner-contact" data-analytics-goal="partner_interest">${l.headerCta}</a>
    </div>
  </header>

  <main id="main">
    <section class="hero" id="top" aria-labelledby="hero-title">
      <figure class="hero__media">
        <video
          data-hero-video
          muted
          loop
          playsinline
          preload="metadata"
          poster="${l.assetBase}assets/hero.jpg"
          aria-hidden="true"
        >
          <source src="${l.assetBase}assets/hero-loop-mobile.mp4?v=${heroVideoVersion}" type="video/mp4" media="(max-width: 640px)">
          <source src="${l.assetBase}assets/hero-loop.mp4?v=${heroVideoVersion}" type="video/mp4">
        </video>
      </figure>
      <div class="hero__veil" aria-hidden="true"></div>
      <div class="hero__media-controls">
        <button
          class="hero__media-toggle"
          type="button"
          data-video-toggle
          data-play-label="${l.hero.videoPlay}"
          data-pause-label="${l.hero.videoPause}"
          aria-label="${l.hero.videoPlay}"
          aria-pressed="false"
        >
          <span class="hero__media-toggle-icon" aria-hidden="true"><i></i><i></i></span>
          <span class="sr-only" data-video-toggle-label>${l.hero.videoPlay}</span>
        </button>
      </div>

      <div class="hero__content">
        <p class="hero__kicker"><time datetime="${shared.startDate}">${l.hero.kicker}</time></p>
        <h1 id="hero-title" class="hero__title">
          ${renderHeroLine(l.hero.lineOne)}
          ${renderHeroLine(l.hero.lineTwo)}
          <em data-optical-start>${l.hero.accent}</em>
        </h1>
        <p class="hero__intro">${l.hero.intro}</p>
        <div class="hero__actions">
          <a class="button button--primary action-primary" href="#partners" data-analytics-goal="partner_interest">${l.hero.primaryCta}${icons.down}</a>
          <a class="button button--ghost" href="#diary" data-analytics-goal="diary_explore">${l.hero.secondaryCta}</a>
        </div>
      </div>

      <div
        class="event-status"
        data-event-status
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-lang="${l.lang}"
        data-start="${shared.startDate}T00:00:00+03:00"
        data-end="2027-01-01T00:00:00+03:00"
        data-before-one="${statusForms[0]}"
        data-before-few="${statusForms[1]}"
        data-before-many="${statusForms[2]}"
        data-active="${l.hero.activeLabel}"
        data-finished="${l.hero.finishedLabel}"
        data-latest-update="${l.hero.latestUpdate}"
        data-status-pending="${l.hero.statusPending}"
        data-live-verified="${String(hasVerifiedProjectStatus)}"
        data-live-updated="${liveStatus.updatedAt}"
        data-live-distance="${liveStatus.distanceKm}"
        data-live-unit="${l.distance.totalUnit}"
        data-live-discipline="${liveStatus.discipline}"
        data-live-note="${liveStatus.note}"
        data-source-label="${l.hero.sourceLabel}"
        data-live-source-label="${liveStatus.sourceLabel}"
        data-live-source-url="${liveStatus.sourceUrl}"
      >
        <span class="event-status__meta">${l.hero.statusMeta}</span>
        <span class="event-status__rail" aria-hidden="true">
          ${Array.from(
            { length: 31 },
            (_, index) =>
              `<span data-status-day="${index + 1}" style="--status-step:${index};--status-heat:${Math.max(8, 80 - index * 6.55).toFixed(2)};--status-rise:${(0.12 + index * 0.006).toFixed(3)}rem"></span>`,
          ).join("")}
        </span>
        <span class="event-status__value" data-status-value data-optical-start>01.12</span>
        <span class="event-status__label" data-status-label>${l.hero.statusFallback}</span>
        <span class="event-status__update" data-status-update hidden>
          <span data-status-update-text></span>
          <a data-status-source hidden target="_blank" rel="noopener noreferrer"></a>
        </span>
      </div>

      <div class="hero__foot">
        <span>${l.hero.footLabel}</span>
        <strong>${l.hero.footText}</strong>
      </div>
    </section>

    <section class="diary section section--light" id="diary" aria-labelledby="diary-title">
      <div
        class="diary-live"
        data-diary-live
        data-campaign-start="2026-08-13T00:00:00+03:00"
        data-finished-count-label="${escapeAttribute(l.diary.liveFinishedCountLabel)}"
      >
        <div class="diary-live__count" aria-live="polite" aria-atomic="true">
          <strong data-diary-countdown data-optical-start>110</strong>
          <span data-diary-countdown-label>${l.hero.beforeForms[2]}</span>
        </div>
        <div class="diary-live__copy">
          <p
            class="diary-live__kicker"
            data-phase-copy
            data-before="${escapeAttribute(l.diary.liveKickerBefore)}"
            data-active="${escapeAttribute(l.diary.liveKickerActive)}"
            data-finished="${escapeAttribute(l.diary.liveKickerFinished)}"
          >${l.diary.liveKickerBefore}</p>
          <h2
            id="diary-title"
            data-phase-copy
            data-before="${escapeAttribute(l.diary.liveTitleBefore)}"
            data-active="${escapeAttribute(l.diary.liveTitleActive)}"
            data-finished="${escapeAttribute(l.diary.liveTitleFinished)}"
          >${l.diary.liveTitleBefore}</h2>
          <p
            class="diary-live__body"
            data-phase-copy
            data-before="${escapeAttribute(l.diary.liveBodyBefore)}"
            data-active="${escapeAttribute(l.diary.liveBodyActive)}"
            data-finished="${escapeAttribute(l.diary.liveBodyFinished)}"
          >${l.diary.liveBodyBefore}</p>
          <div class="diary-live__actions">
            <a
              class="button button--diary"
              href="${shared.viktorTelegramHref}"
              data-analytics-goal="diary_follow"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="${l.diary.liveFollowLabel}"
            >${l.diary.liveFollowCta}${icons.external}</a>
            <a class="text-link text-link--dark" href="#diary-archive">${l.diary.archiveCta}${icons.down}</a>
          </div>
        </div>
        <div class="diary-live__timeline" aria-hidden="true">
          <span><i></i></span>
          <div>
            <b
              data-phase-copy
              data-before="${escapeAttribute(l.diary.timelineNow)}"
              data-active="${escapeAttribute(l.diary.timelineStart)}"
              data-finished="${escapeAttribute(l.diary.timelineStart)}"
            >${l.diary.timelineNow}</b>
            <b
              data-phase-copy
              data-before="${escapeAttribute(l.diary.timelineStart)}"
              data-active="${escapeAttribute(l.diary.timelineFinish)}"
              data-finished="${escapeAttribute(l.diary.timelineFinish)}"
            >${l.diary.timelineStart}</b>
          </div>
        </div>
      </div>
      <div class="diary__heading">
        <p class="diary__eyebrow">${l.diary.archiveLabel}</p>
        <span class="diary__range">
          <span class="diary__range-count">${l.diary.rangeCount}</span>
          <span class="diary__range-period">
            <span class="diary__range-dot" aria-hidden="true">·\u00a0</span>
            <span class="diary__range-start">${l.diary.rangeStart}</span>
            <span class="diary__range-dash">\u00a0—\u00a0</span>
            <span class="diary__range-end">${l.diary.rangeEnd}</span>
          </span>
        </span>
      </div>
      <div class="diary-stories" id="diary-archive" data-diary-stories>
        <div
          class="diary-stories__rail"
          role="tablist"
          aria-label="${l.diary.storiesLabel}"
          data-diary-story-tabs
        >
          ${renderDiaryTabs(
            l.diary.entries.map((entry) => ({
              ...entry,
              image: `${l.assetBase}assets/${entry.image}`,
            })),
          )}
        </div>
        <div class="diary-stories__panels">
          ${renderDiaryEntries(l.diary.entries, l)}
        </div>
      </div>
      <ol class="project-phases" aria-label="${l.diary.phasesLabel}">
        ${renderProjectPhases(l.diary)}
      </ol>
    </section>

    <section class="manifesto section" id="about" aria-labelledby="manifesto-title">
      <div class="section-label">
        <span>01</span>
        <p>${l.manifesto.eyebrow}</p>
      </div>
      <div class="manifesto__copy">
        <h2 id="manifesto-title">${l.manifesto.title}</h2>
        <p>${l.manifesto.text}</p>
      </div>
      <div class="project-mark manifesto__mark" aria-hidden="true"></div>
    </section>

    <section class="distance section section--light" id="distance" aria-labelledby="distance-title">
      <div class="section-heading">
        <div class="section-label section-label--dark">
          <span>02</span>
          <p>${l.distance.eyebrow}</p>
        </div>
        <div>
          <h2 id="distance-title">${l.distance.title}</h2>
          <p>${l.distance.intro}</p>
        </div>
      </div>
      <div class="bike-calendar">
        <ol class="bike-calendar__sequence" aria-label="${l.distance.specialSummary}">
          ${renderSpecialSequence(projectPlan, l)}
        </ol>
        <div class="bike-calendar__rhythm">
          <div>
            <p>${l.distance.rhythmTitle}</p>
            <span>${l.distance.rhythmText}</span>
          </div>
          <dl>
            <div><dt>22</dt><dd>${l.distance.baseMetricLabel}</dd></div>
            <div><dt>5</dt><dd>${l.distance.specialMetricLabel}</dd></div>
            <div><dt>30</dt><dd>${l.distance.rideMetricLabel}</dd></div>
            <div><dt>31</dt><dd>${l.distance.finishMetricLabel}</dd></div>
          </dl>
        </div>
        <div class="bike-calendar__segments">
          ${renderCalendarSegments(projectPlan, l)}
        </div>
        <div class="bike-calendar__total" role="img" aria-label="${l.distance.formulaLabel}">
          <p><span>${l.distance.baseSummary}</span><strong>${l.distance.formulaBase}</strong></p>
          <b class="bike-calendar__operator bike-calendar__operator--plus" aria-hidden="true">+</b>
          <p><span>${l.distance.specialSummary}</span><strong>${l.distance.formulaSpecial}</strong></p>
          <div class="bike-calendar__total-answer">
            <b class="bike-calendar__operator bike-calendar__operator--equals" aria-hidden="true">=</b>
            <p class="bike-calendar__total-result"><span>${l.distance.totalLabel}</span><strong data-optical-start>${l.distance.formulaResult}<small>${l.distance.totalUnit}</small></strong></p>
          </div>
        </div>
      </div>
    </section>

    <section class="athlete section" id="viktor" aria-labelledby="viktor-title">
      <div class="athlete__media">
        <img src="${l.assetBase}assets/portrait.jpg" alt="${l.viktor.imageAlt}" width="1680" height="2102" loading="lazy">
      </div>
      <div class="athlete__copy">
        <div class="section-label">
          <span>03</span>
          <p>${l.viktor.eyebrow}</p>
        </div>
        <h2 id="viktor-title">${l.viktor.title}</h2>
        <p class="athlete__lead">${l.viktor.lead}</p>
        <p class="athlete__body">${l.viktor.body}</p>
        <p class="athlete__quote">${l.viktor.quote}</p>
        <div class="achievement-grid">
          ${renderMetrics(l.viktor.achievements, "achievement")}
        </div>
      </div>
    </section>

    <section class="story section section--light" aria-label="${l.story.label}">
      ${renderStory(l.story.items, l)}
      <p class="story__credit">
        <a href="${shared.photoHref}" target="_blank" rel="noopener noreferrer">
          <span class="story__credit-label">${l.story.credit}</span>${icons.external}
        </a>
        <span>${l.story.dates}</span>
      </p>
    </section>

    <div class="velocity-cut velocity-cut--into-proof" aria-hidden="true"></div>

    <section class="proof section" id="proof" aria-labelledby="proof-title">
      <div class="project-mark proof__mark" aria-hidden="true"></div>
      <div class="proof__heading">
        <div class="section-label">
          <span>04</span>
          <p>${l.proof.eyebrow}</p>
        </div>
        <h2 id="proof-title">${l.proof.title}</h2>
        <p>${l.proof.body}</p>
        <a class="text-link" href="${shared.filmHref}" data-analytics-goal="film_open" target="_blank" rel="noopener noreferrer">
          <span class="text-link__label">${l.proof.filmCta}</span>
          ${icons.external}
          <span class="sr-only">${l.proof.externalLabel}</span>
        </a>
      </div>
      <div class="proof-metrics">
        ${renderMetrics(l.proof.metrics, "proof-metric")}
      </div>
      <details class="proof-sources">
        <summary>
          <span>${l.proof.sourcesTitle}</span>
          <small>${l.proof.sourcesUpdated}</small>
          ${icons.down}
        </summary>
        <div class="proof-sources__grid">
          ${renderProofSources(l.proof)}
        </div>
      </details>
    </section>

    <div class="velocity-cut velocity-cut--out-of-proof" aria-hidden="true"></div>

    <section class="adventures section section--light" id="adventures" aria-labelledby="adventures-title">
      <div class="section-heading section-heading--compact">
        <div class="section-label section-label--dark">
          <span>05</span>
          <p>${l.adventures.eyebrow}</p>
        </div>
        <h2 id="adventures-title">${l.adventures.title}</h2>
      </div>
      <div class="adventure-grid">
        ${renderAdventures(l.adventures.items, l)}
      </div>
    </section>

    <section class="interviews section" id="interviews" aria-labelledby="interviews-title">
      <div class="interviews__heading">
        <div class="section-label">
          <span>06</span>
          <p>${l.interviews.eyebrow}</p>
        </div>
        <h2 id="interviews-title">${l.interviews.title}</h2>
        <p class="interviews__intro">${l.interviews.intro}</p>
      </div>
      <div class="interview-grid">
        ${renderInterviews(l.interviews.items, l)}
      </div>
    </section>

    <div class="velocity-cut velocity-cut--into-partners" aria-hidden="true"></div>

    <section class="partners section" id="partners" aria-labelledby="partners-title">
      <div class="partners__stage">
        <figure class="partners__stage-media">
          <img
            src="${l.assetBase}assets/partner-community-motion.jpg"
            alt="${l.partners.imageAlt}"
            width="1800"
            height="1200"
            loading="lazy"
          >
        </figure>
        <div class="partners__intro">
          <div class="section-label">
            <span>07</span>
            <p>${l.partners.eyebrow}</p>
          </div>
          <p class="partners__countdown" data-partner-countdown aria-live="polite">${l.hero.statusFallback}</p>
          <h2 id="partners-title">${l.partners.title}</h2>
        </div>
        <div class="partners__pitch">
          <p class="partners__lead">${l.partners.lead}</p>
          <p class="partners__body">${l.partners.body}</p>
        </div>
      </div>
      <div class="partners__offer">
        <div class="partner-formats">
          <p class="partner-formats__label">${l.partners.formatsLabel}</p>
          <ol class="partner-formats__list">
            ${renderPartnerFormats(l.partners)}
          </ol>
        </div>
      </div>
      <div class="partner-process">
        <p class="partner-process__label">${l.partners.processLabel}</p>
        <ol class="partner-process__list">
          ${renderPartnerProcess(l.partners)}
        </ol>
      </div>
      <div class="partners__closing" id="partner-contact">
        <div class="partner-proof">
          <p class="partner-proof__label">${l.partners.proofLabel}</p>
          <div class="partner-proof__metrics">
            ${renderMetrics(l.partners.proof, "partner-proof__metric")}
          </div>
        </div>
        <div class="partners__contact">
          <h3 class="partners__cta">${l.partners.cta}</h3>
          <div class="partners__contact-module">
            <p class="partners__person">
              <span>${l.partners.contacts}</span>
              <strong>${l.partners.person}</strong>
            </p>
            <div class="partners__channels">
              <a class="contact-action" href="${mailHref}" data-analytics-goal="contact_email" aria-label="${l.partners.emailLabel}">
                <span>${l.partners.emailCta}</span>${icons.external}
              </a>
              <a class="contact-action" href="${shared.telegramHref}" data-analytics-goal="contact_telegram" aria-label="${l.partners.telegramLabel}" target="_blank" rel="noopener noreferrer">
                <span>${l.partners.telegramCta}</span>${icons.external}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer class="site-footer" aria-labelledby="footer-title">
    <div class="site-footer__intro">
      <p class="site-footer__kicker">${l.footer.kicker}</p>
      <h2 id="footer-title">
        <span
          data-footer-prefix
          data-active="${l.footer.titleActive}"
          data-finished="${l.footer.titleFinished}"
        >${l.footer.titleLineOne}</span>
        <span data-footer-countdown data-optical-start aria-live="polite">${l.footer.titleLineTwo}</span>
      </h2>
      <a class="site-footer__cta action-primary" href="${mailHref}" data-analytics-goal="contact_email">
        ${l.footer.partnerCta}${icons.external}
      </a>
    </div>

    <div class="site-footer__directory">
      <nav class="site-footer__nav" aria-label="${l.footer.navLabel}">
        <p>${l.footer.navLabel}</p>
        ${renderNav(l.nav)}
      </nav>

      <div class="site-footer__utility">
        <p>${l.footer.utilityLabel}</p>
        ${renderThemeSwitcher(l)}
        <div class="site-footer__utility-links">
          <a data-language-switch href="${l.alternateHref}" hreflang="${l.lang === "ru" ? "en" : "ru"}">${l.footer.languageCta}${icons.external}</a>
          <a href="#top">${l.footer.top}${icons.up}</a>
        </div>
      </div>
    </div>

    <div class="site-footer__wordmark" aria-hidden="true">
      <img src="${l.assetBase}assets/logo.svg" alt="" width="512" height="231">
    </div>

    <a
      class="site-footer__after-credits"
      href="${shared.viktorTelegramHref}"
      data-analytics-goal="diary_follow"
      target="_blank"
      rel="noopener noreferrer"
    >
      <span aria-hidden="true"></span>
      <strong>${l.footer.afterCredits}</strong>
      ${icons.external}
    </a>

    <div class="site-footer__legal">
      <p>${l.footer.legal}</p>
      <div class="site-footer__credits">
        <a href="${shared.designHref}" target="_blank" rel="noopener noreferrer">${l.footer.designCredit}${icons.external}</a>
      </div>
    </div>
  </footer>
</body>
</html>
`, l.lang);
}

await mkdir(assetOutput, { recursive: true });
await cp(assetSource, assetOutput, {
  recursive: true,
  filter: (source) => {
    const assetName = source.slice(assetSource.length + 1);
    return (
      source !== styleModulesRoot &&
      !source.startsWith(`${styleModulesRoot}/`) &&
      !retiredAssetNames.has(assetName)
    );
  },
});
await writeFile(resolve(assetOutput, "styles.css"), styleBundle, "utf8");

for (const locale of Object.values(locales)) {
  const outputPath = resolve(outputRoot, locale.outputPath);
  await mkdir(resolve(outputPath, ".."), { recursive: true });
  await writeFile(outputPath, renderPage(locale), "utf8");
}

await writeFile(resolve(outputRoot, ".nojekyll"), "", "utf8");
await writeFile(
  resolve(outputRoot, "robots.txt"),
  "User-agent: *\nAllow: /\nSitemap: https://11111.life/sitemap.xml\n",
  "utf8",
);
await writeFile(
  resolve(outputRoot, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://11111.life/</loc></url>
  <url><loc>https://11111.life/en/</loc></url>
</urlset>
`,
  "utf8",
);

console.log(`Built ${outputRoot}`);
