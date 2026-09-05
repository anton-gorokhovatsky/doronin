import march10 from "./2026-03-10.mjs";
import march23 from "./2026-03-23.mjs";
import april23 from "./2026-04-23.mjs";
import may09 from "./2026-05-09.mjs";
import may12 from "./2026-05-12.mjs";
import july06 from "./2026-07-06.mjs";
import august05 from "./2026-08-05.mjs";
import august31 from "./2026-08-31.mjs";
import september05 from "./2026-09-05.mjs";

const entries = [
  march10,
  march23,
  april23,
  may09,
  may12,
  july06,
  august05,
  august31,
  september05,
].sort((first, second) => second.date.localeCompare(first.date));

const localeCopy = {
  ru: {
    phaseBefore: "Дневник пути к старту",
    phaseActive: "Дневник дистанции",
    phaseFinished: "Архив истории",
    startLabel: "старт",
    liveTitleBefore: "Дневник подготовки",
    liveTitleActive: "Дневник дистанции",
    liveTitleFinished: "Архив проекта",
    liveBodyBefore:
      "Здесь Виктор рассказывает о тренировках, самочувствии и решениях по ходу подготовки.",
    liveBodyActive:
      "Дневник фиксирует ход дистанции, решения команды и состояние Виктора по мере появления подтверждённых обновлений.",
    liveBodyFinished:
      "Записи подготовки и прохождения дистанции остаются хронологией проекта — от первых решений до зафиксированного результата.",
    latestLabel: "Последняя запись",
    telegramCta: "Дневник в Telegram",
    archiveLabel: "Архив подготовки",
    timelineArchiveStart: "10 марта",
    timelineNow: "Сейчас",
    timelineStart: "1 декабря",
    timelineFinish: "31 декабря",
    liveFinishedCountLabel: "дней проекта",
    storiesLabel: "Записи дневника подготовки",
    storyNewerLabel: "Более новая запись",
    storyEarlierLabel: "Более ранняя запись",
    storyPositionTemplate: "Запись {current} из {total}",
    mediaGalleryLabel: "Фото и видео записи",
    mediaPreviousLabel: "Предыдущий материал",
    mediaNextLabel: "Следующий материал",
    mediaPositionTemplate: "Материал {current} из {total}: {label}",
    mediaPhotoLabel: "Фото",
    mediaVideoLabel: "Видео",
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
    phaseBefore: "Road-to-start diary",
    phaseActive: "Distance diary",
    phaseFinished: "Story archive",
    startLabel: "start",
    liveTitleBefore: "Training diary",
    liveTitleActive: "Distance diary",
    liveTitleFinished: "Project archive",
    liveBodyBefore:
      "Viktor writes about his training, how he feels and the decisions he makes during preparation.",
    liveBodyActive:
      "The diary records the distance, the team’s decisions and Viktor’s condition as verified updates become available.",
    liveBodyFinished:
      "The preparation and distance updates remain as the project’s chronology — from the first decisions to the recorded result.",
    latestLabel: "Latest entry",
    telegramCta: "Diary on Telegram",
    archiveLabel: "Preparation archive",
    timelineArchiveStart: "March 10",
    timelineNow: "Now",
    timelineStart: "December 1",
    timelineFinish: "December 31",
    liveFinishedCountLabel: "project days",
    storiesLabel: "Training diary entries",
    storyNewerLabel: "Newer entry",
    storyEarlierLabel: "Earlier entry",
    storyPositionTemplate: "Entry {current} of {total}",
    mediaGalleryLabel: "Entry photos and videos",
    mediaPreviousLabel: "Previous media item",
    mediaNextLabel: "Next media item",
    mediaPositionTemplate: "Media item {current} of {total}: {label}",
    mediaPhotoLabel: "Photo",
    mediaVideoLabel: "Video",
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
];

const requiredContentFields = [
  "tabLabel",
  "title",
  "imageAlt",
  "note",
  "externalLabel",
];

const requiredVideoFields = ["video", "videoDuration", "videoDurationIso"];
const requiredVideoContentFields = ["videoLabel", "videoPlayLabel"];
const requiredMediaFields = ["src", "width", "height", "aspect"];

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

    if (entry.media !== undefined) {
      if (!Array.isArray(entry.media) || entry.media.length < 2) {
        throw new Error(
          `Diary entry ${entry.date} media must contain at least two items.`,
        );
      }
      if (
        !Number.isInteger(entry.featuredMedia) ||
        entry.featuredMedia < 0 ||
        entry.featuredMedia >= entry.media.length
      ) {
        throw new Error(
          `Diary entry ${entry.date} has an invalid featured media index.`,
        );
      }

      for (const [mediaIndex, media] of entry.media.entries()) {
        if (!["image", "video"].includes(media.kind)) {
          throw new Error(
            `Diary entry ${entry.date} media ${mediaIndex + 1} has an invalid kind.`,
          );
        }
        for (const field of requiredMediaFields) {
          const value = media[field];
          const valid =
            field === "width" || field === "height"
              ? Number.isFinite(value) && value > 0
              : typeof value === "string" && value;
          if (!valid) {
            throw new Error(
              `Diary entry ${entry.date} media ${mediaIndex + 1} is missing ${field}.`,
            );
          }
        }
        if (
          media.kind === "video" &&
          [media.poster, media.duration, media.durationIso].some(
            (value) => typeof value !== "string" || !value,
          )
        ) {
          throw new Error(
            `Diary entry ${entry.date} video ${mediaIndex + 1} is incomplete.`,
          );
        }
      }
    }

    if (entry.video) {
      for (const field of requiredVideoFields) {
        if (typeof entry[field] !== "string" || !entry[field]) {
          throw new Error(`Diary entry ${entry.date} is missing ${field}.`);
        }
      }
    }

    for (const lang of Object.keys(localeCopy)) {
      const localized = entry.content?.[lang];
      for (const field of requiredContentFields) {
        if (typeof localized?.[field] !== "string" || !localized[field]) {
          throw new Error(`Diary entry ${entry.date} is missing ${lang}.${field}.`);
        }
      }
      if (entry.video) {
        for (const field of requiredVideoContentFields) {
          if (typeof localized?.[field] !== "string" || !localized[field]) {
            throw new Error(`Diary entry ${entry.date} is missing ${lang}.${field}.`);
          }
        }
      }
      if (entry.media) {
        for (const [mediaIndex, media] of entry.media.entries()) {
          if (typeof media.alt?.[lang] !== "string" || !media.alt[lang]) {
            throw new Error(
              `Diary entry ${entry.date} media ${mediaIndex + 1} is missing ${lang}.alt.`,
            );
          }
          if (
            media.kind === "video" &&
            (typeof media.playLabel?.[lang] !== "string" ||
              !media.playLabel[lang])
          ) {
            throw new Error(
              `Diary entry ${entry.date} video ${mediaIndex + 1} is missing ${lang}.playLabel.`,
            );
          }
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

function localizeEntryMedia(entry, lang, copy) {
  const localizedContent = entry.content[lang];
  const sourceMedia = entry.media || [
    {
      kind: entry.video ? "video" : "image",
      src: entry.video || entry.image,
      poster: entry.video ? entry.image : undefined,
      width: entry.mediaWidth || 720,
      height: entry.mediaHeight || 1280,
      aspect: entry.mediaAspect || (entry.video ? "9 / 16" : "4 / 5"),
      duration: entry.videoDuration,
      durationIso: entry.videoDurationIso,
      alt: { [lang]: localizedContent.imageAlt },
      playLabel: { [lang]: localizedContent.videoPlayLabel },
    },
  ];

  return sourceMedia.map((media) => {
    const kindLabel =
      media.kind === "video" ? copy.mediaVideoLabel : copy.mediaPhotoLabel;
    const alt = media.alt?.[lang] || localizedContent.imageAlt;

    return {
      kind: media.kind,
      src: media.src,
      poster: media.poster,
      width: media.width,
      height: media.height,
      aspect: media.aspect,
      fit: media.fit,
      position: media.position,
      duration: media.duration,
      durationIso: media.durationIso,
      alt,
      playLabel: media.playLabel?.[lang] || localizedContent.videoPlayLabel,
      kindLabel,
      statusLabel: media.duration
        ? `${kindLabel}\u00a0·\u00a0${media.duration}`
        : kindLabel,
      tabLabel: `${kindLabel}: ${alt}`,
    };
  });
}

export function createDiaryContent(lang) {
  if (!localeCopy[lang]) throw new Error(`Unsupported diary locale: ${lang}.`);

  const oldest = entries.at(-1);
  const newest = entries[0];
  const copy = localeCopy[lang];

  return {
    ...copy,
    latest: {
      date: newest.date,
      dateLabel: formatDate(newest.date, lang, true, true),
    },
    rangeCount: formatCount(entries.length, lang),
    rangeStart: formatDate(oldest.date, lang, false, true),
    rangeEnd: formatDate(newest.date, lang, true, true),
    entries: entries.map((entry) => {
      const media = localizeEntryMedia(entry, lang, copy);
      const featuredMedia = entry.featuredMedia || 0;

      return {
        index: entry.index,
        date: entry.date,
        href: entry.href,
        image: entry.image,
        video: entry.video,
        videoDuration: entry.videoDuration,
        videoDurationIso: entry.videoDurationIso,
        media,
        featuredMedia,
        mediaKind: media.length > 1 ? "mixed" : media[0].kind,
        mediaWidth: entry.mediaWidth,
        mediaHeight: entry.mediaHeight,
        mediaAspect: entry.mediaAspect,
        dateLabel: formatDate(entry.date, lang),
        videoPlayCta: copy.videoPlayCta,
        cta: copy.cta,
        facts: entry.facts.map((fact) => [fact.value[lang], fact[lang]]),
        ...entry.content[lang],
      };
    }),
  };
}
