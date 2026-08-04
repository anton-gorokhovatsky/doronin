import march10 from "./2026-03-10.mjs";
import march23 from "./2026-03-23.mjs";
import april23 from "./2026-04-23.mjs";

const entries = [march10, march23, april23].sort((first, second) =>
  second.date.localeCompare(first.date),
);

const localeCopy = {
  ru: {
    phaseBefore: "Дневник подготовки",
    phaseActive: "31 день проекта",
    phaseFinished: "Архив истории",
    storiesLabel: "Записи дневника подготовки",
    videoPlayCta: "Смотреть видео",
    cta: "Читать запись в Telegram",
    phasesLabel: "Состояния проекта",
    phases: [
      ["before", "Подготовка", "Дневник, тренировки и сбор команды"],
      ["active", "31 день", "Ежедневный ход дистанции"],
      ["finished", "После финиша", "Фильм, результаты и архив"],
    ],
  },
  en: {
    phaseBefore: "Training diary",
    phaseActive: "31 days underway",
    phaseFinished: "Story archive",
    storiesLabel: "Training diary entries",
    videoPlayCta: "Watch video",
    cta: "Read the update on Telegram",
    phasesLabel: "Project states",
    phases: [
      ["before", "Preparation", "Training diary and team building"],
      ["active", "31 days", "Daily progress across the distance"],
      ["finished", "After the finish", "Film, results and archive"],
    ],
  },
};

const requiredEntryFields = [
  "index",
  "date",
  "href",
  "image",
  "video",
  "videoDuration",
  "videoDurationIso",
];

const requiredContentFields = [
  "tabLabel",
  "title",
  "imageAlt",
  "videoLabel",
  "videoPlayLabel",
  "lead",
  "note",
  "externalLabel",
];

function validateEntries() {
  const indexes = new Set();
  const dates = new Set();

  for (const entry of entries) {
    for (const field of requiredEntryFields) {
      if (typeof entry[field] !== "string" || !entry[field]) {
        throw new Error(`Diary entry ${entry.date || "unknown"} is missing ${field}.`);
      }
    }

    if (indexes.has(entry.index) || dates.has(entry.date)) {
      throw new Error(`Diary entry ${entry.date} duplicates an index or date.`);
    }
    indexes.add(entry.index);
    dates.add(entry.date);

    if (!Array.isArray(entry.facts) || entry.facts.length === 0) {
      throw new Error(`Diary entry ${entry.date} has no facts.`);
    }

    for (const lang of Object.keys(localeCopy)) {
      const localized = entry.content?.[lang];
      for (const field of requiredContentFields) {
        if (typeof localized?.[field] !== "string" || !localized[field]) {
          throw new Error(`Diary entry ${entry.date} is missing ${lang}.${field}.`);
        }
      }
      if (entry.facts.some((fact) => !fact.value?.[lang] || !fact[lang])) {
        throw new Error(`Diary entry ${entry.date} has an incomplete ${lang} fact.`);
      }
    }
  }
}

validateEntries();

function formatDate(date, lang, includeYear = false, nonbreaking = false) {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day, 12));
  const base = new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(value);
  const formatted = includeYear
    ? lang === "ru"
      ? `${base} ${year}`
      : `${base}, ${year}`
    : base;

  return nonbreaking ? formatted.replaceAll(" ", "\u00a0") : formatted;
}

function formatCount(count, lang) {
  if (lang === "en") return `${count}\u00a0${count === 1 ? "entry" : "entries"}`;

  const mod10 = count % 10;
  const mod100 = count % 100;
  const noun = mod10 === 1 && mod100 !== 11
    ? "запись"
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
      ? "записи"
      : "записей";
  return `${count}\u00a0${noun}`;
}

export function createDiaryContent(lang) {
  if (!localeCopy[lang]) throw new Error(`Unsupported diary locale: ${lang}.`);

  const oldest = entries.at(-1);
  const newest = entries[0];
  const copy = localeCopy[lang];

  return {
    ...copy,
    rangeCount: formatCount(entries.length, lang),
    rangeStart: formatDate(oldest.date, lang, false, true),
    rangeEnd: formatDate(newest.date, lang, true, true),
    entries: entries.map((entry) => ({
      index: entry.index,
      date: entry.date,
      href: entry.href,
      image: entry.image,
      video: entry.video,
      videoDuration: entry.videoDuration,
      videoDurationIso: entry.videoDurationIso,
      dateLabel: formatDate(entry.date, lang),
      videoPlayCta: copy.videoPlayCta,
      cta: copy.cta,
      facts: entry.facts.map((fact) => [fact.value[lang], fact[lang]]),
      ...entry.content[lang],
    })),
  };
}
