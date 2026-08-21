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
  "21-diary-responsive.css",
  "25-bike-calendar.css",
  "30-proof-adventures-interviews.css",
  "31-proof-responsive.css",
  "40-partners-footer.css",
  "50-responsive.css",
  "55-editorial-menu.css",
  "60-themes-accessibility.css",
];
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
  calendarNearStartDays: 30,
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
    title: "11 111 км на велосипеде за 31 день — Виктор Доронин",
    description: "Виктор Доронин проедет 11 111 км на велосипеде за 31 день: от базовых 333 км до финальных 1111 км.",
    socialImage: "https://11111.life/assets/share-ru-bike-20260817-3.jpg",
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
        "Базовый ритм держит дистанцию между пятью вершинами. Финал — самый длинный непрерывный заезд.",
      imageAlt: "Виктор Доронин на велосипеде во время скоростного заезда",
      videoPlay: "Включить видео",
      videoPause: "Пауза",
      primaryCta: "Посмотреть форматы участия",
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
      peaksLabel:
        "Пять специальных этапов по нарастающей: 333, 555, 777, 999 и 1111 километров",
    },
    diary: createDiaryContent("ru"),
    manifesto: {
      eyebrow: "Одна большая цель",
      title: "Между вершинами — базовый ритм",
      text:
        "После каждого специального этапа Виктор возвращается к дневной дистанции проекта. Самые длинные этапы проходят как отдельные непрерывные заезды без деления на суточные части.",
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
      finishMeta: "День без заявленной дистанции",
      finishMonth: "декабря",
      finishDetail:
        "Команда фиксирует итоговый результат и завершает проект.",
      continuousLabel: "Один непрерывный заезд",
      oneDayLabel: "Один день",
      dailyLabel: "в день",
      totalBlockLabel: "за блок",
      baseSummary: "22 базовых дня",
      specialSummary: "5 специальных этапов",
      rideSummary: "30 дней движения",
      rhythmTitle: "Ритм до финала",
      rhythmText:
        "20 базовых дней — по 333 км; ещё два — по 338 км. Перед финальным этапом Виктор набирает ровно 10 000 км. Финальный этап — непрерывный заезд на 1111 км.",
      calendarFarTitle: "Полный календарь декабря",
      calendarFarMeta: "11 блоков · 1–31 декабря",
      calendarNearTitle: "План декабря",
      calendarNearMeta: "11 блоков · 1–31 декабря",
      calendarActiveTitle: "Календарь прохождения",
      calendarActiveMeta: "Текущий этап отмечен внутри",
      calendarFinishedTitle: "Архив плана декабря",
      calendarFinishedMeta:
        "Для сравнения с подтверждённым результатом",
      currentStageLabel: "Сейчас по плану",
      formulaLabel: "7336 плюс 3775 равно 11 111 километров",
      formulaBase: "7336",
      formulaSpecial: "3775",
      formulaResult: "11 111",
    },
    presence: {
      eyebrow: "Звуковой архив фильма «1111»",
      title: "Присутствие",
      description:
        "Три короткие сцены возвращают физическое ощущение дистанции: дыхание, ритм и скорость.",
      hint: "Выберите сцену, чтобы включить звук.",
      scenesLabel: "Выбрать звуковую сцену из фильма «1111»",
      play: "Включить сцену",
      pause: "Поставить сцену на паузу",
      scenes: [
        {
          title: "Дыхание",
          file: "audio-scene-01.m4a",
          duration: "13.973333",
          contextTitle: "Усилие",
          context:
            "Вдох, выдох и короткая пауза делают усилие слышимым.",
        },
        {
          title: "Ритм",
          file: "audio-scene-04.m4a",
          duration: "20.138667",
          contextTitle: "Повторение",
          context:
            "Отдельные движения складываются в устойчивый темп.",
        },
        {
          title: "Скорость",
          file: "audio-scene-05.m4a",
          duration: "16.298667",
          contextTitle: "Поток",
          context: "Шум воздуха делает скорость физически ощутимой.",
        },
      ],
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
      eyebrow: "Архив предыдущего проекта",
      title: "«1111»: фильм и проверяемый результат",
      body:
        "Предыдущий проект показал: аудитория готова к длинным форматам, честность работает лучше глянца, а история продолжает жить после финиша.",
      metrics: [
        ["≈1,3 млн", "просмотров пяти серий и фильма"],
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
            "Пять серий — 233, 239, 231, 231 и 273 тыс.; фильм — 92,1 тыс. Суммарно — около 1,299 млн просмотров.",
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
      title: "Что уже пройдено",
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
      archiveTitle: "Ещё четыре разговора",
      archiveHint: "Открыть архив интервью",
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
      proofLabel: "Опыт уже подтверждён",
      proofCta: "Смотреть результаты прошлого проекта",
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
    title: "11,111 km by bike in 31 days — Viktor Doronin",
    description: "Viktor Doronin will ride 11,111 km in 31 days: from a 333 km base rhythm to a final 1111 km stage.",
    socialImage: "https://11111.life/assets/share-en-bike-20260817-3.jpg",
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
    headerCta: "Discuss a partnership",
    hero: {
      kicker: "December 1–31, 2026 · Viktor Doronin",
      lineOne: ["11,111", "km"],
      lineTwo: ["31", "days"],
      accent: "BY BIKE",
      intro:
        "A steady base rhythm carries the project between five peaks. The finale is the longest continuous ride.",
      imageAlt: "Viktor Doronin riding at speed during a cycling event",
      videoPlay: "Play video",
      videoPause: "Pause",
      primaryCta: "View partnership options",
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
      peaksLabel:
        "Five escalating special stages: 333, 555, 777, 999 and 1111 kilometres",
    },
    diary: createDiaryContent("en"),
    manifesto: {
      eyebrow: "One defining goal",
      title: "A base rhythm between the peaks",
      text:
        "After every special stage, Viktor returns to the project’s daily distance. The longest stages are separate continuous rides, not divided into daily legs.",
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
      finishMeta: "No scheduled distance",
      finishMonth: "December",
      finishDetail:
        "The team records the final result and brings the project to a close.",
      continuousLabel: "One continuous ride",
      oneDayLabel: "One day",
      dailyLabel: "per day",
      totalBlockLabel: "for the block",
      baseSummary: "22 base days",
      specialSummary: "5 special stages",
      rideSummary: "30 days in motion",
      rhythmTitle: "The rhythm before the final stage",
      rhythmText:
        "Twenty base days cover 333 km each; two more cover 338 km. Before the final stage, Viktor reaches exactly 10,000 km. The final stage is a continuous 1111 km ride.",
      calendarFarTitle: "Full December calendar",
      calendarFarMeta: "11 blocks · December 1–31",
      calendarNearTitle: "December plan",
      calendarNearMeta: "11 blocks · December 1–31",
      calendarActiveTitle: "Race calendar",
      calendarActiveMeta: "The current planned stage is marked inside",
      calendarFinishedTitle: "December plan archive",
      calendarFinishedMeta: "For comparison with the verified result",
      currentStageLabel: "Current plan stage",
      formulaLabel: "7336 plus 3775 equals 11,111 kilometres",
      formulaBase: "7336",
      formulaSpecial: "3775",
      formulaResult: "11,111",
    },
    presence: {
      eyebrow: "Sound archive from the film “1111”",
      title: "Presence",
      description:
        "Three short scenes bring back the physical feeling of the distance: breath, rhythm and speed.",
      hint: "Choose a scene to play the audio.",
      scenesLabel: "Choose a sound scene from the film “1111”",
      play: "Play scene",
      pause: "Pause scene",
      scenes: [
        {
          title: "Breath",
          file: "audio-scene-01.m4a",
          duration: "13.973333",
          contextTitle: "Effort",
          context:
            "An inhale, an exhale and a short pause make the effort audible.",
        },
        {
          title: "Rhythm",
          file: "audio-scene-04.m4a",
          duration: "20.138667",
          contextTitle: "Repetition",
          context: "Separate movements settle into a sustained rhythm.",
        },
        {
          title: "Speed",
          file: "audio-scene-05.m4a",
          duration: "16.298667",
          contextTitle: "Airflow",
          context: "The rush of air makes speed feel physical.",
        },
      ],
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
      eyebrow: "Archive of the previous project",
      title: "“1111”: the film and a verifiable result",
      body:
        "The previous project showed that audiences embrace long-form stories, honesty outperforms gloss, and the story lives on after the finish.",
      metrics: [
        ["≈1.3M", "views across five episodes and the film"],
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
      title: "What Viktor has already completed",
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
      archiveTitle: "Four more conversations",
      archiveHint: "Open the interview archive",
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
      proofLabel: "Proven experience",
      proofCta: "See the previous project’s results",
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
  disclosure: `
    <svg class="icon icon--disclosure" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="m4.5 6.5 3.5 3.5 3.5-3.5"></path>
    </svg>`,
  newer: `
    <svg class="icon icon--newer" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="m10.5 3-5 5 5 5"></path>
    </svg>`,
  earlier: `
    <svg class="icon icon--earlier" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="m5.5 3 5 5-5 5"></path>
    </svg>`,
};

const mediaIcons = {
  play: `
    <svg class="media-play-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="m4.25 2.75 8.5 5.25-8.5 5.25Z"></path>
    </svg>`,
  toggle: `
    <svg class="media-toggle-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path class="media-toggle-icon__play" d="m4.25 2.75 8.5 5.25-8.5 5.25Z"></path>
      <path class="media-toggle-icon__pause" d="M4.5 3h2.25v10H4.5zM9.25 3h2.25v10H9.25z"></path>
    </svg>`,
};

const presenceSceneIcons = [
  `<svg class="audio-story__scene-icon audio-story__scene-icon--breath" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <path d="M18.084 24.785c-2.604-1.529-1.994-5.207-.155-7.022c3.188-3.212 8.526-2.15 11.285 1.015c4 4.598 2.436 11.584-2.233 15.107c-6.174 4.681-15.107 2.627-19.526-3.344c-5.54-7.488-2.937-18.056 4.574-23.287c9.1-6.21 21.723-3.105 27.813 5.696c7.046 10.247 3.5 24.279-6.77 31.05"></path>
  </svg>`,
  `<svg class="audio-story__scene-icon audio-story__scene-icon--rhythm" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <path d="M2 25h9l5-12 6 24 8-34 7 22h9"></path>
  </svg>`,
  `<svg class="audio-story__scene-icon audio-story__scene-icon--speed" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <path d="M29 3 9 29h14l-4 16 20-27H25Z"></path>
  </svg>`,
];

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
      const calendarDate = formatCalendarRange(segment, l.lang);
      const calendarValue =
        segment.kind === "finish"
          ? ""
          : `${value}\u00a0${l.distance.totalUnit}`;

      return `
        <article
          class="bike-calendar__segment bike-calendar__segment--${segment.kind}"
          id="calendar-segment-${String(index + 1).padStart(2, "0")}"
          style="--calendar-order:${index}"
          data-calendar-start="${segment.startDate}"
          data-calendar-end="${segment.endDate}"
          data-calendar-date="${escapeAttribute(calendarDate)}"
          data-calendar-label="${escapeAttribute(label)}"
          data-calendar-value="${escapeAttribute(calendarValue)}"
        >
          <div class="bike-calendar__segment-meta">
            <span>${String(index + 1).padStart(2, "0")}</span>
            ${
              segment.kind === "finish"
                ? ""
                : `<time datetime="${segment.startDate}">${formatCalendarRange(segment, l.lang)}</time>`
            }
          </div>
          <div class="bike-calendar__segment-main">
            <p class="bike-calendar__segment-label">${label}</p>
            ${
              segment.kind === "finish"
                ? `<time class="bike-calendar__finish-date" datetime="${segment.startDate}"><strong class="bike-calendar__finish-mark" data-optical-start data-optical-leading="3">31</strong><span>${l.distance.finishMonth}</span></time>`
                : `<p class="bike-calendar__segment-value" data-optical-start data-optical-leading="${String(value).trim().charAt(0)}"><strong>${value}</strong><span>${l.distance.totalUnit}</span></p>`
            }
            ${
              segment.kind === "finish"
                ? `<p class="bike-calendar__segment-detail bike-calendar__finish-detail">${l.distance.finishDetail}</p>`
                : detail
                  ? `<p class="bike-calendar__segment-detail">${detail}</p>`
                  : ""
            }
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
              width="${entry.mediaWidth ?? 720}"
              height="${entry.mediaHeight ?? 1280}"
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

function renderDiaryGallery(entry, entryIndex, l) {
  const hasMultipleMedia = entry.media.length > 1;
  const activeMediaIndex = entry.featuredMedia;
  const activeMedia = entry.media[activeMediaIndex];
  const mediaPanels = entry.media
    .map((media, mediaIndex) => {
      const isActive = mediaIndex === activeMediaIndex;
      const panelId = `diary-media-${entry.date}-${mediaIndex + 1}`;
      const tabId = `diary-media-tab-${entry.date}-${mediaIndex + 1}`;
      const relationship = hasMultipleMedia
        ? `role="tabpanel" aria-labelledby="${tabId}"`
        : "";

      return `
        <div
          class="diary-media__panel diary-media__panel--${media.kind}"
          id="${panelId}"
          ${relationship}
          ${isActive ? "" : "hidden"}
          data-diary-media-panel
        >
          ${
            media.kind === "image"
              ? `<img
                  src="${l.assetBase}assets/${media.src}"
                  alt="${escapeAttribute(media.alt)}"
                  width="${media.width}"
                  height="${media.height}"
                  loading="${entryIndex === 0 && isActive ? "eager" : "lazy"}"
                  decoding="async"
                  data-diary-image
                >`
              : `<video
                  src="${l.assetBase}assets/${media.src}"
                  poster="${l.assetBase}assets/${media.poster}"
                  width="${media.width}"
                  height="${media.height}"
                  preload="none"
                  controls
                  playsinline
                  aria-label="${escapeAttribute(media.alt)}"
                  data-diary-video
                ></video>
                <button
                  class="diary__play"
                  type="button"
                  aria-label="${escapeAttribute(media.playLabel)}"
                  data-diary-video-play
                >
                  <span class="diary__play-label">${entry.videoPlayCta}</span>
                  <span class="diary__play-meta">
                    <time datetime="${media.durationIso}">${media.duration}</time>
                    ${mediaIcons.play}
                  </span>
                </button>`
          }
        </div>`;
    })
    .join("");

  const mediaNavigation = hasMultipleMedia
    ? `
      <div class="diary-media__navigation">
        <div class="diary-media__status">
          <span class="diary-media__position" aria-hidden="true">
            <strong data-diary-media-position-current>${String(
              activeMediaIndex + 1,
            ).padStart(2, "0")}</strong>
            <span>/</span>
            <span>${String(entry.media.length).padStart(2, "0")}</span>
            <span class="diary-media__kind" data-diary-media-kind>${activeMedia.statusLabel}</span>
          </span>
          <span
            class="sr-only"
            aria-live="polite"
            data-diary-media-position
            data-diary-media-position-template="${escapeAttribute(
              l.diary.mediaPositionTemplate,
            )}"
          >${l.diary.mediaPositionTemplate
            .replace("{current}", String(activeMediaIndex + 1))
            .replace("{total}", String(entry.media.length))
            .replace("{label}", activeMedia.statusLabel)}</span>
          <div class="diary-media__controls" role="group" aria-label="${escapeAttribute(
            l.diary.mediaGalleryLabel,
          )}">
            <button
              type="button"
              aria-label="${escapeAttribute(l.diary.mediaPreviousLabel)}"
              data-diary-media-previous
              ${activeMediaIndex === 0 ? "disabled" : ""}
            >${icons.newer}</button>
            <button
              type="button"
              aria-label="${escapeAttribute(l.diary.mediaNextLabel)}"
              data-diary-media-next
              ${activeMediaIndex === entry.media.length - 1 ? "disabled" : ""}
            >${icons.earlier}</button>
          </div>
        </div>
        <div
          class="diary-media__rail"
          role="tablist"
          aria-label="${escapeAttribute(l.diary.mediaGalleryLabel)}"
          data-diary-media-tabs
        >
          ${entry.media
            .map((media, mediaIndex) => {
              const isActive = mediaIndex === activeMediaIndex;
              const thumbnail = media.poster || media.src;

              return `
                <button
                  class="diary-media__tab diary-media__tab--${media.kind}"
                  id="diary-media-tab-${entry.date}-${mediaIndex + 1}"
                  type="button"
                  role="tab"
                  aria-controls="diary-media-${entry.date}-${mediaIndex + 1}"
                  aria-selected="${isActive ? "true" : "false"}"
                  aria-label="${escapeAttribute(media.tabLabel)}"
                  data-diary-media-label="${escapeAttribute(media.statusLabel)}"
                  data-diary-media-tab
                  draggable="false"
                  tabindex="${isActive ? "0" : "-1"}"
                >
                  <img
                    src="${l.assetBase}assets/${thumbnail}"
                    alt=""
                    width="${media.width}"
                    height="${media.height}"
                    loading="lazy"
                    decoding="async"
                    draggable="false"
                  >
                  <span class="diary-media__tab-index" aria-hidden="true">${String(
                    mediaIndex + 1,
                  ).padStart(2, "0")}</span>
                  <span class="diary-media__tab-kind" aria-hidden="true">
                    ${
                      media.kind === "video"
                        ? `${mediaIcons.play}<time datetime="${media.durationIso}">${media.duration}</time>`
                        : media.kindLabel
                    }
                  </span>
                </button>`;
            })
            .join("")}
        </div>
      </div>`
    : "";

  return `
    <div
      class="diary__gallery${hasMultipleMedia ? " diary__gallery--multiple" : ""}"
      data-diary-gallery
    >
      <figure
        class="diary__media diary__media--${entry.mediaKind}"
        style="--diary-media-aspect:${entry.mediaAspect || activeMedia.aspect}"
        aria-label="${escapeAttribute(l.diary.mediaGalleryLabel)}"
      >
        ${mediaPanels}
      </figure>
      ${mediaNavigation}
    </div>`;
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
          ${renderDiaryGallery(entry, index, l)}
          <div class="diary__copy">
            <h3 data-optical-start data-optical-scope="first-line">${entry.title}</h3>
            ${entry.lead ? `<p class="diary__lead">${entry.lead}</p>` : ""}
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

function renderPresence(presence, l) {
  return `
    <section class="audio-story" id="presence" aria-labelledby="presence-title">
      <div class="audio-story__intro">
        <div class="audio-story__meta">
          <p>${presence.eyebrow}</p>
        </div>
        <div class="audio-story__copy">
          <h2 id="presence-title">${presence.title}</h2>
          <p>${presence.description}</p>
        </div>
      </div>
      <div class="audio-story__player" data-presence-player>
        <p class="audio-story__hint">${presence.hint}</p>
        <ol class="audio-story__storyline" aria-label="${presence.scenesLabel}">
          ${presence.scenes
            .map(
              (scene, index) => `
            <li>
              <button
                type="button"
                data-presence-scene
                data-scene-title="${scene.title}"
                data-audio-src="${l.assetBase}assets/${scene.file}"
                data-duration="${scene.duration}"
                data-play-label="${presence.play}"
                data-pause-label="${presence.pause}"
                data-playing="false"
                aria-label="${presence.play}: ${scene.title}"
                aria-pressed="${index === 0 ? "true" : "false"}"
              >
                <span class="audio-story__scene-line" aria-hidden="true"><i data-scene-progress></i></span>
                <span class="audio-story__scene-head">
                  ${presenceSceneIcons[index]}
                </span>
                <span class="audio-story__scene-foot">
                  <strong>${scene.title}</strong>
                  <span class="audio-story__wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
                </span>
              </button>
            </li>`,
            )
            .join("")}
        </ol>
        <div class="audio-story__contexts" aria-live="polite" aria-atomic="true">
          ${presence.scenes
            .map(
              (scene, index) => `
                <p data-presence-context${index === 0 ? "" : " hidden"}>
                  <strong>${scene.contextTitle}</strong>
                  <span>${scene.context}</span>
                </p>`,
            )
            .join("")}
        </div>
      </div>
      <audio
        data-presence-audio
        preload="none"
        src="${l.assetBase}assets/${presence.scenes[0].file}"
      ></audio>
    </section>`;
}

function renderInterviews(items, l, startIndex = 0) {
  return items
    .map(
      (item, index) => {
        const itemIndex = startIndex + index;

        return `
        <a
          class="interview-card${itemIndex === 0 ? " interview-card--featured" : " interview-card--index"}"
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
              <span>${String(itemIndex + 1).padStart(2, "0")}</span>
              ${item.source}
            </p>
            <h3>${item.title}</h3>
            <span class="interview-card__action">
              ${l.interviews.watch}
              ${icons.external}
            </span>
          </div>
        </a>`;
      },
    )
    .join("");
}

function renderStory(items, l) {
  return items
    .map(
      (item, index) => `
        <figure
          class="story-frame${item.video ? " story-frame--motion" : ""}${item.caption === "Движение" || item.caption === "Motion" ? " story-frame--movement" : ""}"
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
                    ${mediaIcons.toggle}
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

function renderHeroPeaks(plan, l) {
  const stages = plan.segments.filter((segment) => segment.kind === "special");
  const values = stages.map((stage) => stage.totalDistanceKm);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const baseline = 88;
  const routeFloor = 82;
  const firstX = 54;
  const lastX = 538;
  const peakPoints = stages.map((stage) => {
    const startDay = Number(stage.startDate.slice(-2));
    const endDay = Number(stage.endDate.slice(-2));
    const calendarPoint = (startDay + endDay) / 2;
    const progress = (stage.totalDistanceKm - minValue) / (maxValue - minValue);

    return {
      date: stage.startDate,
      value: stage.totalDistanceKm,
      x: firstX + ((calendarPoint - 1) / 28.5) * (lastX - firstX),
      y: 59 - progress * 43,
    };
  });
  const terrainPatterns = [
    [[0.13, -7], [0.28, -2], [0.43, -10], [0.58, -5], [0.72, -13], [0.86, 13]],
    [[0.12, -4], [0.25, -11], [0.39, -6], [0.53, -2], [0.67, -9], [0.83, 17]],
    [[0.1, -8], [0.23, -3], [0.37, -12], [0.5, -7], [0.64, -2], [0.79, 19]],
    [[0.11, -5], [0.24, -13], [0.38, -7], [0.52, -3], [0.66, -10], [0.82, 16]],
  ];
  const routePoints = [[0, routeFloor], [18, routeFloor - 6], peakPoints[0]];

  for (let index = 0; index < peakPoints.length - 1; index += 1) {
    const current = peakPoints[index];
    const next = peakPoints[index + 1];
    const gap = next.x - current.x;

    for (const [position, offset] of terrainPatterns[index]) {
      const isApproach = position > 0.75;
      routePoints.push({
        x: current.x + gap * position,
        y: isApproach
          ? Math.min(routeFloor, next.y + offset)
          : Math.min(routeFloor, routeFloor + offset),
      });
    }
    routePoints.push(next);
  }

  routePoints.push({ x: 582, y: 20 }, { x: 600, y: 23 });
  const routePath = routePoints
    .map((point, index) => {
      const x = Array.isArray(point) ? point[0] : point.x;
      const y = Array.isArray(point) ? point[1] : point.y;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
  const areaPath = `${routePath} L600 ${baseline} L0 ${baseline} Z`;

  const labelMarkup = peakPoints
    .map(
      (peak, index) => `
        <li data-date="${peak.date}" style="--peak-x:${((peak.x / 600) * 100).toFixed(3)}%;--peak-y:${((peak.y / 88) * 100).toFixed(3)}%;--peak-order:${index}">
          <strong>${formatProjectNumber(peak.value, l.lang)}</strong>
        </li>`,
    )
    .join("");

  return `
    <div class="hero-peaks" role="img" aria-label="${escapeAttribute(l.hero.peaksLabel)}">
      <svg viewBox="0 0 600 88" aria-hidden="true" focusable="false" preserveAspectRatio="none">
        <path class="hero-peaks__area" d="${areaPath}"></path>
        <path class="hero-peaks__route" d="${routePath}" pathLength="1"></path>
      </svg>
      <ol class="hero-peaks__labels" aria-hidden="true">${labelMarkup}</ol>
    </div>`;
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
            <a class="site-nav__cta action-primary" href="#partner-contact" data-analytics-goal="partner_interest"><span>${l.footer.partnerCta}</span>${icons.down}</a>
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
          ${mediaIcons.toggle}
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
        ${renderHeroPeaks(projectPlan, l)}
      </div>
    </section>

    <section class="diary section section--light" id="diary" aria-labelledby="diary-title">
      <div
        class="diary-live"
        data-diary-live
        data-campaign-start="2026-03-10T00:00:00+03:00"
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
            <a class="button button--diary-secondary" href="#diary-archive">${l.diary.archiveCta}${icons.down}</a>
          </div>
        </div>
        <div class="diary-live__timeline" aria-hidden="true">
          <span><i></i></span>
          <div>
            <b
              data-phase-copy
              data-before="${escapeAttribute(l.diary.timelineArchiveStart)}"
              data-active="${escapeAttribute(l.diary.timelineStart)}"
              data-finished="${escapeAttribute(l.diary.timelineStart)}"
            >${l.diary.timelineArchiveStart}</b>
            <b
              class="diary-live__timeline-now"
              data-timeline-now
              data-before="${escapeAttribute(l.diary.timelineNow)}"
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
        <div class="diary-stories__navigation">
          <span class="diary-stories__position" aria-hidden="true">
            <strong data-diary-story-position-current>01</strong>
            <span>/</span>
            <span>${String(l.diary.entries.length).padStart(2, "0")}</span>
          </span>
          <span
            class="sr-only"
            aria-live="polite"
            data-diary-story-position
            data-diary-story-position-template="${escapeAttribute(l.diary.storyPositionTemplate)}"
          >${l.diary.storyPositionTemplate
            .replace("{current}", "1")
            .replace("{total}", String(l.diary.entries.length))}</span>
          <div class="diary-stories__controls" role="group" aria-label="${l.diary.storiesLabel}">
            <button
              type="button"
              aria-label="${l.diary.storyNewerLabel}"
              data-diary-story-newer
              disabled
            >${icons.newer}</button>
            <button
              type="button"
              aria-label="${l.diary.storyEarlierLabel}"
              data-diary-story-earlier
            >${icons.earlier}</button>
          </div>
        </div>
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
        <aside class="bike-calendar__current" data-calendar-current hidden>
          <p>${l.distance.currentStageLabel}</p>
          <a href="#distance" data-calendar-current-link>
            <span data-calendar-current-date></span>
            <strong data-calendar-current-title></strong>
            <span data-calendar-current-value></span>
            ${icons.down}
          </a>
        </aside>
        <details
          class="bike-calendar__details"
          data-calendar-details
          data-calendar-ready="${String(projectPlan.unconfirmedFacts.length === 0)}"
          data-calendar-near-days="${shared.calendarNearStartDays}"
        >
          <summary>
            <span>
              <strong
                data-calendar-phase-copy
                data-far="${escapeAttribute(l.distance.calendarFarTitle)}"
                data-near="${escapeAttribute(l.distance.calendarNearTitle)}"
                data-active="${escapeAttribute(l.distance.calendarActiveTitle)}"
                data-finished="${escapeAttribute(l.distance.calendarFinishedTitle)}"
              >${l.distance.calendarFarTitle}</strong>
              <small
                data-calendar-phase-copy
                data-far="${escapeAttribute(l.distance.calendarFarMeta)}"
                data-near="${escapeAttribute(l.distance.calendarNearMeta)}"
                data-active="${escapeAttribute(l.distance.calendarActiveMeta)}"
                data-finished="${escapeAttribute(l.distance.calendarFinishedMeta)}"
              >${l.distance.calendarFarMeta}</small>
            </span>
            ${icons.disclosure}
          </summary>
          <div class="bike-calendar__details-body">
            <div class="bike-calendar__rhythm">
              <div>
                <p>${l.distance.rhythmTitle}</p>
                <span>${l.distance.rhythmText}</span>
              </div>
            </div>
            <div class="bike-calendar__segments">
              ${renderCalendarSegments(projectPlan, l)}
            </div>
            <div class="bike-calendar__total" role="img" aria-label="${l.distance.formulaLabel}">
              <p><span>${l.distance.baseSummary}</span><strong>${l.distance.formulaBase}</strong></p>
              <b class="bike-calendar__operator bike-calendar__operator--plus" aria-hidden="true">+</b>
              <p><span>${l.distance.specialSummary}</span><strong>${l.distance.formulaSpecial}</strong></p>
              <div class="bike-calendar__total-answer" data-unit="${escapeAttribute(l.distance.totalUnit)}">
                <b class="bike-calendar__operator bike-calendar__operator--equals" aria-hidden="true">=</b>
                <p class="bike-calendar__total-result"><span>${l.distance.totalLabel}</span><strong data-optical-start>${l.distance.formulaResult}<small>${l.distance.totalUnit}</small></strong></p>
              </div>
            </div>
          </div>
        </details>
      </div>
    </section>

    ${renderPresence(l.presence, l)}

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
          ${icons.disclosure}
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
        ${renderInterviews(l.interviews.items.slice(0, 4), l)}
      </div>
      <details class="interviews__archive">
        <summary>
          <span>${l.interviews.archiveTitle}</span>
          <small>${l.interviews.archiveHint}</small>
          ${icons.disclosure}
        </summary>
        <div class="interview-grid interview-grid--archive">
          ${renderInterviews(l.interviews.items.slice(4), l, 4)}
        </div>
      </details>
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
        <div class="partner-proof partner-proof--reference">
          <a class="partner-proof__link" href="#proof">
            <span class="partner-proof__label">${l.partners.proofLabel}</span>
            <strong>${l.partners.proofCta}</strong>
            ${icons.up}
          </a>
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
      <h2 id="footer-title">
        <span
          data-footer-prefix
          data-active="${l.footer.titleActive}"
          data-finished="${l.footer.titleFinished}"
        >${l.footer.titleLineOne}</span>
        <span data-footer-countdown data-optical-start aria-live="polite">${l.footer.titleLineTwo}</span>
      </h2>
      <a class="site-footer__cta action-primary" href="#partner-contact" data-analytics-goal="partner_interest">
        ${l.footer.partnerCta}${icons.up}
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

const renderedPages = Object.values(locales).map((locale) => [
  locale,
  renderPage(locale),
]);
const productionAssetNames = new Set([
  ...`${styleBundle}\n${renderedPages.map(([, html]) => html).join("\n")}`.matchAll(
    /\bassets\/([a-z0-9][a-z0-9._/-]*)/giu,
  ),
  ...styleBundle.matchAll(/url\(["']?\.\/([a-z0-9][a-z0-9._/-]*)/giu),
].map((match) => match[1]));
const productionAssetDirectories = new Set();
for (const assetName of productionAssetNames) {
  const parts = assetName.split("/");
  for (let index = 1; index < parts.length; index += 1) {
    productionAssetDirectories.add(parts.slice(0, index).join("/"));
  }
}

await mkdir(assetOutput, { recursive: true });
await cp(assetSource, assetOutput, {
  recursive: true,
  filter: (source) => {
    if (source === assetSource) return true;
    const assetName = source.slice(assetSource.length + 1);
    return (
      source !== styleModulesRoot &&
      !source.startsWith(`${styleModulesRoot}/`) &&
      assetName !== "styles.css" &&
      (productionAssetNames.has(assetName) ||
        productionAssetDirectories.has(assetName))
    );
  },
});
await writeFile(resolve(assetOutput, "styles.css"), styleBundle, "utf8");

for (const [locale, html] of renderedPages) {
  const outputPath = resolve(outputRoot, locale.outputPath);
  await mkdir(resolve(outputPath, ".."), { recursive: true });
  await writeFile(outputPath, html, "utf8");
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
