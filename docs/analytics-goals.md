# Цели Яндекс Метрики

Единственный машиночитаемый реестр находится в
`src/analytics-goals.json`. Счётчик: `111159425`.

## Покрытие

| Группа | Цели |
|---|---|
| Навигация | `menu_open`, `chapter_navigation`, `project_explore` |
| Конверсия | `partner_interest`, `contact_email`, `contact_telegram` |
| Предпочтения | `language_switch`, `theme_change` |
| Первый экран | `hero_video_pause`, `hero_video_resume` |
| Доказательства | `proof_open` |
| Звук | `sound_scene_select`, `sound_story_start`, `sound_story_complete` |
| Дневник и фильм | `diary_video_start`, `diary_video_complete`, `diary_open`, `film_open` |

## Privacy contract

В параметры попадают только заранее разрешённые категориальные значения:
идентификатор раздела, номер звуковой сцены, язык, тема и место переключателя.
Адреса, имена, контактные значения, полный URL, свободный текст и содержимое
полей не отправляются. `app.js` отбрасывает неизвестные цели, неизвестные ключи
параметров и значения вне безопасного формата.

`src/check.mjs` требует, чтобы реестр был полным: каждая цель должна иметь
реальный статический или программный триггер, а ни HTML, ни JavaScript не могут
отправить цель вне реестра.
