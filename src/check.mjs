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
    /<header\b[\s\S]*?class="hero__media-toggle"[\s\S]*?<details class="nav-shell"/u.test(
      html,
    ),
    `${lang}: управление видео и меню должны находиться в одном сервисном слое шапки`,
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
  }
}

const css = await readFile(resolve(outputRoot, "assets/styles.css"), "utf8");
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

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log("Content, typography, and structure checks passed.");
}
