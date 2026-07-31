# Реестр дефектов и gate «11 111»

Обновлено: 2026-07-31 21:21 MSK.

Статусы:

- `НЕ НАЧАТ` — правки нет.
- `В РАБОТЕ` — правка выполняется, принимать нельзя.
- `КОД` — правка внесена, визуального подтверждения нет.
- `ЛОКАЛЬНО ПОДТВЕРЖДЁН` — есть релевантный рендер или проверка поведения.
- `PRODUCTION ПОДТВЕРЖДЁН` — опубликовано и проверено публично.

До полного gate публикация запрещена. Текущий production остаётся визуальной
точкой отсчёта; локальные исправления не считаются публичным результатом.
Все пункты T01–T08 должны быть закрыты до релиза; перенос технического долга в
финальный отчёт запрещён. Будущие улучшения описываются отдельно и не заменяют
закрытие долга.

Релиз подтверждён: `796df14` находится в `main` и `origin/main`; GitHub Pages
workflow `30654539764` завершил quality и deploy без предупреждений. Публичные
RU/EN HTML и versioned CSS/JS на `11111.life` побайтно совпали с release build;
публичные RU 1440/390/320 и EN dark 390 проверены в браузере.

## Видимые и поведенческие дефекты

| ID | Дефект | Статус | Доказательство / следующий gate |
|---|---|---|---|
| D01 | Метрики разваливаются в 3+1, значения пересекают границы, подписи оторваны | PRODUCTION ПОДТВЕРЖДЁН | `01-metrics-2x2-desktop.png`, `01-metrics-mobile-390.png`; 2×2 desktop, 1 колонка mobile, overflow 0 |
| D02 | Блок источников меняет положение страницы при раскрытии | PRODUCTION ПОДТВЕРЖДЁН | После новой геометрии D10 четыре реальных клика повторно дали delta 0; `07-proof-anchor-after-layout.png` |
| D03 | Аудиоряд чрезмерно высокий | PRODUCTION ПОДТВЕРЖДЁН | 176.56 px desktop, 283.96 px mobile; `03-audio-desktop-grid.png`, `03-audio-mobile-390-final.png` |
| D04 | Подпись активной аудиосцены висит вне сетки; строка «Дыхание…» выглядит случайной | PRODUCTION ПОДТВЕРЖДЁН | Подпись перенесена внутрь player и совпадает с пятиколоночной сеткой; mobile остаётся внутри player |
| D05 | Название текущего пункта и иконка меню не имеют общей оптической оси; триггер дёргается при скролле и смене главы | PRODUCTION ПОДТВЕРЖДЁН; принят пользователем | Геометрическое сжатие шапки удалено. На 0/120/219/221/360/900/1500/2400 px: header 1440×80, trigger 176×44, label 120 px, icon 20×12, delta X/Y = 0; `10-menu-trigger-scroll-219.png`, `10-menu-trigger-scroll-221.png` |
| D06 | Кнопки шапки имеют лишний собственный материал; меню и панель темы теряют или меняют материал | PRODUCTION ПОДТВЕРЖДЁН | Рецепты сняты с живого `11111.life` и перенесены буквально: system/light — три gradient-слоя с нижней плотностью 72%, `blur(22px) saturate(1.16)`; dark — нижняя плотность 80%, `blur(26px) saturate(1.24)`. Вычисленные material/filter/border/shadow у logo, menu trigger и раскрытого menu совпадают с production (`allExact: true`) в обеих темах. Литералы защищены `src/check.mjs`; `19-production-material-restored-mobile-390.png`, `19-production-material-restored-dark-mobile-390.png` |
| D07 | Раскрытое меню плохо устроено: механическая таблица, равный вес текущего входа и глав, длинный активный маркер | PRODUCTION ПОДТВЕРЖДЁН; композиция принята пользователем | Отдельный текущий вход, семь глав в двух колонках, короткий активный маркер и общая строка темы; декоративные линии между пунктами удалены, оставлены только границы смысловых зон; mobile 358 px при viewport 390, overflow 0; `15-menu-fewer-lines-contact-icons-390.png`, `19-production-material-restored-mobile-390.png` |
| D08 | Hero pause и содержательный play дневника ошибочно выглядят одной системой управления | PRODUCTION ПОДТВЕРЖДЁН; hero принят пользователем | Hero pause сохранён как принятый круглый сервисный контрол; diary play — отдельное горизонтальное acid-действие: «Смотреть видео» + табличный таймер `00:15` + play, все элементы центрированы по высоте; `05-media-pause-hero.png`, `12-diary-play-timer-desktop-full.png` |
| D09 | Мобильная трёхчастная шкала дистанции выглядит декоративным логотипом и не объясняет работу | PRODUCTION ПОДТВЕРЖДЁН | Видимое `Этап N из 3`, итог 11 111 км, подписи трёх дисциплин; состояния различаются толщиной и квадратным маркером, не только цветом; проверены `complete/active/future`, `complete/active/future`, `complete/complete/active`; `17-distance-stage-1-of-3-mobile.png`, `17-distance-stage-2-of-3-mobile.png`, `17-distance-stage-3-of-3-mobile.png` |
| D10 | Раскрытые «Факты и источники» тесные, скученные и без редакционной иерархии | PRODUCTION ПОДТВЕРЖДЁН | Одна редакционная строка на доказательство, устойчивые оси индекса/заголовка/пояснения/источников; desktop и 390 px без overflow; `07-proof-editorial-desktop.png`, `07-proof-editorial-mobile-390.png` |
| D11 | Контакты нарушают принцип близости в menu, partners и footer | PRODUCTION ПОДТВЕРЖДЁН | Компактные вертикальные группы с шириной ссылок по содержимому; одинаковые внешние стрелки у контактов заменены семантическими 15.2 px mail/Telegram-иконками перед текстом; `15-menu-fewer-lines-contact-icons-390.png`, `08-contacts-partners-desktop.png` |
| D12 | Разделители и межсекционные интервалы несистемны; audio → diary образует случайный разрыв | PRODUCTION ПОДТВЕРЖДЁН | В menu нет линий между отдельными пунктами: сохранены только две границы смысловых зон. У audio есть одна верхняя граница, нижняя удалена; diary начинается вплотную (`gap 0`) без второй границы и получает ритмический отступ 64.8 px desktop / 44 px mobile. Контракт защищён `src/check.mjs`; `20-separator-system-desktop-1440.png`, `20-separator-system-mobile-390.png` |
| D13 | Тёмная тема не имеет самостоятельного характера и не прошла визуальную приёмку | PRODUCTION ПОДТВЕРЖДЁН | Собрана самостоятельная «ночная трасса»: холодный teal в тенях и медиа, acid как сигнал времени/действия, тёплый coral для доказательного блока, тёплый песочный свет в истории героя и отдельный olive-сценарий партнёров. Фото сохраняют цвет, но получают единый ночной grade и vignette. Production-материал D06 не изменён (`glassUnchanged: true`). Проверены RU 1440/390 и EN 1440/390, overflow 0; `22-dark-after-top-1440.png`, `22-dark-after-diary-1440.png`, `22-dark-after-athlete-1440.png`, `22-dark-after-proof-1440.png`, `22-dark-after-partners-1440.png`, `22-dark-after-top-mobile-390.png`, `22-dark-after-en-top-1440.png`, `22-dark-after-en-top-mobile-390.png` |
| D14 | Theme switcher выглядит как лишние кнопки и отдельное выпадающее меню | PRODUCTION ПОДТВЕРЖДЁН | Отдельный header dropdown удалён из HTML/CSS/JS; три текстовых состояния встроены в общий menu utility и продублированы в footer; desktop/mobile проверены, реальный 200% входит в G04; `13-menu-theme-integrated-desktop.png`, `13-menu-theme-integrated-mobile-390.png` |
| D15 | Favicon/компактный знак нечитаем в реальном размере | PRODUCTION ПОДТВЕРЖДЁН | Текстовая имитация/квадратный кроп удалены: system/light/dark используют все пять точных path из `logo.svg` и его `viewBox 0 0 512 231`, без фона. Растровый контроль выполнен в реальных 16/32 px на светлой и тёмной подложке; точное совпадение path/viewBox и контраст тем защищены `src/check.mjs`; `21-favicon-16-32-light-dark.png` |
| D16 | Подпись и описание активной аудиосцены не совпадают с колонками и оптической базовой линией | PRODUCTION ПОДТВЕРЖДЁН | Разделитель привязан к точным 20% player: отклонение от границы первой вкладки 0.00044 px; текстовые блоки выровнены по общей baseline; overflow 0; `14-audio-context-aligned-desktop.png` |
| D17 | При 200% текста состояния темы в мобильном menu перекрываются | PRODUCTION ПОДТВЕРЖДЁН | Utility переведён на content-aware flex-wrap: при обычном размере язык и тема сохраняют компактную строку, при крупном тексте rem-basis складывает их в отдельные строки. Живой 390×844/200%: три bounding box не пересекаются (`overlaps: []`), scrollWidth = clientWidth = 390 |
| D18 | При 200% текста финальный CTA menu распадается внутри анонимного flex-узла | PRODUCTION ПОДТВЕРЖДЁН | Текст выделен в собственный span, CTA переведён на grid `minmax(0,1fr) auto`. Живой 390×844/200%: все слова видимы, `clientHeight = scrollHeight = 170`, CTA полностью в viewport, overflow 0; автоматическое доказательство `automated/ru-390-text-200-menu-bottom.png` |

## Технический долг

| ID | Долг | Статус | Критерий закрытия |
|---|---|---|---|
| T01 | Монолитный CSS | ЗАКРЫТ | 130 196 байт разделены без потерь на 7 смысловых модулей: foundations/navigation, hero/audio, editorial/distance/story, proof/adventures/interviews, partners/footer, responsive, themes/accessibility. `build.mjs` склеивает их в один production `styles.css`; SHA-256 до/после идентичен: `7ca5dcc…de9c`. `check.mjs` требует буквальное равенство bundle и единственную stylesheet-ссылку; визуальный контроль `23-css-modules-proof-1440.png` |
| T02 | Автоматический браузерный регресс | ЗАКРЫТ | `scripts/browser-regression.mjs` сам собирает сайт, поднимает одноразовый локальный сервер и проверяет Chromium + WebKit: RU 1440×900, RU 390×844, EN 320×844. Gate охватывает overflow, CTA, стабильность menu trigger при скролле, единый material, outline-only controls, смену темы, аудиосцены, scroll anchor источников и мобильную шкалу. Итог: 6/6 PASS |
| T03 | Production gate со скриншотами | ЗАКРЫТ | `scripts/screenshot-gate.mjs` сам собирает сайт и создаёт детерминированный Chromium-набор из 17 состояний: 1440, 390, 320, top/bottom 200% menu, keyboard focus, reduced motion, заблокированное видео, RU/EN во всех темах и три фазы. Все рендеры и `manifest.json` сохранены в `artifacts/gate/automated/`; 17/17 PASS, критические кадры приняты визуально |
| T04 | Полный набор целей Метрики | ЗАКРЫТ | `src/analytics-goals.json` фиксирует 18 целей навигации, конверсии, предпочтений, доказательств и медиа. HTML и JS используют только этот реестр; неизвестные цели/параметры отбрасываются, разрешены только категориальные `chapter/language/location/scene/theme`, без PII, URL и свободного текста. `check.mjs` требует точное покрытие всех триггеров; Chromium/WebKit фактически подтвердили 7 интерактивных целей в каждом из 6 прогонов. Документация: `docs/analytics-goals.md`; 6/6 browser PASS |
| T05 | Состояния «подготовка → проект → завершение» | ЗАКРЫТ | Production выбирает состояние только по датам. Локальные `?phase=before|active|finished` дают фиксированные даты и не работают вне localhost/127.0.0.1. Для каждого состояния проверены body-state, `aria-current`, статусная шкала и отдельный рендер: `automated/ru-1440-phase-before.png`, `automated/ru-1440-phase-active.png`, `automated/ru-1440-phase-finished.png`; общий screenshot gate 17/17 PASS |
| T06 | Регулярная актуализация статистики | ЗАКРЫТ | `project-status.schema.json` + общий валидатор требуют версию, verified-флаг, ISO date-time, дистанцию 0…11 111, полные RU/EN дисциплину и подпись источника, публичный HTTPS-источник и запрещают скрытые данные при `verified:false`. Текущий файл честно пуст: данные не выдуманы. `update-project-status.mjs` поддерживает dry-run/reset, `validate-project-status.mjs` включён в gate; валидный fixture принят, неверные дата/12 000 км/HTTP отклонены. Процедура: `docs/status-updates.md` |
| T07 | Список дальнейших улучшений | ЗАКРЫТ | `docs/improvements.md`: приоритеты P1–P5 с продуктовой ценностью и проверяемым критерием — редакционная лента, партнёрский контур, недельный отчёт доказательности, подтверждаемый импорт дистанции, media-решения по production-данным. Документ явно отделён от текущего gate и не маскирует остатки |
| T08 | Устаревшие Node 20 action-зависимости в Pages workflow | ЗАКРЫТ | Workflow переведён на официальные актуальные `pnpm/action-setup@v6`, `actions/upload-artifact@v7`, `actions/upload-pages-artifact@v5`, `actions/deploy-pages@v5`. Повторный quality/deploy `30654539764` прошёл без прежних Node 20 annotations |

## Финальный gate и выпуск

| ID | Этап | Статус |
|---|---|---|
| G01 | 1440×900 | PRODUCTION ПОДТВЕРЖДЁН — живой браузер 1440×900: один h1, CTA видимы, menu 176×44, overflow 0; automated RU system/dark + EN system/light |
| G02 | 390×844 | PRODUCTION ПОДТВЕРЖДЁН — живые RU menu/system и EN dark, CTA 358 px, material equality true, overflow 0; Chromium/WebKit PASS |
| G03 | 320 px | PRODUCTION ПОДТВЕРЖДЁН — h1 и оба CTA в 16…304 px, scrollWidth = clientWidth = 320; Chromium/WebKit EN 320 PASS |
| G04 | 200% текста/zoom и keyboard | PRODUCTION ПОДТВЕРЖДЁН — живой 32 px root: menu прокручивается, темы не пересекаются, CTA достижим и не обрезан; фактический Tab/focus screenshot и Chromium keyboard gate, `ru-390-text-200-menu*.png`, `ru-390-keyboard-focus.png` |
| G05 | reduced motion и video fallback | PRODUCTION ПОДТВЕРЖДЁН — reduced motion с загруженным видео: paused + доступный play; при блокировке MP4 управление скрыто и остаётся poster; отдельные рендеры и assertions PASS |
| G06 | RU и EN, light/system/dark | PRODUCTION ПОДТВЕРЖДЁН — все 6 locale/theme комбинаций покрыты 17-кадровым набором; живой EN dark 390: lang/theme корректны, оба CTA 358 px, overflow 0 |
| G07 | Commit, push, deployment, public asset/render verification | PRODUCTION ПОДТВЕРЖДЁН — `796df14` в `main`/`origin/main`; workflow `30654539764` success; публичные RU/EN HTML, CSS и JS имеют точные release-хэши; RU 1440/390/320 и EN dark 390 прошли браузерную проверку |
