import { cp, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const outputRoot = resolve(process.argv[2] || "preview");
const assetSource = resolve("src/assets");
const assetOutput = resolve(outputRoot, "assets");

const shared = {
  email: "anesterova88@gmail.com",
  telegramHref: "https://t.me/alraunean",
  filmHref: "https://vk.com/video-224465212_456239107",
  startDate: "2026-12-01",
  endDate: "2026-12-31",
};

const locales = {
  ru: {
    lang: "ru",
    outputPath: "index.html",
    assetBase: "./",
    alternateHref: "./en/",
    alternateLabel: "EN",
    canonical: "https://anton-gorokhovatsky.github.io/doronin/",
    alternateCanonical: "https://anton-gorokhovatsky.github.io/doronin/en/",
    title: "11 111 км / 31 день — Виктор Доронин",
    description:
      "Первый в мире 31-дневный ультратриатлон Виктора Доронина. 11 111 км с 1 по 31 декабря 2026 года.",
    skip: "Перейти к содержанию",
    homeLabel: "11 111 — на главную",
    menu: "Меню",
    nav: [
      ["#distance", "Дистанция"],
      ["#viktor", "Виктор"],
      ["#proof", "Доказательство"],
      ["#adventures", "Приключения"],
    ],
    headerCta: "Партнёрам",
    hero: {
      kicker: "1–31 декабря 2026 · Виктор Доронин",
      lineOne: ["11 111", "км"],
      lineTwo: ["31", "день"],
      accent: "ОДИН ШАНС",
      intro: "Первый в мире 31-дневный ультратриатлон.",
      imageAlt: "Виктор Доронин на велосипеде во время скоростного заезда",
      primaryCta: "Как это устроено",
      secondaryCta: "Войти в историю",
      statusFallback: "Старт 1 декабря 2026",
      beforeForms: ["день до старта", "дня до старта", "дней до старта"],
      activeLabel: "день из 31",
      finishedLabel: "Плановый период проекта завершён",
      footLabel: "Не спортивное событие",
      footText: "История, в которую можно войти",
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
      items: [
        {
          index: "01",
          value: "100",
          unit: "км",
          label: "плавания",
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
          label: "на велосипеде",
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
          label: "бега",
          details: [
            "24 полных марафона подряд",
            "Москва — Санкт-Петербург и ещё 300 км",
            "10 кругов по МКАД нон-стоп",
          ],
        },
      ],
    },
    viktor: {
      eyebrow: "Кто такой Виктор",
      title: "Виктор Доронин",
      lead: "47 лет. Не создаёт образ — живёт в нём.",
      body:
        "Идеолог сообществ «Пыльные гантели» и «Гастродинамика», друг, мотиватор и один из сильнейших любителей в триатлоне.",
      imageAlt: "Виктор Доронин на дистанции в пустыне",
      achievements: [
        ["4×", "участник чемпионата мира WC Ironman Kona"],
        ["252,8 км", "Marathon des Sables в Сахаре"],
        ["17 696 м", "двойной Everesting за один заезд"],
        ["58 часов", "ультратриатлон 1 111 км без сна"],
      ],
      quote: "Не продаёт историю. Он её проживает.",
    },
    story: {
      label: "Виктор Доронин: тренировки и люди рядом",
      items: [
        {
          image: "story-running.jpg",
          width: "1800",
          height: "1198",
          alt: "Виктор Доронин бежит вместе с участниками тренировочного лагеря",
          caption: "Бег",
        },
        {
          image: "story-community.jpg",
          width: "1400",
          height: "1539",
          alt: "Виктор Доронин разговаривает с друзьями после тренировки",
          caption: "Сообщество",
        },
        {
          image: "story-cycling.jpg",
          width: "1800",
          height: "1333",
          alt: "Виктор Доронин ведёт группу велосипедистов",
          caption: "Велосипед",
        },
      ],
    },
    proof: {
      eyebrow: "Мы уже делали это",
      title: "Проект «1111» — доказанная формула",
      body:
        "Аудитория готова к длинным форматам. Честность работает лучше глянца. История продолжает жить после финиша.",
      metrics: [
        ["1,3 млн+", "просмотров сериала"],
        ["85 000+", "просмотров фильма"],
        ["+310%", "рост аудитории героя"],
        ["25+", "федеральных СМИ"],
      ],
      filmCta: "Смотреть фильм о проекте «1111»",
      externalLabel: "Откроется ВКонтакте в новой вкладке",
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
    partners: {
      eyebrow: "Партнёрам",
      title: "Хочешь войти в историю?",
      lead: "Давайте создадим это вместе.",
      body:
        "Подберём формат присутствия бренда в большой человеческой истории — без искусственного глянца и случайных интеграций.",
      benefits: [
        "Обсудим ваш пакет за 15 минут",
        "Места в категориях ограничены",
        "Первым партнёрам — мерч проекта в подарок",
      ],
      cta: "Обсудить партнёрство",
      mailSubject: "Партнёрство с проектом 11 111",
      contacts: "Контакты",
      emailLabel: "Написать Анне Нестеровой",
      telegramLabel: "Написать Анне Нестеровой в Telegram",
      emailCta: "Написать по почте",
      telegramCta: "Написать в Telegram",
      person: "Анна Нестерова",
    },
    footer: {
      kicker: "11 111 км · 31 день · Виктор Доронин",
      titleLineOne: "История начинается",
      titleLineTwo: "1 декабря 2026",
      navLabel: "Навигация",
      contactLabel: "Связаться",
      emailCta: "Написать по почте",
      telegramCta: "Написать в Telegram",
      partnerCta: "Обсудить партнёрство",
      languageCta: "English version",
      legal: "2026 ИП Доронин В. В. · ИНН 344 406 202 270",
      top: "Наверх",
    },
  },
  en: {
    lang: "en",
    outputPath: "en/index.html",
    assetBase: "../",
    alternateHref: "../",
    alternateLabel: "RU",
    canonical: "https://anton-gorokhovatsky.github.io/doronin/en/",
    alternateCanonical: "https://anton-gorokhovatsky.github.io/doronin/",
    title: "11,111 km / 31 days — Viktor Doronin",
    description:
      "Viktor Doronin’s 31-day ultra-triathlon: 11,111 km from December 1 through December 31, 2026.",
    skip: "Skip to content",
    homeLabel: "11 111 — home",
    menu: "Menu",
    nav: [
      ["#distance", "Distance"],
      ["#viktor", "Viktor"],
      ["#proof", "Proof"],
      ["#adventures", "Adventures"],
    ],
    headerCta: "For partners",
    hero: {
      kicker: "December 1–31, 2026 · Viktor Doronin",
      lineOne: ["11,111", "km"],
      lineTwo: ["31", "days"],
      accent: "ONE CHANCE",
      intro: "The world’s first 31-day ultra-triathlon.",
      imageAlt: "Viktor Doronin riding at speed during a cycling event",
      primaryCta: "See the challenge",
      secondaryCta: "Become part of it",
      statusFallback: "Starts December 1, 2026",
      beforeForms: ["day to start", "days to start", "days to start"],
      activeLabel: "day of 31",
      finishedLabel: "The scheduled project period has ended",
      footLabel: "Not a sporting event",
      footText: "A story you can become part of",
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
      items: [
        {
          index: "01",
          value: "100",
          unit: "km",
          label: "swimming",
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
          details: [
            "24 full marathons in succession",
            "Moscow to Saint Petersburg, plus another 300 km",
            "10 non-stop laps of the Moscow Ring Road",
          ],
        },
      ],
    },
    viktor: {
      eyebrow: "Who is Viktor",
      title: "Viktor Doronin",
      lead: "47. He does not build an image — he lives it.",
      body:
        "A driving force behind the Dusty Dumbbells and Gastrodinamika communities, a friend, a motivator, and one of Russia’s strongest amateur triathletes.",
      imageAlt: "Viktor Doronin racing through the desert",
      achievements: [
        ["4×", "Ironman World Championship Kona participant"],
        ["252.8 km", "Marathon des Sables in the Sahara"],
        ["17,696 m", "Double Everesting elevation gain in one ride"],
        ["58 hours", "1,111 km ultra-triathlon without sleep"],
      ],
      quote: "He does not sell a story. He lives it.",
    },
    story: {
      label: "Viktor Doronin: training and the people around him",
      items: [
        {
          image: "story-running.jpg",
          width: "1800",
          height: "1198",
          alt: "Viktor Doronin running with athletes at a training camp",
          caption: "Running",
        },
        {
          image: "story-community.jpg",
          width: "1400",
          height: "1539",
          alt: "Viktor Doronin talking with friends after training",
          caption: "Community",
        },
        {
          image: "story-cycling.jpg",
          width: "1800",
          height: "1333",
          alt: "Viktor Doronin leading a group of cyclists",
          caption: "Cycling",
        },
      ],
    },
    proof: {
      eyebrow: "We have done it before",
      title: "Project “1111” — a proven formula",
      body:
        "The audience embraces long-form stories. Honesty outperforms gloss. The project lives on after the finish.",
      metrics: [
        ["1.3M+", "documentary series views"],
        ["85,000+", "film views"],
        ["+310%", "growth in Viktor’s audience"],
        ["25+", "federal media outlets"],
      ],
      filmCta: "Watch the film about Project “1111”",
      externalLabel: "Opens VK in a new tab",
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
    partners: {
      eyebrow: "For partners",
      title: "Become part of the story",
      lead: "Let’s build it together.",
      body:
        "We will find a meaningful role for your brand in a major human story — without artificial gloss or token integrations.",
      benefits: [
        "We will outline your package in 15 minutes",
        "Category placements are limited",
        "Early partners receive project merchandise",
      ],
      cta: "Discuss a partnership",
      mailSubject: "Partnership with Project 11 111",
      contacts: "Contacts",
      emailLabel: "Email Anna Nesterova",
      telegramLabel: "Message Anna Nesterova on Telegram",
      emailCta: "Send an email",
      telegramCta: "Message on Telegram",
      person: "Anna Nesterova",
    },
    footer: {
      kicker: "11,111 km · 31 days · Viktor Doronin",
      titleLineOne: "The story begins",
      titleLineTwo: "December 1, 2026",
      navLabel: "Navigation",
      contactLabel: "Get in touch",
      emailCta: "Send an email",
      telegramCta: "Message on Telegram",
      partnerCta: "Discuss a partnership",
      languageCta: "Русская версия",
      legal: "2026 · Sole proprietor Viktor Doronin · TIN 344 406 202 270",
      top: "Back to top",
    },
  },
};

function renderNav(items) {
  return items
    .map(([href, label]) => `<a class="site-nav__link" href="${href}">${label}</a>`)
    .join("");
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
};

function renderDistance(items) {
  return items
    .map((item) => {
      const valueGroups = item.value
        .split(" ")
        .map((group) => `<span>${group}</span>`)
        .join("");

      return `
        <article class="distance-card">
          <div class="distance-card__top">
            <span class="distance-card__index" aria-hidden="true">${item.index}</span>
            <div>
              <p class="distance-card__value">
                <span class="sr-only">${item.value} ${item.unit}</span>
                <span class="distance-card__number" aria-hidden="true">${valueGroups}</span>
                <span class="distance-card__unit" aria-hidden="true">${item.unit}</span>
              </p>
              <h3>${item.label}</h3>
            </div>
          </div>
          <ul class="detail-list">
            ${item.details.map((detail) => `<li>${detail}</li>`).join("")}
          </ul>
        </article>`;
    })
    .join("");
}

function renderMetrics(items, className) {
  return items
    .map(
      ([value, label]) => `
        <div class="${className}">
          <strong>${value}</strong>
          <span>${label}</span>
        </div>`,
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

function renderStory(items, l) {
  return items
    .map(
      (item, index) => `
        <figure class="story-frame">
          <div class="story-frame__media">
            <img
              src="${l.assetBase}assets/${item.image}"
              alt="${item.alt}"
              width="${item.width}"
              height="${item.height}"
              loading="lazy"
            >
          </div>
          <figcaption>
            <span aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
            ${item.caption}
          </figcaption>
        </figure>`,
    )
    .join("");
}

function renderHeroLine([value, unit]) {
  return `<span>${value}<wbr> ${unit}</span>`;
}

const shortWords = {
  ru: /(?<![\p{L}\p{N}])(а|в|во|до|за|и|из|к|ко|на|не|о|об|от|по|с|со|у)\s+(?=[\p{L}\p{N}«])/giu,
  en: /\b(a|an|and|at|by|for|in|of|on|or|the|to)\s+(?=[A-Za-z0-9“])/giu,
};

const units = {
  ru: /(бассейнов|года|день|дня|дней|декабря|категориях|км|кругов|лет|марафона|метров|минут|м|переправы|просмотров|СМИ|часа|часов)/giu,
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

function typographHtml(html, lang) {
  const textNodes = html
    .split(/(<[^>]+>)/g)
    .map((part) => (part.startsWith("<") ? part : typographText(part, lang)))
    .join("");

  return textNodes
    .replace(
      /\b(alt|aria-label|content|data-before-one|data-before-few|data-before-many|data-active|data-finished)="([^"]*)"/g,
      (attribute, name, value) => `${name}="${typographText(value, lang)}"`,
    )
    .replace(/[ \t]+$/gm, "");
}

function renderPage(l) {
  const encodedSubject = encodeURIComponent(l.partners.mailSubject);
  const mailHref = `mailto:${shared.email}?subject=${encodedSubject}`;
  const statusForms = l.hero.beforeForms.map((form) => form.replaceAll('"', "&quot;"));

  return typographHtml(`<!doctype html>
<html lang="${l.lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#041f15">
  <title>${l.title}</title>
  <meta name="description" content="${l.description}">
  <link rel="canonical" href="${l.canonical}">
  <link rel="alternate" hreflang="${l.lang}" href="${l.canonical}">
  <link rel="alternate" hreflang="${l.lang === "ru" ? "en" : "ru"}" href="${l.alternateCanonical}">
  <link rel="alternate" hreflang="x-default" href="https://anton-gorokhovatsky.github.io/doronin/">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${l.title}">
  <meta property="og:description" content="${l.description}">
  <meta property="og:url" content="${l.canonical}">
  <meta property="og:image" content="https://anton-gorokhovatsky.github.io/doronin/assets/hero.jpg">
  <meta property="og:locale" content="${l.lang === "ru" ? "ru_RU" : "en_US"}">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="icon" href="${l.assetBase}assets/logo.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${l.assetBase}assets/styles.css">
  <script src="${l.assetBase}assets/app.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#main">${l.skip}</a>

  <header class="site-header">
    <a class="site-logo" href="#top" aria-label="${l.homeLabel}">
      <img src="${l.assetBase}assets/logo.svg" alt="" width="512" height="231">
    </a>

    <details class="nav-shell" open>
      <summary class="menu-toggle">${l.menu}<span aria-hidden="true"></span></summary>
      <nav class="site-nav" aria-label="${l.menu}">
        ${renderNav(l.nav)}
      </nav>
    </details>

    <div class="header-actions">
      <a class="language-switch" data-language-switch href="${l.alternateHref}" hreflang="${l.lang === "ru" ? "en" : "ru"}">${l.alternateLabel}</a>
      <a class="header-cta" href="#partners">${l.headerCta}</a>
    </div>
  </header>

  <main id="main">
    <section class="hero" id="top" aria-labelledby="hero-title">
      <figure class="hero__media">
        <img src="${l.assetBase}assets/hero.jpg" alt="${l.hero.imageAlt}" width="2400" height="1350" fetchpriority="high">
      </figure>
      <div class="hero__veil" aria-hidden="true"></div>

      <div class="hero__content">
        <p class="hero__kicker"><time datetime="${shared.startDate}">${l.hero.kicker}</time></p>
        <h1 id="hero-title" class="hero__title">
          ${renderHeroLine(l.hero.lineOne)}
          ${renderHeroLine(l.hero.lineTwo)}
          <em>${l.hero.accent}</em>
        </h1>
        <p class="hero__intro">${l.hero.intro}</p>
        <div class="hero__actions">
          <a class="button button--primary" href="#distance">${l.hero.primaryCta}${icons.down}</a>
          <a class="button button--ghost" href="#partners">${l.hero.secondaryCta}</a>
        </div>
      </div>

      <div
        class="event-status"
        data-event-status
        data-lang="${l.lang}"
        data-start="${shared.startDate}T00:00:00+03:00"
        data-end="2027-01-01T00:00:00+03:00"
        data-before-one="${statusForms[0]}"
        data-before-few="${statusForms[1]}"
        data-before-many="${statusForms[2]}"
        data-active="${l.hero.activeLabel}"
        data-finished="${l.hero.finishedLabel}"
      >
        <span class="event-status__value" data-status-value aria-hidden="true">01.12</span>
        <span class="event-status__label" data-status-label>${l.hero.statusFallback}</span>
      </div>

      <div class="hero__foot">
        <span>${l.hero.footLabel}</span>
        <strong>${l.hero.footText}</strong>
      </div>
    </section>

    <section class="manifesto section" aria-labelledby="manifesto-title">
      <div class="section-label">
        <span>01</span>
        <p>${l.manifesto.eyebrow}</p>
      </div>
      <div class="manifesto__copy">
        <h2 id="manifesto-title">${l.manifesto.title}</h2>
        <p>${l.manifesto.text}</p>
      </div>
      <div class="manifesto__mark" aria-hidden="true">1111</div>
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
      <div class="distance-grid">
        ${renderDistance(l.distance.items)}
      </div>
    </section>

    <section class="athlete section" id="viktor" aria-labelledby="viktor-title">
      <div class="athlete__media">
        <img src="${l.assetBase}assets/portrait.jpg" alt="${l.viktor.imageAlt}" width="1680" height="2102" loading="lazy">
        <p class="athlete__quote">${l.viktor.quote}</p>
      </div>
      <div class="athlete__copy">
        <div class="section-label">
          <span>03</span>
          <p>${l.viktor.eyebrow}</p>
        </div>
        <h2 id="viktor-title">${l.viktor.title}</h2>
        <p class="athlete__lead">${l.viktor.lead}</p>
        <p class="athlete__body">${l.viktor.body}</p>
        <div class="achievement-grid">
          ${renderMetrics(l.viktor.achievements, "achievement")}
        </div>
      </div>
    </section>

    <section class="story section section--light" aria-label="${l.story.label}">
      ${renderStory(l.story.items, l)}
    </section>

    <section class="proof section" id="proof" aria-labelledby="proof-title">
      <div class="proof__mark" aria-hidden="true">1111</div>
      <div class="proof__heading">
        <div class="section-label">
          <span>04</span>
          <p>${l.proof.eyebrow}</p>
        </div>
        <h2 id="proof-title">${l.proof.title}</h2>
        <p>${l.proof.body}</p>
        <a class="text-link" href="${shared.filmHref}" target="_blank" rel="noopener noreferrer">
          ${l.proof.filmCta}${icons.external}
          <span class="sr-only">${l.proof.externalLabel}</span>
        </a>
      </div>
      <div class="proof-metrics">
        ${renderMetrics(l.proof.metrics, "proof-metric")}
      </div>
    </section>

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

    <section class="partners section" id="partners" aria-labelledby="partners-title">
      <div class="partners__copy">
        <div class="section-label section-label--dark">
          <span>06</span>
          <p>${l.partners.eyebrow}</p>
        </div>
        <h2 id="partners-title">${l.partners.title}</h2>
        <p class="partners__lead">${l.partners.lead}</p>
        <p class="partners__body">${l.partners.body}</p>
        <ul class="partner-benefits">
          ${l.partners.benefits.map((benefit) => `<li>${benefit}</li>`).join("")}
        </ul>
        <a class="button button--dark" href="${mailHref}">${l.partners.cta}${icons.external}</a>
      </div>
      <address class="contacts">
        <p class="contacts__label">${l.partners.contacts}</p>
        <strong>${l.partners.person}</strong>
        <a href="mailto:${shared.email}" aria-label="${l.partners.emailLabel}">${l.partners.emailCta}${icons.external}</a>
        <a href="${shared.telegramHref}" aria-label="${l.partners.telegramLabel}" target="_blank" rel="noopener noreferrer">${l.partners.telegramCta}${icons.external}</a>
      </address>
    </section>
  </main>

  <footer class="site-footer" aria-labelledby="footer-title">
    <div class="site-footer__intro">
      <p class="site-footer__kicker">${l.footer.kicker}</p>
      <h2 id="footer-title">
        <span>${l.footer.titleLineOne}</span>
        <span>${l.footer.titleLineTwo}</span>
      </h2>
      <a class="site-footer__cta" href="${mailHref}">
        ${l.footer.partnerCta}${icons.external}
      </a>
    </div>

    <div class="site-footer__directory">
      <nav class="site-footer__nav" aria-label="${l.footer.navLabel}">
        <p>${l.footer.navLabel}</p>
        ${renderNav(l.nav)}
        <a class="site-nav__link" href="#partners">${l.headerCta}</a>
      </nav>

      <div class="site-footer__contacts">
        <p>${l.footer.contactLabel}</p>
        <a href="mailto:${shared.email}">${l.footer.emailCta}${icons.external}</a>
        <a href="${shared.telegramHref}" target="_blank" rel="noopener noreferrer">${l.footer.telegramCta}${icons.external}</a>
      </div>

      <div class="site-footer__utility">
        <a data-language-switch href="${l.alternateHref}" hreflang="${l.lang === "ru" ? "en" : "ru"}">${l.footer.languageCta}${icons.external}</a>
        <a href="#top">${l.footer.top}${icons.up}</a>
      </div>
    </div>

    <div class="site-footer__wordmark" aria-hidden="true">
      <img src="${l.assetBase}assets/logo.svg" alt="" width="512" height="231">
    </div>

    <div class="site-footer__legal">
      <p>${l.footer.legal}</p>
      <p>11111.life</p>
    </div>
  </footer>
</body>
</html>
`, l.lang);
}

await mkdir(assetOutput, { recursive: true });
await cp(assetSource, assetOutput, { recursive: true });

for (const locale of Object.values(locales)) {
  const outputPath = resolve(outputRoot, locale.outputPath);
  await mkdir(resolve(outputPath, ".."), { recursive: true });
  await writeFile(outputPath, renderPage(locale), "utf8");
}

await writeFile(resolve(outputRoot, ".nojekyll"), "", "utf8");
await writeFile(
  resolve(outputRoot, "robots.txt"),
  "User-agent: *\nAllow: /\nSitemap: https://anton-gorokhovatsky.github.io/doronin/sitemap.xml\n",
  "utf8",
);
await writeFile(
  resolve(outputRoot, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://anton-gorokhovatsky.github.io/doronin/</loc></url>
  <url><loc>https://anton-gorokhovatsky.github.io/doronin/en/</loc></url>
</urlset>
`,
  "utf8",
);

console.log(`Built ${outputRoot}`);
