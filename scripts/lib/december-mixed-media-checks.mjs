import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { renderStageMedia } from '../../prototypes/five-days/build.mjs';

// These July originals exercise the renderer locally. No fixture is written to
// a published page, and their labels never call them December reportage.
export function fixtureItems(base, count = 4) {
  const resource = file => {
    const url = new URL(base);
    url.pathname = url.pathname.replace(/\/$/, '') + file;
    url.search = ''; url.hash = '';
    return url.href;
  };
  const items = [
    { src: resource('/assets/diary-2026-07-06-02-poster.jpg'), width: 540, height: 960,
      alt: { ru: 'Локальная проверка: июльский кадр Виктора, 9:16', en: 'Local QA: Victor’s July frame, 9:16' } },
    { kind: 'video', src: resource('/assets/diary-2026-07-06-03.mp4'),
      poster: resource('/assets/diary-2026-07-06-03-poster.jpg'), width: 720, height: 1280,
      alt: { ru: 'Локальная проверка: июльское видео Виктора, 9:16', en: 'Local QA: Victor’s July video, 9:16' } },
    { src: resource('/assets/diary-2026-07-06-08.jpg'), width: 600, height: 800,
      alt: { ru: 'Локальная проверка: июльская фотография Виктора, 3:4', en: 'Local QA: Victor’s July photograph, 3:4' } },
    { src: resource('/december/assets/five-days/media/day-05-hands.jpg'), width: 1600, height: 900,
      alt: { ru: 'Контроль: прежний кадр 2024 года', en: 'Control: the existing 2024 frame' } },
  ];
  if (count === 6) items.push(
    { src: resource('/december/assets/five-days/media/day-04-night-city.jpg'), width: 1600, height: 900,
      alt: { ru: 'Контроль: ночной кадр 2024 года', en: 'Control: a 2024 night frame' } },
    { src: resource('/december/assets/five-days/media/day-03-crest.jpg'), width: 1600, height: 900,
      alt: { ru: 'Контроль: дневной кадр 2024 года', en: 'Control: a 2024 daytime frame' } },
  );
  assert.ok(count === 4 || count === 6);
  return items;
}

export function fixtureHtml(html, items, lang) {
  const episode = html.indexOf('id="race-day-05"');
  const episodeEnd = html.indexOf('</section>', episode);
  const opening = /<div\b[^>]*\bdata-start-photo-strip(?=\s|>)[^>]*>/.exec(html.slice(episode, episodeEnd));
  assert.ok(episode >= 0 && episodeEnd > episode && opening, 'The built current episode has a source media strip');
  const from = episode + opening.index + opening[0].length;
  let depth = 1;
  let to = -1;
  // A real video card and its actions contain their own divs. Match the outer
  // strip rather than taking the first closing div and leaving stale media.
  for (const tag of html.slice(from, episodeEnd).matchAll(/<\/?div\b[^>]*>/g)) {
    depth += tag[0].startsWith('</') ? -1 : 1;
    if (depth === 0) { to = from + tag.index; break; }
  }
  assert.ok(to > from, 'The current media strip closes inside its episode');
  return (html.slice(0, from) + renderStageMedia(items, lang) + html.slice(to))
    .replace('<title>', '<title>LOCAL MIXED-MEDIA QA — ')
    .replace(/(<section\b[^>]*\bid="race-day-05"[^>]*>[\s\S]*?<p class="stage-context">)[\s\S]*?<\/p>/,
      `$1${lang === 'en' ? 'Local QA · July 2026' : 'Тест · июль 2026'}</p>`)
    .replace(/(<p\b[^>]*\bdata-stage-media-source[^>]*>)[\s\S]*?<\/p>/,
      `$1${lang === 'en' ? 'Local QA: July diary media and 2024 film frames' : 'Локальная проверка: материалы июльского дневника и кадры фильма 2024 года'}</p>`)
    .replace(/(<span data-start-strip-count aria-live="polite">)1 \/ \d+/, (_, opening) => `${opening}1 / ${items.length}`);
}

async function mediaPage(browser, base, profile, { items, html, noScript = false, failVideo = false } = {}) {
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    hasTouch: profile.width < 961, isMobile: profile.width < 961,
    reducedMotion: profile.reduced ? 'reduce' : 'no-preference', javaScriptEnabled: !noScript,
  });
  if (html) {
    // Local synthetic sequences need no forecast request. The real page below
    // is loaded without route substitution, including its media and caption.
    await context.route('https://api.met.no/**', route => route.abort());
  }
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const url = new URL(base);
  url.pathname = url.pathname.replace(/\/$/, '') + `/december/${profile.lang === 'en' ? 'en/' : ''}`;
  url.hash = '';
  for (const [name, value] of Object.entries({ codexQa: '1', service: 'check', theme: profile.theme,
    ...(html ? { mixedMediaFixture: '1' } : {}), ...(profile.text ? { text: '200' } : {}) })) {
    url.searchParams.set(name, value);
  }
  if (html) {
    const documentUrl = url.href;
    await page.route(candidate => candidate.href === documentUrl,
      route => route.fulfill({ contentType: 'text/html', body: fixtureHtml(html, items, profile.lang) }));
  }
  const videoFailure = route => route.abort('failed');
  if (failVideo) await page.route(items[1].src, videoFailure);
  url.hash = 'race-day-05';
  await page.goto(url.href);
  await page.evaluate(() => document.fonts.ready);
  if (profile.text && !noScript) {
    // Public pages deliberately ignore the local text=200 fixture. Enlarge
    // the actual root type and trigger its existing responsive text policy.
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '32px';
      dispatchEvent(new Event('resize'));
    });
    assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize), '32px');
  }
  return { context, page, errors, videoFailure };
}

async function fixturePage(browser, base, profile, items, html, options = {}) {
  return mediaPage(browser, base, profile, { items, html, ...options });
}

const box = element => {
  const rect = element.getBoundingClientRect();
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom };
};

async function settle(page, strip, index) {
  await page.waitForFunction(({ element, index }) => element.dataset.photoIndex === String(index)
    && element.dataset.turning !== 'true', { element: await strip.elementHandle(), index });
  // Native media/focus can present its old transform after ownership changes.
  // Wait for the actual reading-frame role, rather than a fixed frame delay.
  await page.waitForFunction(({ strip, index }) => {
    const cards = [...strip.querySelectorAll('[data-start-photo]')], field = strip.getBoundingClientRect();
    const visible = cards.flatMap(card => {
      const media = card.querySelector('img,video'), rect = media.getBoundingClientRect();
      const style = getComputedStyle(card), mediaStyle = getComputedStyle(media);
      if (card.hidden || style.visibility === 'hidden' || Number(style.opacity) === 0 || mediaStyle.visibility === 'hidden' || Number(mediaStyle.opacity) === 0 ||
          rect.width <= 0 || rect.height <= 0 || rect.right <= field.left || rect.left >= field.right || rect.bottom <= field.top || rect.top >= field.bottom) return [];
      return [{ index: Number(card.dataset.startPhoto), current: card.dataset.current === 'true', area: rect.width * rect.height }];
    });
    const current = visible.find(item => item.current);
    return visible.length === 3 && current?.index === index &&
      [index, (index + 1) % cards.length, (index + 2) % cards.length].every(expected => visible.some(item => item.index === expected)) &&
      visible.every(item => item === current || current.area > item.area);
  }, { strip: await strip.elementHandle(), index }, { timeout: 3000 });
  const current = strip.locator('[data-start-photo][data-current="true"]');
  assert.equal(await current.count(), 1, 'The sequence has exactly one current item');
  assert.equal(await current.getAttribute('data-start-photo'), String(index));
  await assertThreeVisible(strip, index);
}

export async function assertThreeVisible(strip, index) {
  const scene = await strip.evaluate(strip => {
    const field = strip.getBoundingClientRect();
    return [...strip.querySelectorAll('[data-start-photo]')].flatMap(card => {
      const media = card.querySelector('img,video');
      if (!media) return [];
      const rect = media.getBoundingClientRect(), style = getComputedStyle(card), imageStyle = getComputedStyle(media);
      if (card.hidden || style.visibility === 'hidden' || Number(style.opacity) === 0 || imageStyle.visibility === 'hidden' || Number(imageStyle.opacity) === 0 ||
          rect.width <= 0 || rect.height <= 0 || rect.right <= field.left || rect.left >= field.right || rect.bottom <= field.top || rect.top >= field.bottom) return [];
      return [{ index: Number(card.dataset.startPhoto), source: media.src, area: rect.width * rect.height,
        current: card.dataset.current === 'true', next: card.dataset.following === 'true', later: card.dataset.later === 'true' }];
    });
  });
  const count = await strip.locator('[data-start-photo]').count();
  assert.equal(scene.length, 3, 'Exactly three original materials remain visible');
  assert.equal(new Set(scene.map(item => item.source)).size, 3, 'The visible materials use three distinct originals');
  assert.deepEqual(scene.map(item => item.index).sort((a, b) => a - b),
    [index, (index + 1) % count, (index + 2) % count].sort((a, b) => a - b), 'The visible window is current, next and after-next');
  const current = scene.find(item => item.current);
  assert.ok(current && current.index === index && scene.filter(item => !item.current).every(item => current.area > item.area),
    'The current source is the large reading frame, with two smaller previews');
  return scene;
}

async function nativePlay(page, video, engine) {
  await video.scrollIntoViewIfNeeded();
  if (engine === 'webkit') {
    // WebKit's initial native control is the central poster play button.
    await video.click();
  } else {
    await video.focus();
    await page.keyboard.press('Space');
  }
  await page.waitForFunction(video => !video.paused && video.currentTime > .15,
    await video.elementHandle(), { timeout: 8000 });
}

async function frame(page, output, name) {
  const file = path.join(output, name + '.png');
  await page.screenshot({ path: file, animations: 'disabled' });
  return file;
}

async function assertAspect(media, width, height) {
  const actual = await media.evaluate(box);
  assert.ok(actual.width > 0 && actual.height > 0, 'The selected source is visible');
  assert.ok(Math.abs(actual.width / actual.height - width / height) < .01, 'The complete source retains its native ratio');
  return actual;
}

async function readyImage(page, image) {
  await image.scrollIntoViewIfNeeded();
  // A formerly hidden lazy image starts its request after the visibility turn.
  await page.waitForFunction(image => image.complete && image.naturalWidth > 0,
    await image.elementHandle());
  await image.evaluate(image => image.decode());
}

async function seekNative(page, video, time) {
  await video.evaluate((video, time) => { video.currentTime = time; }, time);
  await page.waitForFunction(({ video, time }) => !video.seeking && video.readyState >= 2 && video.currentTime >= time && video.currentTime < time + .5,
    { video: await video.elementHandle(), time });
}

async function assertNoOverflow(page, episode) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false,
    'The series never causes horizontal page overflow');
  const caption = episode.locator('[data-stage-media-source]');
  assert.equal(await caption.evaluate(element => element.scrollWidth > element.clientWidth), false,
    'The provenance remains readable at the selected text size');
}

function nearestFrame(strip, readingSlot) {
  const scene = strip.getBoundingClientRect();
  const current = strip.querySelector('[data-current="true"] img,[data-current="true"] video').getBoundingClientRect();
  const slot = readingSlot || { x: current.left + current.width / 2, y: current.top + current.height / 2 };
  const frames = [...strip.querySelectorAll('[data-start-photo]')].flatMap(card => {
    const media = card.querySelector('img,video');
    const rect = media.getBoundingClientRect();
    const style = getComputedStyle(card);
    const mediaStyle = getComputedStyle(media);
    if (card.hidden || rect.width <= 0 || rect.height <= 0 || style.visibility === 'hidden' || Number(style.opacity) === 0 ||
        mediaStyle.visibility === 'hidden' || Number(mediaStyle.opacity) === 0 ||
        rect.right <= scene.left || rect.left >= scene.right || rect.bottom <= scene.top || rect.top >= scene.bottom) return [];
    return [{ index: Number(card.dataset.startPhoto), left: rect.left, top: rect.top,
      distance: Math.hypot(rect.left + rect.width / 2 - slot.x, rect.top + rect.height / 2 - slot.y) }];
  });
  frames.sort((a, b) => a.distance - b.distance);
  return { readingSlot: slot, frames, nearest: frames[0] };
}

async function checkHeldDrag(page, strip, output, name) {
  const initial = await strip.evaluate(nearestFrame);
  const photo = await strip.locator('[data-start-photo="0"] img').boundingBox();
  const scene = await strip.boundingBox();
  assert.ok(initial.nearest && photo && scene);
  const x = photo.x + photo.width * .8;
  const y = photo.y + photo.height * .45;
  let held;
  await page.mouse.move(x, y);
  await page.mouse.down();
  try {
    await page.mouse.move(x - photo.width * 1.8, y + 2, { steps: 12 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    held = await strip.evaluate(nearestFrame, initial.readingSlot);
    assert.ok(held.nearest && held.nearest.index !== initial.nearest.index,
      'The held long drag physically brings a different original nearest to the reading axis');
    await page.screenshot({ path: path.join(output, name + '-held.png') });
  } finally { await page.mouse.up(); }
  await settle(page, strip, held.nearest.index);
  const released = await strip.evaluate(nearestFrame, initial.readingSlot);
  assert.equal(released.nearest.index, held.nearest.index,
    'Release settles the nearest visible original instead of rebounding to the previous item');
  const releasedFrame = await frame(page, output, name + '-released');
  await strip.locator('[data-current="true"]').focus(); await page.keyboard.press('Home'); await settle(page, strip, 0);
  return { held, released, screenshots: [path.join(output, name + '-held.png'), releasedFrame] };
}

async function openVideoThroughPhoto(page, episode, strip) {
  const index = Number(await strip.getAttribute('data-photo-index'));
  assert.ok(Number.isInteger(index) && index >= 0);
  for (let next = index - 1; next >= 0; next -= 1) {
    await episode.locator('[data-start-strip-prev]').click(); await settle(page, strip, next);
  }
  const photo = strip.locator('a[data-start-photo="0"]');
  await readyImage(page, photo.locator('img'));
  await photo.click();
  const dialog = page.locator('[data-start-lightbox]');
  await page.waitForFunction(dialog => dialog.open, await dialog.elementHandle());
  assert.equal(await dialog.locator('[data-start-photo-full]').getAttribute('alt'), await photo.locator('img').getAttribute('alt'));
  await dialog.locator('[data-start-photo-next]').click();
  await page.waitForFunction(strip => strip.dataset.photoIndex === '1', await strip.elementHandle());
  return dialog;
}

const currentItems = [
  { kind: 'image', file: 'diary-2026-07-06-02-poster.jpg', width: 540, height: 960 },
  { kind: 'video', file: 'diary-2026-07-06-03.mp4', poster: 'diary-2026-07-06-03-poster.jpg', width: 720, height: 1280 },
  { kind: 'image', file: 'diary-2026-07-06-08.jpg', width: 600, height: 800 },
];

async function checkMediaSequences(browser, engine, base, output, { fixture }) {
  const hostname = new URL(base).hostname;
  if (fixture && !/^(?:127(?:\.\d{1,3}){3}|localhost|\[::1\])$/.test(hostname)) {
    return { skipped: 'Mixed-media fixtures are local only; public content remains unchanged.' };
  }
  await mkdir(output, { recursive: true });
  const items = fixture ? fixtureItems(base) : currentItems;
  const label = fixture ? 'mixed-fixture' : 'actual-day5';
  const html = {};
  if (fixture) {
    for (const lang of ['ru', 'en']) {
      const url = new URL(base);
      url.pathname = url.pathname.replace(/\/$/, '') + `/december/${lang === 'en' ? 'en/' : ''}`;
      url.hash = '';
      const response = await fetch(url);
      assert.equal(response.status, 200);
      html[lang] = await response.text();
    }
  }
  const results = [];
  const profiles = [
    { name: 'wide-ru', lang: 'ru', theme: 'dark', width: 1440, height: 900 },
    { name: 'small-en-200', lang: 'en', theme: 'light', width: 320, height: 740, text: true, reduced: true },
  ];
  for (const profile of profiles) {
    const run = fixture ? await fixturePage(browser, base, profile, items, html[profile.lang])
      : await mediaPage(browser, base, profile);
    const { page, errors } = run;
    const screenshots = [];
    let drag;
    try {
      const episode = page.locator('[data-episode="05"]');
      const strip = episode.locator('[data-start-photo-strip]');
      const next = episode.locator('[data-start-strip-next]');
      const previous = episode.locator('[data-start-strip-prev]');
      await settle(page, strip, 0);
      const declared = await strip.locator('[data-start-photo]').evaluateAll(cards => cards.map(card => {
        const media = card.querySelector('img,video');
        return { index: Number(card.dataset.startPhoto), kind: card.dataset.mediaKind,
          tag: media.tagName, src: media.src, poster: media.poster,
          width: Number(media.getAttribute('width')), height: Number(media.getAttribute('height')),
          label: media.alt || media.getAttribute('aria-label') };
      }).sort((a, b) => a.index - b.index));
      assert.equal(declared.length, items.length);
      for (const [index, item] of items.entries()) {
        const actual = declared[index];
        assert.equal(actual.kind, item.kind || 'image');
        assert.equal(actual.tag, item.kind === 'video' ? 'VIDEO' : 'IMG');
        assert.ok(actual.src.endsWith('/' + (item.file || item.src.split('/').pop())));
        assert.equal(actual.width, item.width); assert.equal(actual.height, item.height);
        assert.ok(actual.label, 'Every original has its own accessible description');
        if (item.kind === 'video') assert.ok(actual.poster.endsWith('/' + item.poster.split('/').pop()));
      }
      const caption = episode.locator('[data-stage-media-source]');
      assert.equal(await caption.count(), 1);
      assert.equal(await strip.getAttribute('aria-describedby'), await caption.getAttribute('id'));
      assert.equal(await strip.locator('[data-start-media-open]').count(), 0, 'Inline fullscreen remains the native video control');
      if (!fixture) {
        const expected = profile.lang === 'en' ? 'From the diary, July 6, 2026' : 'Материалы дневника, 6 июля 2026';
        assert.equal((await caption.innerText()).replace(/\s+/g, ' '), expected,
          'The real current series names its diary origin, without a test substitution');
      }
      await assertNoOverflow(page, episode);
      await strip.scrollIntoViewIfNeeded();
      const first = strip.locator('[data-start-photo="0"] img');
      await readyImage(page, first);
      await assertAspect(first, 9, 16);
      assert.deepEqual(await first.evaluate(image => [image.naturalWidth, image.naturalHeight]), [540, 960]);
      screenshots.push(await frame(page, output, `${engine}-${label}-${profile.name}-portrait`));
      if (!fixture && profile.width > 960 && !profile.reduced) {
        drag = await checkHeldDrag(page, strip, output, `${engine}-${label}-${profile.name}-long-drag`);
      }
      const following = strip.locator('[data-start-photo="1"][data-following="true"]');
      if (!fixture && await following.count()) {
        await following.focus(); await page.keyboard.press('Enter');
      } else await next.click();
      await settle(page, strip, 1);
      let video = strip.locator('video');
      await video.scrollIntoViewIfNeeded();
      const originalPlayer = await video.elementHandle();
      const source = await video.evaluate(video => ({ controls: video.controls, inline: video.playsInline,
        autoplay: video.autoplay, preload: video.preload, paused: video.paused, time: video.currentTime }));
      assert.deepEqual(source, { controls: true, inline: true, autoplay: false, preload: 'none', paused: true, time: 0 });
      assert.equal(await strip.locator('[data-start-media-retry]').isHidden(), true, 'Retry is absent from the healthy player');
      await assertAspect(video, 9, 16);
      await assertNoOverflow(page, episode);
      screenshots.push(await frame(page, output, `${engine}-${label}-${profile.name}-video`));
      await nativePlay(page, video, engine);
      assert.deepEqual(await video.evaluate(video => [video.videoWidth, video.videoHeight]), [720, 1280]);
      await video.focus(); await page.keyboard.press('ArrowRight');
      assert.equal(await strip.getAttribute('data-photo-index'), '1', 'Inline native video keys never browse the gallery');
      await seekNative(page, video, 2);
      await next.click(); await settle(page, strip, 2);
      assert.ok(await originalPlayer.evaluate(video => video.paused && video.currentTime >= 2), 'Selecting the next item pauses without rewinding');
      const photo = strip.locator('[data-start-photo="2"] img');
      await readyImage(page, photo);
      await assertAspect(photo, 3, 4);
      assert.deepEqual(await photo.evaluate(image => [image.naturalWidth, image.naturalHeight]), [600, 800]);
      await assertNoOverflow(page, episode);
      await caption.scrollIntoViewIfNeeded();
      screenshots.push(await frame(page, output, `${engine}-${label}-${profile.name}-photo3x4-source`));
      const dialog = await openVideoThroughPhoto(page, episode, strip);
      video = dialog.locator('video');
      assert.equal(await video.evaluate((video, original) => video === original, originalPlayer), true, 'The viewer owns the same native player');
      assert.equal(await page.locator('[data-episode] video').count(), 0, 'The inline player is moved, never cloned');
      assert.equal(await page.locator('[data-start-lightbox] video').count(), 1);
      assert.ok(await video.evaluate(video => video.paused && video.currentTime >= 2));
      screenshots.push(await frame(page, output, `${engine}-${label}-${profile.name}-full`));
      await video.focus(); await page.keyboard.press('ArrowRight');
      assert.equal(await strip.getAttribute('data-photo-index'), '1', 'Native video keys never browse the series');
      await seekNative(page, video, 2);
      await nativePlay(page, video, engine);
      await dialog.locator('[data-start-photo-next]').click();
      assert.equal(await originalPlayer.evaluate(video => video.paused), true);
      assert.equal(await strip.getAttribute('data-photo-index'), '2');
      for (let step = 1; step < items.length; step += 1) {
        await dialog.locator('[data-start-photo-next]').click();
        assert.equal(await strip.getAttribute('data-photo-index'), String((2 + step) % items.length));
      }
      for (let step = 1; step <= items.length; step += 1) {
        await dialog.locator('[data-start-photo-prev]').click();
        assert.equal(await strip.getAttribute('data-photo-index'), String((1 - step + items.length) % items.length));
      }
      assert.equal(await video.evaluate((video, original) => video === original, originalPlayer), true);
      assert.ok(await video.evaluate(video => video.paused && video.currentTime >= 2));
      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('[data-start-lightbox]').open);
      const returnedPlayer = strip.locator('video');
      await page.waitForFunction(player => player === document.activeElement
        && player.getBoundingClientRect().top >= 0 && player.getBoundingClientRect().bottom <= innerHeight,
      await returnedPlayer.elementHandle());
      assert.ok(await next.evaluate(button => {
        const r = button.getBoundingClientRect();
        return button.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }), 'Continuing the series remains reachable after closing the viewer');
      assert.equal(await originalPlayer.evaluate(video => video.closest('[data-start-photo]').dataset.startPhoto), '1');
      assert.ok(await originalPlayer.evaluate(video => video.paused && video.currentTime >= 2));
      screenshots.push(await frame(page, output, `${engine}-${label}-${profile.name}-return`));
      await next.click(); await settle(page, strip, 2);
      if (fixture) {
        await next.click(); await settle(page, strip, 3);
        const landscape = strip.locator('[data-start-photo="3"] img');
        await readyImage(page, landscape);
        await assertAspect(landscape, 16, 9);
        screenshots.push(await frame(page, output, `${engine}-${label}-${profile.name}-landscape`));
      }
      await next.click(); await settle(page, strip, 0);
      await previous.click(); await settle(page, strip, items.length - 1);
      for (let index = items.length - 2; index >= 1; index -= 1) {
        await previous.click(); await settle(page, strip, index);
      }
      video = strip.locator('video'); await nativePlay(page, video, engine);
      const menu = page.locator('.nav-shell');
      await page.locator('.menu-toggle').click();
      await page.waitForFunction(menu => menu.open, await menu.elementHandle());
      await page.waitForFunction(video => video.paused, originalPlayer, { timeout: 1000 });
      assert.equal(await originalPlayer.evaluate(video => video.paused), true, 'Opening navigation pauses its covered player');
      await originalPlayer.evaluate(video => video.play().catch(() => {}));
      assert.equal(await originalPlayer.evaluate(video => video.paused), true, 'A menu-covered player cannot resume');
      await page.locator('.menu-toggle').click();
      await page.waitForFunction(menu => !menu.open, await menu.elementHandle());
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await originalPlayer.evaluate(video => video.paused), true, 'Closing navigation never autoplays');
      video = strip.locator('video'); await nativePlay(page, video, engine);
      if (profile.width < 961) {
        await video.evaluate(video => {
          window.scrollBy({ top: video.getBoundingClientRect().bottom + 2, behavior: 'instant' });
        });
        const remaining = await strip.evaluate(strip => ({
          videoBottom: strip.querySelector('video').getBoundingClientRect().bottom,
          stripBottom: strip.getBoundingClientRect().bottom,
        }));
        assert.ok(remaining.videoBottom < 0,
          'The actual native player has left the viewport');
        await page.waitForFunction(video => video.paused, await video.elementHandle(), { timeout: 1000 });
        await nativePlay(page, video, engine);
      }
      await episode.locator('.episode-pager a[href="#race-day-04"]').click();
      await page.waitForFunction(() => document.querySelector('[data-episode="05"]').hidden);
      assert.equal(await originalPlayer.evaluate(video => video.paused), true, 'Leaving the episode pauses its audio');
      await originalPlayer.evaluate(video => video.play().catch(() => {}));
      assert.equal(await originalPlayer.evaluate(video => video.paused), true, 'A hidden episode cannot resume playback');
      assert.deepEqual(errors, []);
      results.push({ profile: profile.name, passed: true, htmlFixture: fixture, screenshots, ...(drag ? { drag } : {}),
        nativePlay: engine === 'webkit' ? 'native poster control' : 'native keyboard Space' });
    } catch (error) {
      await frame(page, output, `${engine}-${label}-${profile.name}-failure`);
      throw error;
    } finally { await run.context.close(); }
  }

  if (!fixture) {
    results.push(await checkCurrentVideoFailure(browser, engine, base, output));
    await writeFile(path.join(output, `${engine}-current-mixed-media.json`),
      JSON.stringify({ route: 'Actual December HTML and media; no HTML fixture', results }, null, 2));
    return results;
  }

  // Reuse the existing wide profile to exercise a longer queue, not another
  // responsive matrix. All six sources remain unique; only three are shown.
  const six = fixtureItems(base, 6);
  const queue = await fixturePage(browser, base, { ...profiles[0], reduced: true }, six, html.ru);
  try {
    const episode = queue.page.locator('[data-episode="05"]');
    const strip = episode.locator('[data-start-photo-strip]');
    assert.equal(await strip.locator('[data-start-photo]').count(), 6);
    const windows = [];
    for (let step = 0; step <= six.length; step += 1) {
      if (step) await episode.locator('[data-start-strip-next]').click();
      const index = step % six.length;
      await settle(queue.page, strip, index);
      const media = strip.locator(`[data-start-photo="${index}"] img,[data-start-photo="${index}"] video`);
      if (await media.evaluate(element => element.tagName === 'IMG')) await readyImage(queue.page, media);
      assert.equal(await media.evaluate(element => element.src), six[index].src);
      windows.push(await assertThreeVisible(strip, index));
    }
    await strip.locator('[data-current="true"]').focus(); await queue.page.keyboard.press('End'); await settle(queue.page, strip, 5);
    await queue.page.keyboard.press('ArrowRight'); await settle(queue.page, strip, 0);
    assert.deepEqual(queue.errors, []);
    results.push({ profile: 'six-source-neighbours', passed: true, htmlFixture: true, windows,
      screenshots: [await frame(queue.page, output, `${engine}-mixed-six-source-window`)] });
  } finally { await queue.context.close(); }

  // One failure/retry and one no-script fallback cover the new media branch.
  const profile = { name: 'failure', lang: 'en', theme: 'light', width: 390, height: 844, reduced: true };
  const failed = await fixturePage(browser, base, profile, items, html.en, { failVideo: true });
  try {
    const episode = failed.page.locator('[data-episode="05"]');
    const strip = episode.locator('[data-start-photo-strip]');
    await settle(failed.page, strip, 0);
    const dialog = await openVideoThroughPhoto(failed.page, episode, strip);
    const video = dialog.locator('video');
    await video.evaluate(video => { video.preload = 'metadata'; video.load(); });
    await failed.page.waitForFunction(video => Boolean(video.error), await video.elementHandle());
    assert.equal(await dialog.locator('.start-lightbox__feedback').isVisible(), true);
    assert.equal(await dialog.locator('.start-lightbox__feedback a').getAttribute('href'), items[1].src);
    const screenshot = await frame(failed.page, output, `${engine}-mixed-video-error`);
    await failed.page.unroute(items[1].src, failed.videoFailure);
    await dialog.locator('.start-lightbox__feedback button').click();
    await failed.page.waitForFunction(video => video.readyState >= 2 && !video.error, await video.elementHandle());
    assert.equal(await video.evaluate(video => video.paused), true, 'Retry never autoplays');
    assert.deepEqual(failed.errors, []);
    results.push({ profile: 'failure-retry', passed: true, screenshots: [screenshot] });
  } finally { await failed.context.close(); }

  const fallback = await fixturePage(browser, base, profile, items, html.en, { noScript: true });
  try {
    const video = fallback.page.locator('[data-episode="05"] video');
    await video.scrollIntoViewIfNeeded();
    assert.ok(await video.evaluate(video => video.controls && video.playsInline && !video.autoplay));
    const bounds = await video.evaluate(box);
    assert.ok(bounds.width <= profile.width && bounds.height <= profile.height,
      'Without scripts the native player and controls fit the viewport');
    assert.equal(await fallback.page.locator('[data-episode="05"] [data-start-media-file]').getAttribute('href'), items[1].src);
    const screenshot = await frame(fallback.page, output, `${engine}-mixed-no-script`);
    results.push({ profile: 'no-script', passed: true, screenshots: [screenshot] });
  } finally { await fallback.context.close(); }
  await writeFile(path.join(output, `${engine}-mixed-media.json`), JSON.stringify({ fixture: 'Local July originals; production content unchanged', results }, null, 2));
  return results;
}

export async function checkCurrentVideoFailure(browser, engine, base, output) {
  const run = await mediaPage(browser, base,
    { lang: 'en', theme: 'light', width: 320, height: 740, text: true, reduced: true });
  const { page, errors } = run;
  const failure = route => route.abort('failed');
  const held = new Set();
  try {
    const episode = page.locator('[data-episode="05"]');
    const strip = episode.locator('[data-start-photo-strip]');
    await settle(page, strip, 0);
    const video = strip.locator('video');
    const original = await video.elementHandle();
    const source = await video.evaluate(video => video.src);
    await page.route(source, failure);
    await episode.locator('[data-start-strip-next]').click(); await settle(page, strip, 1);
    await video.evaluate(video => { video.preload = 'metadata'; video.load(); });
    await page.waitForFunction(video => Boolean(video.error), original, { timeout: 8000 });
    const card = strip.locator('[data-start-photo="1"]');
    const error = card.locator('.start-media__error');
    const file = card.locator('[data-start-media-file]');
    await error.waitFor({ state: 'visible' }); await file.waitFor({ state: 'visible' });
    assert.equal(await file.evaluate(link => link.href), source);
    await episode.locator('[data-start-strip-next]').click(); await settle(page, strip, 2);
    await episode.locator('[data-start-strip-prev]').click(); await settle(page, strip, 1);
    assert.equal(await video.evaluate((video, original) => video === original && Boolean(video.error), original), true,
      'Returning to the failed video keeps the same player and its real error');
    await error.waitFor({ state: 'visible' }); await file.waitFor({ state: 'visible' });
    await card.locator('[data-start-media-retry]').waitFor({ state: 'visible' });
    await card.evaluate(card => {
      const rect = card.querySelector('.start-media__actions').getBoundingClientRect();
      window.scrollBy({ top: rect.top - Math.max(80, (innerHeight - rect.height) / 2), behavior: 'instant' });
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const geometry = await card.evaluate(card => {
      const rect = element => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
      const inspect = element => {
        const r = rect(element), clip = { left: -1e9, right: 1e9, top: -1e9, bottom: 1e9 };
        for (let a = element.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
          const style = getComputedStyle(a), ar = rect(a);
          if (/^(hidden|clip|auto|scroll)$/.test(style.overflowX)) { clip.left = Math.max(clip.left, ar.left + a.clientLeft); clip.right = Math.min(clip.right, ar.left + a.clientLeft + a.clientWidth); }
          if (/^(hidden|clip|auto|scroll)$/.test(style.overflowY)) { clip.top = Math.max(clip.top, ar.top + a.clientTop); clip.bottom = Math.min(clip.bottom, ar.top + a.clientTop + a.clientHeight); }
        }
        const hit = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
        return { rect: r, clip, clipped: r.left < clip.left - 1 || r.right > clip.right + 1 || r.top < clip.top - 1 || r.bottom > clip.bottom + 1, hit: element === hit || element.contains(hit) };
      };
      const actions = rect(card.querySelector('.start-media__actions'));
      const status = card.querySelector('.start-media__error');
      const caption = rect(card.closest('.stage-photos').querySelector('[data-stage-media-source]'));
      const overlap = r => Math.max(0, Math.min(r.right, caption.right) - Math.max(r.left, caption.left)) * Math.max(0, Math.min(r.bottom, caption.bottom) - Math.max(r.top, caption.top));
      return { error: inspect(status), file: inspect(card.querySelector('[data-start-media-file]')),
        retry: inspect(card.querySelector('[data-start-media-retry]')), caption,
        captionOverlap: overlap(actions) + overlap(rect(status)) };
    });
    await mkdir(output, { recursive: true });
    await writeFile(path.join(output, `${engine}-actual-video-error-layout.json`), JSON.stringify(geometry, null, 2));
    const screenshot = await frame(page, output, `${engine}-actual-video-error-320200`);
    assert.ok(!geometry.error.clipped && !geometry.file.clipped && !geometry.retry.clipped,
      'The actual three-item component exposes its error and actions without internal clipping');
    assert.ok(geometry.file.hit && geometry.retry.hit, 'The actual fallback and retry actions remain reachable');
    assert.equal(geometry.captionOverlap, 0, 'Error/actions never paint over the diary provenance');
    const retry = card.locator('[data-start-media-retry]');
    let receive;
    const request = new Promise(resolve => { receive = resolve; });
    const retryRequests = [];
    let abortSubsequent = false;
    const hold = async route => {
      retryRequests.push({ range: route.request().headers().range || null });
      if (abortSubsequent) { await route.abort('failed'); return; }
      held.add(route); receive();
    };
    await page.unroute(source, failure); await page.route(source, hold);
    await retry.focus(); await page.keyboard.press('Enter');
    let timeout;
    try {
      await Promise.race([request, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Inline Retry did not request the video')), 8000); })]);
    } finally { clearTimeout(timeout); }
    assert.equal(await retry.isDisabled(), true);
    assert.equal(await original.evaluate(video => video === document.activeElement && video.paused && video.getAttribute('aria-busy') === 'true'), true);
    assert.equal(await error.innerText(), 'Loading the video…');
    assert.equal(await strip.getAttribute('data-photo-index'), '1');
    const heldCount = held.size;
    abortSubsequent = true;
    await Promise.all([...held].map(route => route.abort('failed'))); held.clear();
    await writeFile(path.join(output, `${engine}-actual-video-retry-transport.json`), JSON.stringify({ heldCount, retryRequests }, null, 2));
    await page.waitForFunction(video => Boolean(video.error), original, { timeout: 8000 });
    await writeFile(path.join(output, `${engine}-actual-video-retry-transport.json`), JSON.stringify({ heldCount, retryRequests }, null, 2));
    assert.equal(await retry.isEnabled(), true, 'A real retry failure permits another attempt');
    await page.unroute(source, hold);
    await retry.focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(video => video.readyState >= 2 && !video.error && !video.seeking, original, { timeout: 8000 });
    assert.equal(await original.evaluate(video => video.paused), true);
    assert.equal(await retry.isHidden(), true);
    assert.equal(await error.isHidden(), true);
    assert.equal(await strip.getAttribute('data-photo-index'), '1');
    const dialog = await openVideoThroughPhoto(page, episode, strip);
    const full = dialog.locator('video');
    assert.equal(await full.evaluate((video, original) => video === original, original), true);
    assert.equal(await full.evaluate(video => video.paused), true, 'The real current player retries without autoplay');
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, []);
    return { profile: 'actual-video-failure-320200', passed: true, htmlFixture: false, screenshots: [screenshot] };
  } finally {
    await Promise.allSettled([...held].map(route => route.abort()));
    await run.context.close();
  }
}

export async function checkCurrentMixedMedia(browser, engine, base, output) {
  return checkMediaSequences(browser, engine, base, output, { fixture: false });
}

export async function checkMixedMedia(browser, engine, base, output) {
  return checkMediaSequences(browser, engine, base, output, { fixture: true });
}
