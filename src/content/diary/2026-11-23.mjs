const title = {
  ru: "8 дней до челленджа 11 111 км",
  en: "8 days until the 11,111 km challenge",
};

const cover = {
  kind: "image",
  src: "diary-2026-11-23-01.jpg",
  width: 644,
  height: 800,
  aspect: "161 / 200",
  alt: {
    ru: "Серебристые запонки в форме звеньев велосипедной цепи на светлом фоне",
    en: "Silver cufflinks shaped like bicycle chain links on a light background",
  },
};

export default {
  index: "20",
  date: "2026-11-23",
  href: "https://t.me/doroninvdele/1312",
  image: cover.src,
  mediaWidth: cover.width,
  mediaHeight: cover.height,
  mediaAspect: cover.aspect,
  featuredMedia: 0,
  media: [
    cover,
    {
      kind: "image",
      src: "diary-2026-11-23-02.jpg",
      width: 640,
      height: 800,
      aspect: "4 / 5",
      alt: {
        ru: "Карта маршрута заезда и статистика: 120,93 км, набор высоты 263 м, средняя мощность 204 Вт и средняя температура 33 °C",
        en: "Ride route map and statistics: 120.93 km, 263 m elevation gain, 204 W average power and 33 °C average temperature",
      },
    },
  ],
  facts: [],
  content: {
    ru: {
      tabLabel: title.ru,
      title: title.ru,
      imageAlt: cover.alt.ru,
      note: `На прошлой неделе общий тренировочный объем составил: 13 часов 14 минут
или 450 км

Самая длительная тренировка недели заняла: 3 часа 32 минуты или 121 км
(ср.скорость 34,2 км/ч)

Адаптация к полуденной жаре идёт по плану.`,
      externalLabel: "Откроется запись дневника Виктора от 23 ноября в Telegram",
    },
    en: {
      tabLabel: title.en,
      title: title.en,
      imageAlt: cover.alt.en,
      note: `Last week’s total training volume was 13 hours and 14 minutes
or 450 km

The longest session of the week lasted 3 hours and 32 minutes, or 121 km
(average speed 34.2 km/h)

Adaptation to the midday heat is on track.`,
      externalLabel: "Opens Victor’s November 23 diary entry on Telegram",
    },
  },
};
