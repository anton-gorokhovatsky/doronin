import { createHash } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

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
  "30-proof-adventures-interviews.css",
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

await rm(outputRoot, { recursive: true, force: true });

const shared = {
  email: "anesterova88@gmail.com",
  telegramHref: "https://t.me/alraunean",
  viktorTelegramHref: "https://t.me/doroninvdele",
  diaryPostHref: "https://t.me/doroninvdele/484",
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
      "Виктор Доронин преодолеет в Дубае 11 111 км за 31 день: плавание, велосипед и бег. Старт — 1 декабря 2026 года.",
    socialImage: "https://11111.life/assets/share-ru.jpg",
    socialAlt: "11 111 км за 31 день. Виктор Доронин. Старт 1 декабря 2026 года в Дубае.",
    skip: "Перейти к содержанию",
    homeLabel: "11 111 — на главную",
    menu: "Меню",
    navLiveKicker: "Сейчас",
    navLiveLabel: "Дневник",
    navRouteKicker: "Маршрут · 07 глав",
    navDiaryLabel: "Дневник подготовки",
    navDiaryNote: "Тренировки, команда и путь к старту",
    nav: [
      ["#about", "Проект"],
      ["#distance", "Дистанция"],
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
      accent: "ОДИН ШАНС",
      intro: "Первый в мире 31-дневный ультратриатлон.",
      imageAlt: "Виктор Доронин на велосипеде во время скоростного заезда",
      videoPlay: "Включить видео",
      videoPause: "Пауза",
      audioPlay: "Запустить звуковую историю",
      audioPause: "Поставить звуковую историю на паузу",
      audioStoryLabel: "Пять звуковых сцен",
      audioStoryTitle: "Присутствие",
      audioStoryNote:
        "Фрагменты из фильма: дыхание, голос, вода, ритм и скорость.",
      audioPrompt: "Войти в звук",
      audioActive: "Пауза",
      audioScenesLabel: "Выбрать звуковую сцену",
      audioScenes: [
        {
          title: "Дыхание",
          file: "audio-scene-01.m4a",
          duration: "13.973333",
          context: "Дыхание и шаги в момент предельной нагрузки.",
        },
        {
          title: "Голос",
          file: "audio-scene-02.m4a",
          duration: "50.410667",
          context: "Фрагмент речи из документального фильма «1111».",
        },
        {
          title: "Вода",
          file: "audio-scene-03.m4a",
          duration: "23.658667",
          context: "Вода бассейна и ритм гребка.",
        },
        {
          title: "Ритм",
          file: "audio-scene-04.m4a",
          duration: "20.138667",
          context: "Механический ритм длинной тренировки.",
        },
        {
          title: "Скорость",
          file: "audio-scene-05.m4a",
          duration: "16.298667",
          context: "Ветер и шум движения на скорости.",
        },
      ],
      primaryCta: "Обсудить участие",
      secondaryCta: "Как это устроено",
      statusFallback: "Старт 1 декабря 2026",
      statusMeta: "11 111 км · 31 день",
      beforeForms: ["день до старта", "дня до старта", "дней до старта"],
      activeLabel: "день из 31",
      finishedLabel: "Плановый период проекта завершён",
      latestUpdate: "Последнее подтверждённое обновление",
      sourceLabel: "Источник",
      statusPending:
        "Подтверждённые данные появятся после обновления команды",
      footLabel: "Не спортивное событие",
      footText: "История, в которую можно войти",
    },
    diary: {
      phaseBefore: "Дневник подготовки",
      phaseActive: "31 день проекта",
      phaseFinished: "Архив истории",
      title: "Что дальше?",
      date: "2026-03-23",
      dateLabel: "23 марта 2026",
      image: "diary-2026-03-23.jpg",
      video: "diary-2026-03-23.mp4",
      imageAlt:
        "Виктор Доронин проходит тестирование на велосипеде с газоанализатором",
      videoLabel:
        "Видео из дневника подготовки: Виктор Доронин проходит тестирование на велосипеде",
      videoPlayLabel: "Воспроизвести видео из дневника, 15 секунд",
      videoPlayCta: "Смотреть видео",
      videoDuration: "00:15",
      lead:
        "После 60 дней базовой работы Виктор сверил ощущения с цифрами: газоанализ, лактат, мощность и пульс.",
      facts: [
        ["60 дней", "базовой подготовки"],
        ["203 часа", "нагрузки"],
      ],
      note:
        "Следующий цикл — три месяца работы над силой и скоростью, затем повторный тест.",
      cta: "Читать запись в Telegram",
      externalLabel: "Откроется дневник Виктора в Telegram",
      phasesLabel: "Состояния проекта",
      phases: [
        ["before", "Подготовка", "Дневник, тренировки и сбор команды"],
        ["active", "31 день", "Ежедневный ход дистанции"],
        ["finished", "После финиша", "Фильм, результаты и архив"],
      ],
    },
    manifesto: {
      eyebrow: "Цель проекта",
      title: "Показать, что человек может больше, чем думает.",
      text:
        "11 111 км — не авантюра, а новый масштаб уже работающей формулы: предельная дистанция, честный герой и история, за которой хочется следить до конца.",
    },
    distance: {
      eyebrow: "Один проект · три дисциплины",
      title: "Дистанция, которую трудно представить",
      intro:
        "31 день подряд. Числа здесь не декор — каждое можно перевести в знакомый человеку масштаб.",
      totalLabel: "Итого за 31 день",
      totalValue: "11 111",
      totalUnit: "км",
      sequenceLabel: "Этап",
      sequenceOf: "из",
      sequenceTotal: "всего",
      totalFormulaLabel: "100 плюс 10 010 плюс 1 001 равно 11 111 километров",
      mediaKicker: "Дубай · архив проекта «1111»",
      items: [
        {
          index: "01",
          value: "100",
          unit: "км",
          label: "плавание",
          image: "distance-swim-presence.jpg",
          video: "distance-swim-presence.mp4",
          details: [
            "2 000 бассейнов по 50 метров",
            "три переправы через Ла-Манш",
            "от Москвы до Ярославля без передышки в воде",
          ],
        },
        {
          index: "02",
          value: "10 010",
          unit: "км",
          label: "велосипед",
          image: "distance-bike-presence.jpg",
          video: "distance-bike-presence.mp4",
          details: [
            "почти поперёк России: Москва — Владивосток",
            "четверть экватора Земли",
            "Москва — Париж — Москва — Париж",
          ],
        },
        {
          index: "03",
          value: "1 001",
          unit: "км",
          label: "бег",
          image: "distance-run-presence.jpg",
          video: "distance-run-presence.mp4",
          details: [
            "24 полных марафона подряд",
            "Москва — Санкт-Петербург и ещё 300 км",
            "10 кругов по МКАД нон-стоп",
          ],
        },
      ],
    },
    viktor: {
      eyebrow: "О герое",
      title: "Виктор Доронин",
      lead: "47 лет. Не создаёт образ — живёт в нём.",
      body: `Идеолог сообществ <a href="${shared.dustyDumbbellsHref}" target="_blank" rel="noopener noreferrer">«Пыльные гантели»</a> и&nbsp;<a href="${shared.gastrodinamikaHref}" target="_blank" rel="noopener noreferrer">«Гастродинамика»</a>, друг, мотиватор и&nbsp;один из сильнейших любителей в триатлоне.`,
      imageAlt: "Виктор Доронин на дистанции в пустыне",
      achievements: [
        ["4×", "участник чемпионата мира WC Ironman Kona"],
        ["252,8 км", "Marathon des Sables в Сахаре"],
        ["17 696 м", "двойной Everesting за один заезд"],
        ["58 часов", "ультратриатлон 1 111 км без сна"],
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
          title: "Формат «11 111»",
          body:
            "Статус первой попытки 31-дневного ультратриатлона — утверждение команды проекта; независимая фиксация будет добавлена после старта.",
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
        "Разговоры о триатлоне, беге, сообществах и больших дистанциях.",
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
          "Совместно рассказываем историю до старта, во время проекта и после финиша.",
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
          "Работаем до старта, все 31 день проекта и после финиша.",
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
      afterCredits: "Дневник подготовки",
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
      "In Dubai, Viktor Doronin will cover 11,111 km in 31 days through swimming, cycling and running. Starts December 1, 2026.",
    socialImage: "https://11111.life/assets/share-en.jpg",
    socialAlt: "11,111 km in 31 days. Viktor Doronin. Starts December 1, 2026 in Dubai.",
    skip: "Skip to content",
    homeLabel: "11 111 — home",
    menu: "Menu",
    navLiveKicker: "Now",
    navLiveLabel: "Diary",
    navRouteKicker: "Route · 07 chapters",
    navDiaryLabel: "Training diary",
    navDiaryNote: "Training, the team and the road to the start",
    nav: [
      ["#about", "Project"],
      ["#distance", "Distance"],
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
      accent: "ONE CHANCE",
      intro: "The world’s first 31-day ultra-triathlon.",
      imageAlt: "Viktor Doronin riding at speed during a cycling event",
      videoPlay: "Play video",
      videoPause: "Pause",
      audioPlay: "Start the sound story",
      audioPause: "Pause the sound story",
      audioStoryLabel: "Five sound scenes",
      audioStoryTitle: "Presence",
      audioStoryNote:
        "Fragments from the film: breath, voice, water, rhythm, and speed.",
      audioPrompt: "Enter the sound",
      audioActive: "Pause",
      audioScenesLabel: "Choose a sound scene",
      audioScenes: [
        {
          title: "Breath",
          file: "audio-scene-01.m4a",
          duration: "13.973333",
          context: "Breath and footsteps at the limit of an effort.",
        },
        {
          title: "Voice",
          file: "audio-scene-02.m4a",
          duration: "50.410667",
          context: "A spoken fragment from the documentary film “1111”.",
        },
        {
          title: "Water",
          file: "audio-scene-03.m4a",
          duration: "23.658667",
          context: "Pool water and the rhythm of each stroke.",
        },
        {
          title: "Rhythm",
          file: "audio-scene-04.m4a",
          duration: "20.138667",
          context: "The mechanical rhythm of a long training session.",
        },
        {
          title: "Speed",
          file: "audio-scene-05.m4a",
          duration: "16.298667",
          context: "Wind and the sound of movement at speed.",
        },
      ],
      primaryCta: "Discuss a partnership",
      secondaryCta: "See the challenge",
      statusFallback: "Starts December 1, 2026",
      statusMeta: "11,111 km · 31 days",
      beforeForms: ["day to start", "days to start", "days to start"],
      activeLabel: "day of 31",
      finishedLabel: "The scheduled project period has ended",
      latestUpdate: "Latest verified update",
      sourceLabel: "Source",
      statusPending: "Verified figures will appear after the team’s update",
      footLabel: "Not a sporting event",
      footText: "A story you can become part of",
    },
    diary: {
      phaseBefore: "Training diary",
      phaseActive: "31 days underway",
      phaseFinished: "Story archive",
      title: "What comes next?",
      date: "2026-03-23",
      dateLabel: "March 23, 2026",
      image: "diary-2026-03-23.jpg",
      video: "diary-2026-03-23.mp4",
      imageAlt:
        "Viktor Doronin undergoes a cycling test while wearing a gas-analysis mask",
      videoLabel:
        "Training diary video: Viktor Doronin undergoes a cycling test",
      videoPlayLabel: "Play the 15-second training diary video",
      videoPlayCta: "Watch video",
      videoDuration: "00:15",
      lead:
        "After 60 days of base work, Viktor checked perception against data: gas analysis, lactate, power and heart rate.",
      facts: [
        ["60 days", "of base training"],
        ["203 hours", "of training load"],
      ],
      note:
        "The next cycle is three months of strength and speed work, followed by a repeat test.",
      cta: "Read the update on Telegram",
      externalLabel: "Opens Viktor’s training diary on Telegram",
      phasesLabel: "Project states",
      phases: [
        ["before", "Preparation", "Training diary and team building"],
        ["active", "31 days", "Daily progress across the distance"],
        ["finished", "After the finish", "Film, results and archive"],
      ],
    },
    manifesto: {
      eyebrow: "Project goal",
      title: "To show that a person can go further than they think.",
      text:
        "11,111 km is not a stunt. It is the next scale of a model that already works: an extreme distance, an honest protagonist, and a story worth following to the end.",
    },
    distance: {
      eyebrow: "One project · three disciplines",
      title: "A distance that is hard to imagine",
      intro:
        "Thirty-one days in succession. These figures are not decoration — each one translates into a scale people can understand.",
      totalLabel: "Total over 31 days",
      totalValue: "11,111",
      totalUnit: "km",
      sequenceLabel: "Stage",
      sequenceOf: "of",
      sequenceTotal: "total",
      totalFormulaLabel: "100 plus 10,010 plus 1,001 equals 11,111 kilometres",
      mediaKicker: "Dubai · Project “1111” archive",
      items: [
        {
          index: "01",
          value: "100",
          unit: "km",
          label: "swimming",
          image: "distance-swim-presence.jpg",
          video: "distance-swim-presence.mp4",
          details: [
            "2,000 lengths of a 50-metre pool",
            "the equivalent of three English Channel crossings",
            "Moscow to Yaroslavl without a break in the water",
          ],
        },
        {
          index: "02",
          value: "10,010",
          unit: "km",
          label: "cycling",
          image: "distance-bike-presence.jpg",
          video: "distance-bike-presence.mp4",
          details: [
            "almost across Russia: Moscow to Vladivostok",
            "one quarter of Earth’s equator",
            "Moscow — Paris — Moscow — Paris",
          ],
        },
        {
          index: "03",
          value: "1,001",
          unit: "km",
          label: "running",
          image: "distance-run-presence.jpg",
          video: "distance-run-presence.mp4",
          details: [
            "24 full marathons in succession",
            "Moscow to Saint Petersburg, plus another 300 km",
            "10 non-stop laps of the Moscow Ring Road",
          ],
        },
      ],
    },
    viktor: {
      eyebrow: "About Viktor",
      title: "Viktor Doronin",
      lead: "47. He does not build an image&nbsp;—<br>he lives it.",
      body: `A driving force behind the <a href="${shared.dustyDumbbellsHref}" target="_blank" rel="noopener noreferrer">Dusty Dumbbells</a> and&nbsp;<a href="${shared.gastrodinamikaHref}" target="_blank" rel="noopener noreferrer">Gastrodinamika</a> communities, a friend, a motivator, and one of Russia’s strongest amateur triathletes.`,
      imageAlt: "Viktor Doronin racing through the desert",
      achievements: [
        ["4×", "Ironman World Championship Kona participant"],
        ["252.8 km", "Marathon des Sables in the Sahara"],
        ["17,696 m", "Double Everesting elevation gain in one ride"],
        ["58 hours", "1,111 km ultra-triathlon without sleep"],
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
          title: "The “11 111” format",
          body:
            "The first-attempt status of the 31-day ultra-triathlon is a project-team claim; independent documentation will be added after the start.",
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
        "Conversations about triathlon, running, community and long-distance challenges.",
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
          "We tell the story together before the start, throughout the project and after the finish.",
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
          "Work before the start, throughout all 31 days and after the finish.",
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
      afterCredits: "Training diary",
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

const navigationPreviewImages = [
  "hero.jpg",
  "distance-bike-presence.jpg",
  "portrait.jpg",
  "story-bridge.jpg",
  "adventure-ladoga.jpg",
  "interview-04.jpg",
  "partner-community-motion.jpg",
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
        ? ` data-nav-track data-nav-title="${label}" data-nav-index="${String(index + 1).padStart(2, "0")}" data-nav-image="${assetBase}assets/${navigationPreviewImages[index]}"`
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

const soundSceneIcons = [
  `<svg class="audio-story__scene-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M4 8h7c3 0 3-4 0-4-1.6 0-2.6.8-3 2M4 12h12c3 0 3-4 0-4-1.6 0-2.6.8-3 2M4 16h8c3 0 3 4 0 4-1.6 0-2.6-.8-3-2"></path>
  </svg>`,
  `<svg class="audio-story__scene-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M5 14v-4M9 18V6M13 20V4M17 16V8M21 13v-2"></path>
  </svg>`,
  `<svg class="audio-story__scene-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M3 9c3 0 3 2 6 2s3-2 6-2 3 2 6 2M3 15c3 0 3 2 6 2s3-2 6-2 3 2 6 2"></path>
  </svg>`,
  `<svg class="audio-story__scene-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M4 16V8M8 19V5M12 14v-4M16 18V6M20 15V9"></path>
  </svg>`,
  `<svg class="audio-story__scene-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M4 16 10 8M9 17l6-8M14 18l6-8"></path>
  </svg>`,
];

function renderDistanceValue(value, unit, className) {
  const valueGroups = value
    .split(" ")
    .map((group) => `<span>${group}</span>`)
    .join("");

  return `
    <p class="${className}" data-optical-start>
      <span class="sr-only">${value} ${unit}</span>
      <span class="distance-card__number" aria-hidden="true">${valueGroups}</span>
      <span class="distance-card__unit" aria-hidden="true">${unit}</span>
    </p>`;
}

function renderSequenceTotal(value, unit, label) {
  const groups = value.split(" ");
  const labelMarkup = label ? `<em>${label}</em>` : "";

  if (groups.length === 1) {
    return `<b>${labelMarkup}<span>${value}</span><small>${unit}</small></b>`;
  }

  return `<b>${labelMarkup}<span class="distance-story__sequence-total">${groups
    .map((group) => `<span>${group}</span>`)
    .join("")}</span><small>${unit}</small></b>`;
}

function renderDistance(items, l) {
  return items
    .map((item, index) => {
      const mobileSequence = items
        .map((sequenceItem, stepIndex) => {
          const state =
            stepIndex < index
              ? "is-complete"
              : stepIndex === index
                ? "is-active"
                : "";

          return `<span class="distance-card__sequence-step ${state}" aria-hidden="true"><i></i><small>${sequenceItem.index} ${sequenceItem.label}</small></span>`;
        })
        .join("");

      return `
        <article
          class="distance-card${index === 0 ? " is-active" : ""}"
          data-distance-card="${index}"
          data-distance-value="${item.value}"
          data-distance-unit="${item.unit}"
          data-distance-index="${item.index}"
          data-distance-label="${item.label}"
        >
          <figure class="distance-card__media" aria-hidden="true">
            <img src="${l.assetBase}assets/${item.image}" alt="" loading="lazy" width="1600" height="900">
          </figure>
          <div class="distance-card__identity">
            <span class="distance-card__index" aria-hidden="true">${item.index}</span>
            <h3>${item.label}</h3>
          </div>
          ${renderDistanceValue(item.value, item.unit, "distance-card__value")}
          <div
            class="distance-card__mobile-sequence"
            aria-label="${l.distance.sequenceLabel} ${index + 1} / ${items.length}. ${l.distance.totalLabel}: ${l.distance.totalValue} ${l.distance.totalUnit}"
          >
            <span class="distance-card__sequence-label">${l.distance.sequenceLabel} ${index + 1} ${l.distance.sequenceOf} ${items.length}</span>
            ${renderSequenceTotal(l.distance.totalValue, l.distance.totalUnit, l.distance.sequenceTotal)}
            ${mobileSequence}
          </div>
          <ul class="detail-list">
            ${item.details.map((detail) => `<li>${detail}</li>`).join("")}
          </ul>
        </article>`;
    })
    .join("");
}

function renderDistanceMedia(items, l) {
  return items
    .map(
      (item, index) => `
        <figure
          class="distance-story__frame${index === 0 ? " is-active" : ""}"
          data-distance-frame="${index}"
          aria-hidden="true"
        >
          <video
            data-distance-video="${index}"
            muted
            loop
            playsinline
            preload="metadata"
            poster="${l.assetBase}assets/${item.image}"
            aria-hidden="true"
          >
            <source src="${l.assetBase}assets/${item.video}" type="video/mp4">
          </video>
          <figcaption>
            <span>${l.distance.mediaKicker}</span>
            <strong>${item.index} · ${item.label}</strong>
          </figcaption>
        </figure>`,
    )
    .join("");
}

function renderDistanceEquation(distance) {
  const terms = distance.items
    .map(
      (item) =>
        `<span class="distance-total__term" data-distance-step="${item.value.replaceAll(/\D/g, "")}">
          <span class="distance-total__index">${item.index}</span>
          <span class="distance-total__term-copy">
            <strong data-optical-start>${item.value}<small>${item.unit}</small></strong>
            <em>${item.label}</em>
          </span>
        </span>`,
    )
    .join("");

  return `
    <div class="distance-total__equation" role="img" aria-label="${distance.totalFormulaLabel}" data-distance-total>
      <div class="distance-total__result" aria-hidden="true">
        <span data-distance-counter data-distance-final="${distance.totalValue.replaceAll(/\D/g, "")}" data-optical-start>${distance.totalValue}</span>
        <small>${distance.totalUnit}</small>
      </div>
      <div class="distance-total__terms" aria-hidden="true">${terms}</div>
    </div>`;
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
                    <source src="${l.assetBase}assets/${item.video}" type="video/mp4">
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
      /\b(alt|aria-label|content|data-before-one|data-before-few|data-before-many|data-active|data-finished|data-latest-update|data-status-pending|data-live-discipline|data-live-note)="([^"]*)"/g,
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
      <summary class="menu-toggle" aria-label="${l.menu}">
        <span class="menu-toggle__label">${l.menu}</span>
        <span class="menu-toggle__current" data-current-chapter>${l.nav[0][1]}</span>
        <span class="menu-toggle__icon" aria-hidden="true"></span>
      </summary>
      <nav class="site-nav" aria-label="${l.menu}">
        <div class="site-nav__chapters">
          <div class="site-nav__preview" aria-hidden="true">
            <figure class="site-nav__preview-media">
              <img
                src="${l.assetBase}assets/${navigationPreviewImages[0]}"
                alt=""
                width="1600"
                height="900"
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
              <span>
                <strong>${l.navDiaryLabel}</strong>
                <small>${l.navDiaryNote}</small>
              </span>
              ${icons.down}
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
          <source src="${l.assetBase}assets/hero-loop-mobile.mp4" type="video/mp4" media="(max-width: 640px)">
          <source src="${l.assetBase}assets/hero-loop.mp4" type="video/mp4">
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
          <a class="button button--ghost" href="#distance" data-analytics-goal="project_explore">${l.hero.secondaryCta}</a>
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

    <section class="audio-story" data-audio-story aria-labelledby="audio-story-title">
      <div class="audio-story__intro">
        <div class="audio-story__meta">
          <span aria-hidden="true">01–05</span>
          <p>${l.hero.audioStoryLabel}</p>
        </div>
        <div class="audio-story__copy">
          <h2 id="audio-story-title">${l.hero.audioStoryTitle}</h2>
          <p>${l.hero.audioStoryNote}</p>
        </div>
      </div>
      <div
        class="audio-story__player"
        data-sound-player
      >
        <ol class="audio-story__storyline" aria-label="${l.hero.audioScenesLabel}">
          ${l.hero.audioScenes
            .map(
              (scene, index) => `
            <li>
              <button
                type="button"
                data-sound-scene
                data-scene-index="${index}"
                data-scene-title="${scene.title}"
                data-audio-src="${l.assetBase}assets/${scene.file}"
                data-duration="${scene.duration}"
                data-play-label="${l.hero.audioPlay}"
                data-pause-label="${l.hero.audioPause}"
                data-playing="false"
                aria-label="${l.hero.audioPlay}: ${scene.title}"
                aria-pressed="${index === 0 ? "true" : "false"}"
              >
                <span class="audio-story__scene-line" aria-hidden="true"><i data-scene-progress></i></span>
                <span class="audio-story__scene-head">
                  <span>${String(index + 1).padStart(2, "0")}</span>
                  ${soundSceneIcons[index]}
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
        <div class="audio-story__contexts" data-sound-contexts aria-live="polite">
          ${l.hero.audioScenes
            .map(
              (scene, index) => `
                <p data-sound-context="${index}"${index === 0 ? "" : " hidden"}>
                  <strong>${String(index + 1).padStart(2, "0")} · ${scene.title}</strong>
                  <span>${scene.context}</span>
                </p>`,
            )
            .join("")}
        </div>
      </div>
      <audio
        data-effort-audio
        preload="metadata"
        src="${l.assetBase}assets/${l.hero.audioScenes[0].file}"
      ></audio>
    </section>

    <section class="diary section section--light" id="diary" aria-labelledby="diary-title">
      <div class="diary__heading">
        <p
          class="diary__eyebrow"
          data-phase-copy
          data-before="${l.diary.phaseBefore}"
          data-active="${l.diary.phaseActive}"
          data-finished="${l.diary.phaseFinished}"
        >${l.diary.phaseBefore}</p>
        <time datetime="${l.diary.date}">${l.diary.dateLabel}</time>
      </div>
      <figure class="diary__media">
        <video
          src="${l.assetBase}assets/${l.diary.video}"
          poster="${l.assetBase}assets/${l.diary.image}"
          width="720"
          height="1280"
          preload="metadata"
          controls
          playsinline
          aria-label="${l.diary.videoLabel}"
          data-diary-video
        ></video>
        <button
          class="diary__play"
          type="button"
          aria-label="${l.diary.videoPlayLabel}"
          data-diary-video-play
        >
          <span class="diary__play-label">${l.diary.videoPlayCta}</span>
          <span class="diary__play-meta">
            <time datetime="PT15S">${l.diary.videoDuration}</time>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="m9 6 9 6-9 6Z"></path>
            </svg>
          </span>
        </button>
        <figcaption class="sr-only">${l.diary.imageAlt}</figcaption>
      </figure>
      <div class="diary__copy">
        <h2 id="diary-title">${l.diary.title}</h2>
        <p class="diary__lead">${l.diary.lead}</p>
        <div class="diary__facts">
          ${renderMetrics(l.diary.facts, "diary__fact")}
        </div>
        <p class="diary__note">${l.diary.note}</p>
        <a
          class="text-link text-link--dark"
          href="${shared.diaryPostHref}"
          data-analytics-goal="diary_open"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span class="text-link__label">${l.diary.cta}</span>
          ${icons.external}
          <span class="sr-only">${l.diary.externalLabel}</span>
        </a>
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
      <div class="distance-story" data-distance-story>
        <div class="distance-story__visual">
          ${renderDistanceMedia(l.distance.items, l)}
          <div class="distance-story__counter" aria-hidden="true">
            <div class="distance-story__counter-meta">
              <span data-distance-live-index>${l.distance.items[0].index}</span>
              <span data-distance-live-label>${l.distance.items[0].label}</span>
            </div>
            <p class="distance-story__counter-value">
              <strong data-distance-live-value data-optical-start>${l.distance.items[0].value}</strong>
              <small data-distance-live-unit>${l.distance.items[0].unit}</small>
            </p>
            <div class="distance-story__sequence">
              <div class="distance-story__sequence-meta">
                <span>
                  <small>${l.distance.sequenceLabel}</small>
                  <b><strong data-distance-sequence-current>${l.distance.items[0].index}</strong><i>${l.distance.sequenceOf} ${String(l.distance.items.length).padStart(2, "0")}</i></b>
                </span>
                ${renderSequenceTotal(l.distance.totalValue, l.distance.totalUnit, l.distance.sequenceTotal)}
              </div>
              <div class="distance-story__sequence-track">
                ${l.distance.items
                  .map(
                    (item, index) =>
                      `<span class="${index === 0 ? "is-active" : ""}" data-distance-sequence="${index}"></span>`,
                  )
                  .join("")}
              </div>
            </div>
          </div>
        </div>
        <div class="distance-story__chapters">
          ${renderDistance(l.distance.items, l)}
        </div>
      </div>
      <div class="distance-total">
        <p class="distance-total__label">${l.distance.totalLabel}</p>
        ${renderDistanceEquation(l.distance)}
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
        <a data-language-switch href="${l.alternateHref}" hreflang="${l.lang === "ru" ? "en" : "ru"}">${l.footer.languageCta}${icons.external}</a>
        <a href="#top">${l.footer.top}${icons.up}</a>
      </div>
    </div>

    <div class="site-footer__wordmark" aria-hidden="true">
      <img src="${l.assetBase}assets/logo.svg" alt="" width="512" height="231">
    </div>

    <a
      class="site-footer__after-credits"
      href="${shared.viktorTelegramHref}"
      data-analytics-goal="diary_open"
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
  filter: (source) =>
    source !== styleModulesRoot && !source.startsWith(`${styleModulesRoot}/`),
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
