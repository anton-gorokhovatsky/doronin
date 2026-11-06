import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { renderStageMedia } from '../../prototypes/five-days/build.mjs';

// These July originals exercise the renderer locally. No fixture is written to
// a published page, and their labels never call them December reportage.
function fixtureItems(base) {
  const resource = file => new URL(base.replace(/\/$/, '') + file).href;
  return [
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
}

function fixtureHtml(html, items, lang) {
  const episode = html.indexOf('id="race-day-05"');
  const from = html.indexOf(' data-start-photo-strip>', episode) + ' data-start-photo-strip>'.length;
  const to = html.indexOf('</div>', from);
  assert.ok(episode >= 0 && from > episode && to > from, 'The built current episode has a source media strip');
  return (html.slice(0, from) + renderStageMedia(items, lang) + html.slice(to))
    .replace('<title>', '<title>LOCAL MIXED-MEDIA QA — ')
    .replace(/(<section\b[^>]*\bid="race-day-05"[^>]*>[\s\S]*?<p class="stage-context">)[\s\S]*?<\/p>/,
      `$1${lang === 'en' ? 'Local QA · July 2026' : 'Тест · июль 2026'}</p>`)
    .replace(/(<span data-start-strip-count aria-live="polite">)1 \/ 3/, '$11 / 4');
}

async function fixturePage(browser, base, profile, items, html, { noScript = false, failVideo = false } = {}) {
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    hasTouch: profile.width < 961, isMobile: profile.width < 961,
    reducedMotion: profile.reduced ? 'reduce' : 'no-preference', javaScriptEnabled: !noScript,
  });
  // Weather is outside this check; do not make one API request per profile.
  await context.route('https://api.met.no/**', route => route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const url = new URL(base.replace(/\/$/, '') + `/december/${profile.lang === 'en' ? 'en/' : ''}`);
  url.search = new URLSearchParams({ codexQa: '1', service: 'check', theme: profile.theme,
    mixedMediaFixture: '1', ...(profile.text ? { text: '200' } : {}) }).toString();
  const documentUrl = url.href;
  await page.route(candidate => candidate.href === documentUrl, route => route.fulfill({ contentType: 'text/html', body: fixtureHtml(html, items, profile.lang) }));
  const videoFailure = route => route.abort('failed');
  if (failVideo) await page.route(items[1].src, videoFailure);
  url.hash = 'race-day-05';
  await page.goto(url.href);
  await page.evaluate(() => document.fonts.ready);
  return { context, page, errors, videoFailure };
}

const box = element => {
  const rect = element.getBoundingClientRect();
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom };
};

async function settle(page, strip, index) {
  await page.waitForFunction(({ element, index }) => element.dataset.photoIndex === String(index)
    && element.dataset.turning !== 'true', { element: await strip.elementHandle(), index });
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

export async function checkMixedMedia(browser, engine, base, output) {
  const hostname = new URL(base).hostname;
  if (!/^(?:127(?:\.\d{1,3}){3}|localhost|\[::1\])$/.test(hostname)) {
    return { skipped: 'Mixed-media fixtures are local only; public content remains unchanged.' };
  }
  await mkdir(output, { recursive: true });
  const items = fixtureItems(base);
  const html = {};
  for (const lang of ['ru', 'en']) {
    const response = await fetch(base.replace(/\/$/, '') + `/december/${lang === 'en' ? 'en/' : ''}`);
    assert.equal(response.status, 200);
    html[lang] = await response.text();
  }
  const results = [];
  const profiles = [
    { name: 'wide-ru', lang: 'ru', theme: 'dark', width: 1440, height: 900 },
    { name: 'small-en-200', lang: 'en', theme: 'light', width: 320, height: 740, text: true, reduced: true },
  ];
  for (const profile of profiles) {
    const run = await fixturePage(browser, base, profile, items, html[profile.lang]);
    const { page, errors } = run;
    const screenshots = [];
    try {
      const episode = page.locator('[data-episode="05"]');
      const strip = episode.locator('[data-start-photo-strip]');
      const next = episode.locator('[data-start-strip-next]');
      const previous = episode.locator('[data-start-strip-prev]');
      await settle(page, strip, 0);
      await strip.scrollIntoViewIfNeeded();
      const first = strip.locator('[data-start-photo="0"] img');
      await readyImage(page, first);
      await assertAspect(first, 9, 16);
      screenshots.push(await frame(page, output, `${engine}-mixed-${profile.name}-portrait`));
      await next.click(); await settle(page, strip, 1);
      let video = strip.locator('video');
      await video.scrollIntoViewIfNeeded();
      await page.evaluate(() => { window.mixedQaVideo = document.querySelector('[data-episode="05"] video'); });
      const source = await video.evaluate(video => ({ controls: video.controls, inline: video.playsInline,
        autoplay: video.autoplay, preload: video.preload, paused: video.paused, time: video.currentTime }));
      assert.deepEqual(source, { controls: true, inline: true, autoplay: false, preload: 'none', paused: true, time: 0 });
      await assertAspect(video, 9, 16);
      screenshots.push(await frame(page, output, `${engine}-mixed-${profile.name}-video`));
      await nativePlay(page, video, engine);
      await video.evaluate(video => { video.currentTime = 2; });
      await page.waitForFunction(video => video.currentTime >= 2, await video.elementHandle());
      await next.click(); await settle(page, strip, 2);
      assert.ok(await page.evaluate(() => mixedQaVideo.paused && mixedQaVideo.currentTime >= 2), 'Selecting the next item pauses without rewinding');
      const photo = strip.locator('[data-start-photo="2"] img');
      await readyImage(page, photo);
      await assertAspect(photo, 3, 4);
      screenshots.push(await frame(page, output, `${engine}-mixed-${profile.name}-photo3x4`));
      await previous.click(); await settle(page, strip, 1);
      await strip.locator('[data-start-media-open]').click();
      const dialog = page.locator('[data-start-lightbox]');
      await page.waitForFunction(() => document.querySelector('[data-start-lightbox]').open);
      video = dialog.locator('video');
      assert.equal(await video.evaluate(video => video === mixedQaVideo), true, 'The viewer owns the same native player');
      assert.equal(await page.locator('[data-episode] video').count(), 0, 'The inline player is moved, never cloned');
      assert.ok(await video.evaluate(video => video.paused && video.currentTime >= 2));
      screenshots.push(await frame(page, output, `${engine}-mixed-${profile.name}-full`));
      await video.focus(); await page.keyboard.press('ArrowRight');
      assert.equal(await strip.getAttribute('data-photo-index'), '1', 'Native video keys never browse the series');
      await video.evaluate(video => { video.currentTime = 2; });
      await nativePlay(page, video, engine);
      await dialog.locator('[data-start-photo-next]').click();
      assert.equal(await page.evaluate(() => mixedQaVideo.paused), true);
      assert.equal(await strip.getAttribute('data-photo-index'), '2');
      await dialog.locator('[data-start-photo-prev]').click();
      assert.ok(await video.evaluate(video => video === mixedQaVideo && video.paused && video.currentTime >= 2));
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
      assert.equal(await page.evaluate(() => mixedQaVideo.closest('[data-start-photo]').dataset.startPhoto), '1');
      assert.ok(await page.evaluate(() => mixedQaVideo.paused && mixedQaVideo.currentTime >= 2));
      screenshots.push(await frame(page, output, `${engine}-mixed-${profile.name}-return`));
      await next.click(); await settle(page, strip, 2); await next.click(); await settle(page, strip, 3);
      const landscape = strip.locator('[data-start-photo="3"] img');
      await readyImage(page, landscape);
      await assertAspect(landscape, 16, 9);
      screenshots.push(await frame(page, output, `${engine}-mixed-${profile.name}-landscape`));
      await next.click(); await settle(page, strip, 0); await previous.click(); await settle(page, strip, 3);
      await previous.click(); await settle(page, strip, 2); await previous.click(); await settle(page, strip, 1);
      video = strip.locator('video'); await nativePlay(page, video, engine);
      if (profile.width < 961) {
        await video.evaluate(video => {
          window.scrollBy({ top: video.getBoundingClientRect().bottom + 2, behavior: 'instant' });
        });
        const remaining = await strip.evaluate(strip => ({
          videoBottom: strip.querySelector('video').getBoundingClientRect().bottom,
          stripBottom: strip.getBoundingClientRect().bottom,
        }));
        assert.ok(remaining.videoBottom < 0 && remaining.stripBottom > 0,
          'The video itself has left while its actions/window still intersect');
        await page.waitForFunction(video => video.paused, await video.elementHandle());
        await nativePlay(page, video, engine);
      }
      await page.evaluate(() => { location.hash = '#race-day-04'; });
      await page.waitForFunction(() => document.querySelector('[data-episode="05"]').hidden);
      assert.equal(await page.evaluate(() => mixedQaVideo.paused), true, 'Leaving the episode pauses its audio');
      await page.evaluate(() => mixedQaVideo.play().catch(() => {}));
      assert.equal(await page.evaluate(() => mixedQaVideo.paused), true, 'A hidden episode cannot resume playback');
      assert.deepEqual(errors, []);
      results.push({ profile: profile.name, passed: true, screenshots, nativePlay: engine === 'webkit' ? 'native poster control' : 'native keyboard Space' });
    } catch (error) {
      await frame(page, output, `${engine}-mixed-${profile.name}-failure`);
      throw error;
    } finally { await run.context.close(); }
  }

  // One failure/retry and one no-script fallback cover the new media branch.
  const profile = { name: 'failure', lang: 'en', theme: 'light', width: 390, height: 844, reduced: true };
  const failed = await fixturePage(browser, base, profile, items, html.en, { failVideo: true });
  try {
    const episode = failed.page.locator('[data-episode="05"]');
    await episode.locator('[data-start-strip-next]').click();
    await episode.locator('[data-start-media-open]').click();
    const dialog = failed.page.locator('[data-start-lightbox]');
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
