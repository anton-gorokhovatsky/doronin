const title = {
  ru: "15 дней до челленджа 11 111 км",
  en: "15 days until the 11,111 km challenge",
};

const cover = {
  kind: "image",
  src: "diary-2026-11-16-01.jpg",
  width: 600,
  height: 800,
  aspect: "3 / 4",
  alt: {
    ru: "Велосипедист в шлеме у ограждения набережной, рядом пальма, внизу море",
    en: "A cyclist in a helmet by the waterfront railing, with a palm tree beside him and the sea below",
  },
};

export default {
  index: "19",
  date: "2026-11-16",
  href: "https://t.me/doroninvdele/1299",
  image: cover.src,
  mediaWidth: cover.width,
  mediaHeight: cover.height,
  mediaAspect: cover.aspect,
  featuredMedia: 0,
  media: [
    cover,
    {
      kind: "image",
      src: "diary-2026-11-16-02.jpg",
      width: 591,
      height: 788,
      aspect: "3 / 4",
      alt: {
        ru: "Карта кругового маршрута и сводка заезда: 71,04 км, средняя скорость 36,3 км/ч, набор 104 м, 227 Вт и 33 °C",
        en: "Loop route map and ride summary: 71.04 km, 36.3 km/h average speed, 104 m of climbing, 227 W and 33 °C",
      },
    },
  ],
  facts: [],
  content: {
    ru: {
      tabLabel: title.ru,
      title: title.ru,
      imageAlt: cover.alt.ru,
      note: `Главная задача сейчас –
адаптация к жаре. В декабре мне ехать целый день, 31 день подряд, и делать это днём. Поэтому сначала адаптация, потом объём. Пока все тренировки в лёгких зонах.

<i>Вчера жара чуть подспала.</i> Самая длинная тренировка за неделю адаптации:

71 км за 2 часа
средняя 36,3 км/ч
+33°C · 227 Вт · набор 104 м
92% времени – первая пульсовая зона

Накручиваю круги. Еду ровно, без ускорений. Задача простая: долго работать в жару и держать низкий пульс. Пока получается.

Итог недели: +33 перестало быть шоком, тело привыкает.`,
      externalLabel: "Откроется запись дневника Виктора от 16 ноября в Telegram",
    },
    en: {
      tabLabel: title.en,
      title: title.en,
      imageAlt: cover.alt.en,
      note: `My main focus right now is getting used to the heat. In December I’ll have to ride all day, 31 days in a row, in daylight. So first I adapt, then I build volume. For now, I’m keeping all my training in the easy zones.

<i>Yesterday the heat eased a little.</i> My longest session of the week spent adapting to the heat:

71 km in 2 hours
36.3 km/h average speed
+33°C · 227 W · 104 m of climbing
92% of the time in heart rate zone 1

I’m racking up laps. I’m riding at a steady pace, with no surges. The goal is simple: keep going in the heat for a long time and keep my heart rate low. So far, it’s working.

The week in review: +33°C is no longer a shock. My body is getting used to it.`,
      externalLabel: "Opens Victor’s November 16 diary entry on Telegram",
    },
  },
};
