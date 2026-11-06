import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const pad = day => String(day).padStart(2, '0');
const iso = day => `2026-12-${pad(day)}`;
const arrows = {
  up: 'M8 13V3M4.5 6.5 8 3l3.5 3.5',
  left: 'M13 8H3m3.5-3.5L3 8l3.5 3.5',
  right: 'M3 8h10m-3.5-3.5L13 8l-3.5 3.5',
};
function arrow(direction) {
  return `<svg class="icon icon--${direction}" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="${arrows[direction]}"/></svg>`;
}
function calendarLink(day, title) {
  const cut = title.lastIndexOf(' ') + 1;
  return `<a class="stage-link" data-stage-calendar-link href="#life-story-${pad(day)}"><span class="stage-link__label"><span class="stage-link__copy">${esc(title.slice(0, cut))}</span><span class="stage-link__tail"><span class="stage-link__copy">${esc(title.slice(cut))}</span>${arrow('up')}</span></span></a>`;
}
function pager(edition, days, lang) {
  const older = days[days.indexOf(edition) - 1];
  const newer = days[days.indexOf(edition) + 1];
  const latest = days.at(-1);
  const en = lang === 'en';
  const preview = target => `data-calendar-start="${iso(target.day)}" data-calendar-preview="${esc(target.preview.source)}" data-calendar-preview-position="${esc(target.preview.position)}"`;
  const link = (target, label, direction) =>
    `<a class="episode-return" href="#race-day-${pad(target.day)}" ${preview(target)}><span>${label} · ${target.date}</span><strong>${calendarPastStory(target.title, direction)}</strong></a>`;
  return `<nav class="episode-pager" aria-label="${en ? 'Stage navigation' : 'Переходы между этапами'}">
    ${older ? link(older, en ? 'Previous stage' : 'Предыдущий этап', 'left') : ''}
    ${newer ? link(newer, newer === latest ? (en ? 'Current stage' : 'Текущий этап') : (en ? 'Next stage' : 'Следующий этап'), 'right') : ''}
    ${newer && newer !== latest ? `<a class="episode-return episode-pager__today" href="#race-day-${pad(latest.day)}" ${preview(latest)}><strong>${calendarPastStory(en ? 'Back to today' : 'К текущему этапу', 'up')}</strong></a>` : ''}
  </nav>`;
}
function episode(day, days, lang, mediaBase) {
  const en = lang === 'en';
  const id = pad(day.day);
  const group = en ? `Photographs from December ${day.day}` : `Фотографии этапа ${day.day} декабря`;
  const photos = day.photos.map((photo, i) =>
    `<a class="start-photos__open" href="${mediaBase}${esc(photo.file)}" data-start-photo="${i}"><img src="${mediaBase}${esc(photo.thumb || photo.file)}" alt="${esc(photo[lang])}" style="object-position:${esc(photo.position)}" loading="lazy" decoding="async"></a>`).join('');
  const previous = en ? 'Previous photograph' : 'Предыдущая фотография';
  const next = en ? 'Next photograph' : 'Следующая фотография';
  return `<section class="section section--light stage-episode" id="race-day-${id}" data-episode="${id}" tabindex="-1" aria-labelledby="life-story-title-${id}">
    <p class="stage-context"><time datetime="${iso(day.day)}">${day.date}</time> · ${day.type}</p>
    <div class="stage-episode__media"><div class="stage-photos">
      <div class="start-photos" tabindex="0" role="group" aria-label="${group}" data-start-photo-strip>${photos}</div>
      <nav class="start-photo-controls" aria-label="${group}"><span data-start-strip-count aria-live="polite">1 / ${day.photos.length}</span><div><button type="button" data-start-strip-prev disabled aria-label="${previous}">${arrow('left')}</button><button type="button" data-start-strip-next aria-label="${next}">${arrow('right')}</button></div></nav>
    </div></div>
    <div class="stage-episode__narrative"><div class="stage-story" id="life-story-${id}"><h2 id="life-story-title-${id}">${esc(day.title)}</h2><div class="stage-story__body">${day.paragraphs.map(p => `<p>${esc(p)}</p>`).join('')}</div></div></div>
    ${pager(day, days, lang)}
  </section>`;
}

// The accepted chart is schematic. Place the date on its existing line, using
// the labelled dates as anchors. Never interpret the date as measured mileage.
function advancePeaks(html, today, dayLabel) {
  const pathData = html.match(/class="hero-peaks__route" d="([^"]+)"/)[1];
  const points = [...pathData.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map(m => [Number(m[1]), Number(m[2])]);
  const labels = [...html.matchAll(/<li data-date="2026-12-(\d\d)" style="--peak-x:([\d.]+)%/g)];
  const [first, second] = labels;
  const x = 6 * (Number(first[2]) + (today - Number(first[1])) / (Number(second[1]) - Number(first[1])) * (Number(second[2]) - Number(first[2])));
  const drawn = points.filter(([px]) => px <= x);
  const [x1, y1] = drawn.at(-1);
  const [x2, y2] = points[drawn.length];
  const y = y1 + (y2 - y1) * (x - x1) / (x2 - x1);
  drawn.push([x, y]);
  return html.replace('class="hero-peaks hero-peaks--dated"', `class="hero-peaks hero-peaks--dated" style="--today-x:${(x / 6).toFixed(3)}%;--today-y:${(y / 88).toFixed(5)}"`)
    .replace(/class="hero-peaks__past" d="[^"]*"/, `class="hero-peaks__past" d="M${drawn.map(([a,b]) => a.toFixed(2) + ' ' + b.toFixed(2)).join(' L')}"`)
    .replace(/<a class="hero-peaks__today"[^>]*>[^<]*<\/a>/, `<a class="hero-peaks__today" href="#calendar-day-${pad(today)}" aria-current="date">${dayLabel}</a>`);
}

// One selected frame for a stage, shared by its calendar row and pager links.
function calendarPreview(day, media, base) {
  if (day.old) {
    const image = day.old.match(/<img\b[^>]*>/)?.[0] || '';
    const file = image.match(/src="[^"]*\/([\w-]+)-original\.png"/)?.[1];
    if (!file) throw new Error(`Missing preview frame for day ${day.day}.`);
    return {source: `${base}thumbnails/${file}.jpg`, position: image.match(/object-position:([^;"]+)/)?.[1] || '50% 50%'};
  }
  const frames = media.find(item => item.day === day.day);
  const photo = frames.items.find(item => item.file === frames.hero) ||
    frames.items.find(item => item.file.includes('night-rider')) || frames.items[0];
  return {source: `${base}media/${photo.file}`, position: photo.position};
}
function calendarPastStory(title, direction = 'up') {
  const cut = title.lastIndexOf(' ') + 1;
  return `${esc(title.slice(0, cut))}<span class="calendar-past__tail">${esc(title.slice(cut))}${arrow(direction)}</span>`;
}

function calendarValues(day, plan) {
  const date = iso(day.day);
  const segment = plan.segments.find(item => item.startDate <= date && date <= item.endDate);
  const amount = segment.dailyDistanceKm || segment.totalDistanceKm;
  const prior = plan.segments.slice(0, plan.segments.indexOf(segment)).reduce((sum, item) => sum + item.totalDistanceKm, 0);
  const cumulative = prior + amount * (day.day - Number(segment.startDate.slice(-2)) + 1);
  const id = day.day < 3 ? `calendar-segment-${pad(day.day)}` : `calendar-day-${pad(day.day)}`;
  return {date, segment, amount, cumulative, id};
}
function calendarPastLink(day, plan, lang) {
  const en = lang === 'en';
  const km = en ? 'km' : 'км';
  const {date, segment, amount, cumulative, id} = calendarValues(day, plan);
  return `<a class="december-row december-row--past calendar-past__item" id="${id}" href="#life-story-${pad(day.day)}" data-calendar-start="${date}" data-calendar-end="${date}" data-calendar-kind="${segment.kind}" data-calendar-preview="${esc(day.preview.source)}" data-calendar-preview-position="${esc(day.preview.position)}">
    <span class="calendar-past__identity"><span class="calendar-past__story">${calendarPastStory(day.title)}</span><span class="calendar-past__date"><time datetime="${date}">${day.date}</time><span>${day.type}</span></span></span>
    <span class="calendar-past__metrics"><span>${en ? 'Planned' : 'План'} ${amount} ${km}</span><span>${en ? 'Planned total' : 'Всего по плану'} ${cumulative} ${km}</span></span>
  </a>`;
}
function calendarRow(day, plan, lang, latestDay) {
  const today = day.day === latestDay;
  const en = lang === 'en';
  const km = en ? 'km' : 'км';
  const state = today ? ' december-row--today' : day.day < latestDay ? ' december-row--past' : '';
  const values = calendarValues(day, plan);
  const {date, segment, amount, cumulative, id} = {...values, ...day.values};
  const dateEnd = day.endDate || date;
  const format = value => value < 10000 ? String(value) : String(value).replace(/\B(?=(\d{3})+(?!\d))/g, en ? ',' : ' ');
  const description = segment.kind === 'finish' ? (en ? 'Project finish' : 'Финиш проекта')
    : segment.kind === 'special' ? (dateEnd !== date ? (en ? 'Continuous ride' : 'Непрерывный заезд') : (en ? 'Special stage' : 'Специальный этап')) : '';
  const event = `<div class="december-row__event"><p class="december-row__date"><time datetime="${date}">${day.date}</time>${today ? `<span class="december-row__today" data-calendar-today>${en?'Today':'Сегодня'}</span>` : ''}</p>${description ? `<p class="december-row__type">${description}</p>` : ''}${day.title ? calendarLink(day.day, day.title) : ''}${segment.kind === 'finish' ? `<p class="december-row__note">${en ? 'Recording the final result' : 'Фиксация результата'}</p>` : ''}</div>`;
  return `<article class="december-row${state}" id="${id}" data-calendar-start="${date}" data-calendar-end="${dateEnd}" data-calendar-kind="${segment.kind}"${day.preview ? ` data-calendar-preview="${esc(day.preview.source)}" data-calendar-preview-position="${esc(day.preview.position)}"` : ''}${today ? ' aria-current="step"' : ''}>
    ${event}
    ${segment.kind === 'finish' ? '' : `<p class="december-row__distance"><span class="december-row__number" data-optical-start data-optical-ink>${format(amount)}</span><span class="december-row__unit"><span class="december-row__unit-measure"> ${km}</span>${segment.kind === 'base' && dateEnd !== date ? ` <span>${en ? 'per day' : 'в день'}</span>` : ''}</span></p>
    <p class="december-row__total"><span>${en ? 'Planned total' : 'Всего по плану'}</span><strong><span>${format(cumulative)}</span><span class="december-row__total-unit"> ${km}</span></strong></p>`}
  </article>`;
}

// The rehearsal changes the calendar's current date, not the plan. Render the
// remaining rows from the same canonical segments, clipping only the base
// block which contains today. A two-date continuous ride remains one row.
function remainingCalendarRows(latest, plan, lang) {
  const today = iso(latest.day);
  let cumulative = 0;
  const rows = [calendarRow(latest, plan, lang, latest.day)];
  for (const [index, segment] of plan.segments.entries()) {
    cumulative += segment.totalDistanceKm;
    if (segment.endDate <= today) continue;
    if (segment.startDate <= today && segment.kind !== 'base') throw new Error('A continuous ride cannot be split into daily calendar rows.');
    const firstDay = segment.startDate <= today ? latest.day + 1 : Number(segment.startDate.slice(-2));
    const lastDay = Number(segment.endDate.slice(-2));
    const en = lang === 'en';
    const range = firstDay === lastDay ? String(firstDay) : `${firstDay}–${lastDay}`;
    const date = en ? `December ${range}` : `${range} декабря`;
    rows.push(calendarRow({day: firstDay, date, endDate: segment.endDate,
      values: {date: iso(firstDay), segment, amount: segment.dailyDistanceKm || segment.totalDistanceKm,
        cumulative, id: segment.startDate <= today ? `calendar-day-${pad(firstDay)}` : `calendar-segment-${pad(index + 1)}`}},
    plan, lang, latest.day));
  }
  return rows.join('\n');
}

function sectionEnd(html, start) {
  const tags = /<\/?section\b[^>]*>/g;
  tags.lastIndex = start;
  let depth = 0;
  for (let tag = tags.exec(html); tag; tag = tags.exec(html)) {
    depth += tag[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return tags.lastIndex;
  }
  throw new Error('Unclosed section while restoring the course forecast.');
}
function restoreCourseWeather(html, lang) {
  const start = html.indexOf('<section class="dubai-light"');
  if (start < 0) throw new Error('Missing the existing Dubai forecast widget.');
  const end = sectionEnd(html, start);
  let widget = html.slice(start, end)
    .replace('data-start-preview-light', 'data-dubai-controls data-weather-only data-weather-compact')
    .replace(/data-dust-url="[^"]*"/, 'data-dust-url="/assets/dubai-dust.json"')
    .replace(/(<h3 id="dubai-light-title">)[^<]*/, `$1${lang === 'en' ? 'Weather on the Dubai course' : 'Погода на трассе в Дубае'}`);
  // The compact menu uses the existing current-weather owner and source,
  // without carrying a second, six-hour forecast presentation.
  const outlook = widget.indexOf('<section class="dubai-forecast"');
  if (outlook < 0) throw new Error('Missing forecast source for compact weather.');
  const outlookEnd = sectionEnd(widget, outlook);
  const source = widget.slice(outlook, outlookEnd).match(/<p class="dubai-forecast__source">[\s\S]*?<\/p>/)?.[0];
  if (!source) throw new Error('Missing current forecast source.');
  widget = widget.slice(0, outlook) + source + widget.slice(outlookEnd);
  html = html.slice(0, start) + html.slice(end);
  const menu = html.indexOf('<div class="menu-weather"');
  if (menu < 0) throw new Error('Missing the menu forecast container.');
  const divs = /<\/?div\b[^>]*>/g;
  divs.lastIndex = menu;
  let depth = 0;
  for (let tag = divs.exec(html); tag; tag = divs.exec(html)) {
    depth += tag[0].startsWith('</') ? -1 : 1;
    if (depth === 0) {
      const insertion = tag.index;
      return html.slice(0, insertion) + widget + html.slice(insertion);
    }
  }
  throw new Error('Unclosed menu forecast container.');
}

export async function buildFiveDays(directory) {
  const [stories, media, plan] = await Promise.all([
    json(path.join(here, 'stories.json')), json(path.join(here, 'media.json')),
    json(path.join(here, '../../src/project-plan.json')),
  ]);
  if (stories.map(s => s.day).join() !== '3,4,5') throw new Error('Expected three new stories, in order.');
  for (const lang of ['ru', 'en']) {
    const en = lang === 'en';
    const localeDir = en ? path.join(directory, 'en') : directory;
    let html = await readFile(path.join(localeDir, 'december-2.html'), 'utf8');
    const base = en ? '../assets/five-days/' : './assets/five-days/';
    const dateLabel = day => en ? `December ${day}` : `${day} декабря`;
    const old = [...html.matchAll(/<section class="section section--light stage-episode"[^>]*data-episode="(\d+)"[\s\S]*?<\/section>/g)];
    if (old.length !== 2) throw new Error('The day-two edition must contain its two original stage sections.');
    const days = [
      ...old.reverse().map(([markup, day]) => ({
        day: Number(day), old: markup, title: markup.match(/<h2 id="life-story-title-\d+">([^<]+)<\/h2>/)[1],
      })),
      ...stories.map(s => ({day: s.day, ...s[lang], photos: media.find(m => m.day === s.day)?.items})),
    ].map(day => ({...day, date: dateLabel(day.day), type: day.day === 1
      ? (en ? 'Special stage' : 'Специальный этап') : (en ? 'Base day' : 'Базовый день')}))
      .map(day => ({...day, preview: calendarPreview(day, media, base)}));
    const latest = days.at(-1);
    if (days.some(d => !d.old && !d.photos?.length)) throw new Error('Every published stage needs its own photographs.');
    const currentId = pad(latest.day);
    const heroFile = media.find(m => m.day === latest.day).hero;
    const hero = base + 'media/' + heroFile;
    const stagesPhoto = media.find(m => m.day === 3).items.find(photo => photo.file === 'day-03-crest.jpg');
    if (!stagesPhoto) throw new Error('Missing the road photograph for the stages menu link.');
    const episodes = days.toReversed().map(day => {
      if (!day.old) return episode(day, days, lang, base + 'media/');
      const result = day.old.replace(/<a class="episode-return"[\s\S]*?<\/a>/g, '')
        .replace(/<p class="stage-episode__bridge">[\s\S]*?<\/p>/, '')
        .replace(/(<time datetime="2026-12-0[12]">)[^<]*/, `$1${day.date}`)
        .replace(/(<img src=")(?:\.\.\/|\.\/)(?:december-1-saved\/assets\/start-day|assets\/start-day-2)\/([\w-]+)-original\.png"/g, `$1${base}thumbnails/$2.jpg"`);
      return result.replace('</section>', pager(day, days, lang) + '</section>');
    }).join('\n');
    const firstPanel = html.indexOf(old[1][0]);
    const lastPanelEnd = html.indexOf(old[0][0]) + old[0][0].length;
    const canonical = 'https://11111.life/december/';
    const heading = en ? 'Fifth stage' : 'Пятый этап';
    const description = en ? 'Victor Doronin’s first five stages. Photographs and stories from his life.' : 'Первые пять этапов Виктора Доронина. Фотографии и истории из его жизни.';
    const headDate = en ? 'December 5, 2026' : '5 декабря 2026';
    const todayLabel = (en ? 'Today, ' : 'Сегодня, ') + latest.date;
    const prepare = fragment => fragment
      .replace(/<script\b[^>]*\bsrc="[^"]*\/assets\/dubai-light\.js[^"]*"[^>]*><\/script>/g, '')
      .replace(/<a class="menu-weather__forecast-link"[^>]*>[\s\S]*?<\/a>/,
        '<p class="menu-weather__caption"><span data-menu-weather-time></span></p>')
      .replace(/(<div class="site-nav__status"[^>]*>[\s\S]*?)<a class="stage-link"[^>]*>[\s\S]*?<\/a>(<\/div>)/, '$1$2')
      .replaceAll('href="#race-day-02"', `href="#race-day-${currentId}"`)
      .replace(/data-start-preview-date="[^"]+"/, `data-start-preview-date="${iso(latest.day)}"`)
      .replace('<body data-day-two-preview', '<body data-five-days data-day-two-preview')
      .replace(/(<h1 id="hero-title"[^>]*>)[^<]*/, `$1${heading}`)
      .replace(/(<figure class="hero__media"><img src=")[^"]*(" width=")3840(" height=")2160/, `$1${hero}$2${2560}$3${1440}`)
      .replace(/(<time datetime=")2026-12-02(">)[^<]*(<\/time>)/, `$1${iso(latest.day)}$2${headDate}$3`)
      .replace(/(<span class="site-nav__status-meta">)[^<]*/, `$1${headDate} · ${en ? 'Dubai' : 'Дубай'}`)
      .replace(/(<strong data-menu-status-value[^>]*>)[^<]*/g, `$1${en ? 'Day' : 'День'} ${latest.day}`)
      .replace(/(<span data-menu-status-label[^>]*>)[^<]*/g, `$1${en ? 'of 31' : 'из 31'}`)
      .replace(/(<span class="event-status__value"[^>]*>)[^<]*/, `$1${latest.day}`)
      .replace(/(<span class="event-status__label"[^>]*>)[^<]*/, `$1${en ? 'of 31' : 'из 31'}`)
      .replace(/<img\b[^>]*\bdata-menu-preview-image[^>]*>/, tag => tag
        .replace(/src="[^"]+"/, `src="${hero}"`))
      .replace(/(href="#race-day-\d+" data-nav-index="01"[^>]*?data-nav-image=")[^"]+/, `$1${hero}`)
      .replace(/<a class="site-nav__link" href="#distance"[^>]*\bdata-nav-image="[^"]+"[^>]*>/, tag => tag
        .replace(/data-nav-image="[^"]+"/, `data-nav-image="${base}media/${stagesPhoto.file}"`)
        .replace(/(data-nav-(?:mobile-)?position=")[^"]+/g, `$1${stagesPhoto.position}`))
      .replace(/(<title>)[^<]*/, `$1${latest.date} · ${heading} — ${en ? '11,111' : '11 111'}`)
      .replace(/(<meta (?:name="description"|property="og:description"|name="twitter:description") content=")[^"]*/g, `$1${description}`)
      .replace(/(<meta (?:property="og:title"|name="twitter:title") content=")[^"]*/g, `$1${latest.date} · ${heading} — ${en ? '11,111' : '11 111'}`)
      .replaceAll(canonical + 'en/december-2.html', canonical + 'en/')
      .replaceAll(canonical + 'december-2.html', canonical)
      .replaceAll('href="./en/december-2.html"', 'href="./en/"')
      .replaceAll('href="../december-2.html"', 'href="../"')
      .replace('</head>', `<link rel="stylesheet" href="${base}five-days.css"><link rel="stylesheet" href="${base}../start-day-2/stage-gallery.css"><link rel="stylesheet" href="${base}../start-day-2/menu-weather.css"><script src="${base}calendar-hover.js" defer></script></head>`);
    html = prepare(html.slice(0, firstPanel)) + episodes + prepare(html.slice(lastPanelEnd));
    // The total is one source value. At enlarged narrow widths, expose its
    // hours and minutes as labelled atoms instead of splitting after a colon.
    html = html.replace(/(<strong\b[^>]*\bdata-film-total\b[^>]*>)(\d+):(\d+)(<\/strong>)/,
      (_, opening, hours, minutes, closing) => `${opening}${hours}:${minutes}${closing}<span class="film-duration-parts"><span class="film-duration-part"><b data-optical-start>${hours}</b><small>${en ? 'hr' : 'ч'}</small></span><span class="film-duration-part"><b data-optical-start>${minutes}</b><small>${en ? 'min' : 'мин'}</small></span></span>`);
    html = advancePeaks(html, latest.day, todayLabel);
    const previousDays = days.filter(day => day.day < latest.day);
    const pastRows = previousDays.map(day => calendarPastLink(day, plan, lang)).join('\n');
    const rows = remainingCalendarRows(latest, plan, lang);
    const columns = html.match(/<div class="december-calendar__columns"[^>]*>[\s\S]*?<\/div>/)?.[0];
    if (!columns) throw new Error('Missing calendar column labels.');
    const previousRange = en ? `December ${previousDays[0].day}–${previousDays.at(-1).day}`
      : `${previousDays[0].day}–${previousDays.at(-1).day} декабря`;
    const previous = `<details class="calendar-past" id="calendar-past" data-calendar-past>
      <summary><span class="calendar-past__label"><span class="calendar-past__command"><span class="calendar-past__action--closed">${en ? 'Show previous ' : 'Показать предыдущие '}</span><span class="calendar-past__action--open">${en ? 'Hide previous ' : 'Скрыть предыдущие '}</span><span class="calendar-past__tail">${en ? 'stages' : 'этапы'}${arrow('right')}</span></span><span class="calendar-past__range">${previousRange}</span></span></summary>
      <div class="calendar-past__rows">${pastRows}</div>
    </details>`;
    const calendarStart = html.lastIndexOf('<section', html.indexOf('id="distance"'));
    const columnStart = html.indexOf(columns, calendarStart);
    const calendarEnd = sectionEnd(html, calendarStart) - '</section>'.length;
    const headings = `<div class="december-calendar__columns" aria-hidden="true"><span>${en ? 'Date and stage' : 'Дата и этап'}</span><span>${en ? 'Distance, km' : 'Дистанция, км'}</span><span>${en ? 'Planned total, km' : 'План к этой дате, км'}</span></div>`;
    html = html.slice(0, columnStart) + previous + headings + rows + '\n' + html.slice(calendarEnd);
    html = html.replace(/(<header class="december-calendar__heading">)[\s\S]*?<\/header>/,
      header => header.replaceAll('базовые этапы', 'базовые дни').replaceAll('base stages', 'base days').replaceAll('Base stages', 'Base days'));
    if (!html.includes('id="calendar-day-05"') || !html.includes('href="#race-day-05"')) throw new Error('Missing current stage');
    html = restoreCourseWeather(html, lang);
    const statusStart = html.indexOf('<div class="site-nav__status"');
    const statusEnd = html.indexOf('<div class="menu-weather"', statusStart);
    if (html.slice(statusStart, statusEnd).includes('<a ')) throw new Error('Unexpected distance link in the menu status.');
    await mkdir(localeDir, {recursive:true});
    await writeFile(path.join(localeDir, 'index.html'), html);
  }
}
