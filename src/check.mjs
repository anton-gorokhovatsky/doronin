import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const outputRoot = resolve(process.argv[2] || "preview");
const pages = [
  ["ru", resolve(outputRoot, "index.html")],
  ["en", resolve(outputRoot, "en/index.html")],
];
const failures = [];

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

for (const [lang, path] of pages) {
  const html = await readFile(path, "utf8");
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
  expect(
    (html.match(/\bdata-theme-option="/g) || []).length === 9 &&
      html.includes('class="header-theme"'),
    `${lang}: тема должна быть доступна в шапке, меню и подвале в трёх явных режимах`,
  );
  expect(
    (html.match(/\bdata-status-day\b/g) || []).length === 31,
    `${lang}: шкала статуса должна отражать все 31 день проекта`,
  );
  expect(
    (html.match(/class="partner-format"/g) || []).length === 3 &&
      (html.match(/class="partner-proof__metric"/g) || []).length === 3,
    `${lang}: партнёрский сценарий должен содержать три формата и три доказательства`,
  );
  expect(
    html.includes('class="partners__intro"') &&
      html.includes('class="partners__offer"') &&
      html.includes('class="partners__actions"') &&
      html.indexOf('class="partner-formats"') <
        html.indexOf('class="partners__actions"'),
    `${lang}: партнёрский экран должен собираться из вводной, матрицы и общего блока действий`,
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
      visibleText.includes("1,3+ млн") && !visibleText.includes("1,3 млн+"),
      "ru: знак плюса относится к числу, а млн остаётся единицей",
    );
    expect(
      visibleText.includes("Экипировка") &&
        visibleText.includes("Технологии") &&
        visibleText.includes("Медиа"),
      "ru: названия партнёрских направлений должны оставаться короткими",
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
  }

  expect(
    html.includes("family=Commissioner") && !html.includes("family=Manrope"),
    `${lang}: основной шрифт должен загружаться как Commissioner`,
  );
  expect(
    html.includes("https://mc.yandex.ru/metrika/tag.js?id=111159425") &&
      html.includes("ym(111159425, 'init'") &&
      html.includes("https://mc.yandex.ru/watch/111159425") &&
      html.split("https://mc.yandex.ru/metrika/tag.js?id=111159425").length ===
        2,
    `${lang}: счётчик Яндекс Метрики 111159425 должен присутствовать один раз`,
  );
}

const css = await readFile(resolve(outputRoot, "assets/styles.css"), "utf8");
const app = await readFile(resolve(outputRoot, "assets/app.js"), "utf8");
expect(
  css.includes("hanging-punctuation: first allow-end last"),
  "css: отсутствует progressive enhancement для висячей пунктуации",
);
expect(
  /--type-hero:\s*clamp\([^;]*calc\(/s.test(css),
  "css: крупная типографика должна зависеть от rem и viewport",
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
    css.includes("background: var(--paper)") &&
    css.includes("min-height: 4.25rem"),
  "css: финальный партнёрский CTA должен быть цельной кнопкой, а не служебной строкой",
);
expect(
  css.includes('--body: "Commissioner"') &&
    css.includes("--sans: var(--body)") &&
    !css.includes('--body: "Manrope"'),
  "css: основной и нейтральный текстовые слои должны использовать Commissioner",
);

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Content, typography, and structure checks passed.");
}
