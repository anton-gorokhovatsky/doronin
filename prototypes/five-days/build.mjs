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
  const link = (target, label, direction) =>
    `<a class="episode-return" href="#race-day-${pad(target.day)}"><span>${label} · ${target.date}</span><strong>${esc(target.title)}</strong>${arrow(direction)}</a>`;
  return `<nav class="episode-pager" aria-label="${en ? 'Stage navigation' : 'Переходы между этапами'}">
    ${older ? link(older, en ? 'Previous stage' : 'Предыдущий этап', 'left') : ''}
    ${newer ? link(newer, newer === latest ? (en ? 'Current stage' : 'Текущий этап') : (en ? 'Next stage' : 'Следующий этап'), 'right') : ''}
    ${newer && newer !== latest ? `<a class="stage-link episode-pager__today" href="#race-day-${pad(latest.day)}"><span class="stage-link__copy">${en ? 'Back to today' : 'К текущему этапу'}</span></a>` : ''}
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

function calendarRow(day, plan, lang, latestDay) {
  const today = day.day === latestDay;
  const en = lang === 'en';
  const km = en ? 'km' : 'км';
  const state = today ? ' december-row--today' : day.day < latestDay ? ' december-row--past' : '';
  const date = iso(day.day);
  const segment = plan.segments.find(s => s.startDate <= date && date <= s.endDate);
  const amount = segment.dailyDistanceKm || segment.totalDistanceKm;
  const prior = plan.segments.slice(0, plan.segments.indexOf(segment)).reduce((sum, s) => sum + s.totalDistanceKm, 0);
  const cumulative = prior + amount * (day.day - Number(segment.startDate.slice(-2)) + 1);
  // Preserve the two existing fragment addresses. The rest of this block now
  // has a distinct row for each date, including tomorrow's unpublished stage.
  const id = day.day < 3 ? `calendar-segment-${pad(day.day)}` : `calendar-day-${pad(day.day)}`;
  return `<article class="december-row${state}" id="${id}" data-calendar-start="${date}" data-calendar-end="${date}" data-calendar-kind="${segment.kind}"${day.preview ? ` data-calendar-preview="${esc(day.preview.source)}" data-calendar-preview-position="${esc(day.preview.position)}"` : ''}${today ? ' aria-current="step"' : ''}>
    <div class="december-row__event"><p class="december-row__date"><time datetime="${date}">${day.date}</time>${today ? `<span class="december-row__today" data-calendar-today>${en?'Today':'Сегодня'}</span>` : ''}</p><p class="december-row__type">${day.type}</p></div>
    <p class="december-row__distance"><span class="december-row__number" data-optical-start data-optical-ink>${amount}</span><span class="december-row__unit">${km}</span></p>
    <p class="december-row__total"><span>${en ? 'By ' : 'К '}${day.date} —</span><strong><span>${cumulative}</span><span> ${km}</span></strong></p>
    ${day.title ? calendarLink(day.day, day.title) : ''}
  </article>`;
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
      ? (en ? 'Special stage' : 'Специальный этап') : (en ? 'Base stage' : 'Базовый этап')}));
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
    const description = en ? 'Viktor Doronin’s first five stages. Photographs and stories from his life.' : 'Первые пять этапов Виктора Доронина. Фотографии и истории из его жизни.';
    const headDate = en ? 'December 5, 2026' : '5 декабря 2026';
    const todayLabel = (en ? 'Today, ' : 'Сегодня, ') + latest.date;
    const prepare = fragment => fragment
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
      .replace('</head>', `<link rel="stylesheet" href="${base}five-days.css"><link rel="stylesheet" href="${base}../start-day-2/stage-gallery.css"><script src="${base}calendar-hover.js" defer></script></head>`);
    html = prepare(html.slice(0, firstPanel)) + episodes + prepare(html.slice(lastPanelEnd));
    // The total is one source value. At enlarged narrow widths, expose its
    // hours and minutes as labelled atoms instead of splitting after a colon.
    html = html.replace(/(<strong\b[^>]*\bdata-film-total\b[^>]*>)(\d+):(\d+)(<\/strong>)/,
      (_, opening, hours, minutes, closing) => `${opening}${hours}:${minutes}${closing}<span class="film-duration-parts"><span class="film-duration-part"><b data-optical-start>${hours}</b><small>${en ? 'hr' : 'ч'}</small></span><span class="film-duration-part"><b data-optical-start>${minutes}</b><small>${en ? 'min' : 'мин'}</small></span></span>`);
    html = advancePeaks(html, latest.day, todayLabel);
    const tomorrow = {day: 6, date: dateLabel(6), type: latest.type};
    const previewDays = days.map(day => {
      if (day.old) {
        const image = day.old.match(/<img\b[^>]*>/)?.[0] || '';
        const file = image.match(/src="[^"]*\/([\w-]+)-original\.png"/)?.[1];
        if (!file) throw new Error(`Missing preview frame for day ${day.day}.`);
        return {...day, preview: {source: `${base}thumbnails/${file}.jpg`, position: image.match(/object-position:([^;"]+)/)?.[1] || '50% 50%'}};
      }
      const frames = media.find(item => item.day === day.day);
      const photo = frames.items.find(item => item.file === frames.hero) ||
        frames.items.find(item => item.file.includes('night-rider')) || frames.items[0];
      return {...day, preview: {source: `${base}media/${photo.file}`, position: photo.position}};
    });
    const rows = [...previewDays, tomorrow].map(d => calendarRow(d, plan, lang, latest.day)).join('\n');
    html = html.replace(/<span class="december-row__number">/g, '<span class="december-row__number" data-optical-start data-optical-ink>');
    html = html.replace(/<article class="december-row december-row--past"[^>]*id="calendar-segment-01"[\s\S]*?<\/article>\s*<article[^>]*id="calendar-segment-02"[\s\S]*?<\/article>/, rows);
    if (!html.includes('id="calendar-day-05"') || !html.includes('href="#race-day-05"')) throw new Error('Missing current stage');
    await mkdir(localeDir, {recursive:true});
    await writeFile(path.join(localeDir, 'index.html'), html);
  }
}
