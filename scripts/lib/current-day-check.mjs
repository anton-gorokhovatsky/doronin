import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const sectionSelector = '[data-current-day]';
const profiles = [
  { name: '1512-ru', width: 1512, height: 982, lang: 'ru', theme: 'light' },
  { name: '1366-ru-reduced', width: 1366, height: 768, lang: 'ru', theme: 'light', reduced: true },
  { name: '390-en-dark', width: 390, height: 844, lang: 'en', theme: 'dark' },
  { name: '320-en-dark-text32', width: 320, height: 740, lang: 'en', theme: 'dark', text32: true, reduced: true },
];

function routeUrl(base, route, profile = {}) {
  const url = new URL(base);
  url.pathname = url.pathname.replace(/\/$/, '') + route;
  url.hash = '';
  url.searchParams.set('codexQa', '1');
  if (profile.theme) url.searchParams.set('theme', profile.theme);
  return url.href;
}

function currentParts(page) {
  const section = page.locator(sectionSelector);
  return {
    section,
    canvas: section.locator('.lab-canvas'),
    count: section.locator('.lab-count'),
    next: section.locator('[data-lab-next]'),
    previous: section.locator('[data-lab-prev]'),
    video: section.locator('video'),
  };
}

async function settled(page, section, index) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForFunction(({ section, index }) =>
    section.dataset.selected === String(index + 1) &&
    section.querySelector('[data-slot="0"]')?.dataset.labIndex === String(index) &&
    [...section.querySelectorAll('.lab-frame')].every(frame =>
      frame.getAnimations({ subtree: true }).every(animation => animation.playState !== 'running')),
  { section: await section.elementHandle(), index });
  assert.deepEqual((await section.locator('.lab-count').textContent()).match(/\d+/g).map(Number), [index + 1, 3]);
}

async function frame(page, output, name) {
  const file = path.join(output, `${name}.png`);
  await page.screenshot({ path: file });
  return file;
}

async function assertScene(page, section) {
  const scene = await section.evaluate(section => {
    const rectangle = element => {
      const r = element.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const canvas = rectangle(section.querySelector('.lab-canvas'));
    const frames = [...section.querySelectorAll('.lab-frame')].map(frame => {
      const media = frame.querySelector('img,video');
      const nativeWidth = media.naturalWidth || media.videoWidth || Number(media.getAttribute('width'));
      const nativeHeight = media.naturalHeight || media.videoHeight || Number(media.getAttribute('height'));
      return {
        ...rectangle(frame), slot: Number(frame.dataset.slot), index: Number(frame.dataset.labIndex),
        source: media.currentSrc || media.src || media.querySelector('source')?.src,
        nativeWidth, nativeHeight, hidden: frame.hidden, inert: frame.querySelector('.lab-photo,video').inert,
        controls: media.tagName === 'VIDEO' ? media.controls : null,
      };
    });
    const regions = [...frames.map(item => ({ name: `frame-${item.index}`, ...item })),
      ...['.lab-controls', '.lab-current', '.lab-story'].map(selector => ({
        name: selector, ...rectangle(section.querySelector(selector)),
      }))];
    const overlaps = [];
    for (let i = 0; i < regions.length; i++) for (let j = i + 1; j < regions.length; j++) {
      const a = regions[i], b = regions[j];
      if (Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 &&
          Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1) overlaps.push([a.name, b.name]);
    }
    const actions = [...section.querySelectorAll('.lab-arrows button,.lab-select:not([hidden])')]
      .map(element => ({ label: element.getAttribute('aria-label'), ...rectangle(element) }));
    return { canvas, frames, overlaps, actions, overflow: document.documentElement.scrollWidth > innerWidth };
  });
  assert.equal(scene.frames.length, 3, 'The real current day has three frames, with no thumbnail clones');
  assert.equal(new Set(scene.frames.map(item => item.source)).size, 3, 'Each source occurs once');
  assert.deepEqual(scene.frames.map(item => item.slot).sort(), [0, 1, 2]);
  for (const item of scene.frames) {
    assert.ok(!item.hidden && item.width > 0 && item.height > 0, 'All three complete materials remain visible');
    assert.ok(Math.abs(item.width / item.height - item.nativeWidth / item.nativeHeight) < .01,
      `Material ${item.index} retains its actual native ratio`);
    assert.ok(item.x >= scene.canvas.x - 1 && item.right <= scene.canvas.right + 1 &&
      item.y >= scene.canvas.y - 1 && item.bottom <= scene.canvas.bottom + 1, 'The full frame fits the media plane');
    assert.equal(item.inert, item.slot !== 0, 'Only the selected native media receives input');
    if (item.controls !== null) assert.equal(item.controls, item.slot === 0, 'Native controls belong to the selected video');
  }
  assert.deepEqual(scene.overlaps, [], 'Media, current facts, controls and memoir do not overlap');
  assert.equal(scene.overflow, false, 'The selected scene does not cause horizontal page overflow');
  for (const action of scene.actions) {
    assert.ok(action.width >= 44 - 1 && action.height >= 44 - 1,
      `${action.label} keeps a usable touch target`);
  }
  return scene;
}

async function activateWithoutScroll(page, parts, button, index) {
  await button.scrollIntoViewIfNeeded();
  await button.evaluate(element => element.focus({ preventScroll: true }));
  const snapshot = () => button.evaluate(element => ({
    scroll: scrollY, buttonY: element.getBoundingClientRect().y,
    controlsHeight: element.closest('.lab-controls').getBoundingClientRect().height,
  }));
  const before = await snapshot();
  await page.keyboard.press('Enter');
  await settled(page, parts.section, index);
  const after = await snapshot();
  assert.ok(Math.abs(after.scroll - before.scroll) <= 2,
    `Changing the selected material never scrolls the document (${before.scroll} → ${after.scroll})`);
  assert.ok(Math.abs(after.controlsHeight - before.controlsHeight) <= 1, 'Changing format keeps the command panel height');
  assert.ok(Math.abs(after.buttonY - before.buttonY) <= 2, 'The focused media button stays on its baseline');
  assert.equal(await button.evaluate(element => element === document.activeElement), true,
    'The media command keeps its keyboard focus');
  return { selected: index + 1, before, after };
}

async function playNative(page, video, engine) {
  await video.scrollIntoViewIfNeeded();
  if (engine === 'webkit') await video.click();
  else { await video.focus(); await page.keyboard.press('Space'); }
  await page.waitForFunction(video => !video.paused && video.currentTime > .15,
    await video.elementHandle(), { timeout: 10000 });
}

async function openPage(browser, base, profile) {
  const context = await browser.newContext({
    viewport: { width: profile.width, height: profile.height },
    isMobile: profile.width < 721, hasTouch: profile.width < 721,
    reducedMotion: profile.reduced ? 'reduce' : 'no-preference',
  });
  await context.addInitScript(theme => { localStorage.setItem('theme', theme); }, profile.theme);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(routeUrl(base, `/december/${profile.lang === 'en' ? 'en/' : ''}`, profile));
  const parts = currentParts(page);
  await parts.section.locator('[data-slot="0"]').waitFor();
  await page.evaluate(() => document.fonts.ready);
  if (profile.text32) {
    await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; dispatchEvent(new Event('resize')); });
    await page.waitForFunction(() => getComputedStyle(document.documentElement).fontSize === '32px');
  }
  await settled(page, parts.section, 0);
  return { context, page, parts, errors };
}

export async function hasCurrentDay(browser, base) {
  const page = await browser.newPage();
  try {
    await page.goto(routeUrl(base, '/december/'), { waitUntil: 'domcontentloaded' });
    return await page.locator(sectionSelector).count() === 1;
  } finally { await page.close(); }
}

async function assertFullStory(section, lang) {
  const stories = JSON.parse(await readFile(new URL('../../prototypes/five-days/stories.json', import.meta.url), 'utf8'));
  const original = stories.find(story => story.day === 5)[lang].paragraphs;
  const paragraphs = section.locator('.lab-story__body > p');
  const normalize = text => text.replace(/\s+/g, ' ').trim();
  assert.deepEqual((await paragraphs.allTextContents()).map(normalize), original.map(normalize));
  for (const paragraph of await paragraphs.all()) assert.equal(await paragraph.isVisible(), true, 'Every original paragraph is visible without disclosure');
  assert.equal(await section.locator('.lab-story details').count(), 0, 'The biography is not collapsed');
}

async function checkProfile(browser, engine, base, output, profile, expected) {
  const { context, page, parts, errors } = await openPage(browser, base, profile);
  const name = `${engine}-current-day-${profile.name}`;
  try {
    assert.ok(await page.evaluate(() => scrollY <= 2), 'A December URL without a hash opens at the hero');
    assert.equal(await page.locator('html').getAttribute('lang'), profile.lang);
    assert.equal(await page.locator('html').evaluate(element => element.classList.contains('theme-dark')), profile.theme === 'dark');
    const forbidden = await page.locator('a[href],script[src],link[href],img[src],source[src]').evaluateAll(elements =>
      elements.map(element => element.href || element.src).filter(Boolean)
        .filter(value => /\/(?:lab|view|variants|baseline|prototypes)\//.test(new URL(value).pathname)));
    assert.deepEqual(forbidden, [], 'The promoted page contains no comparison-harness URLs');
    const progress = await parts.section.locator('progress').evaluate(element => ({ value: element.value, max: element.max }));
    assert.deepEqual(progress, { value: expected.completed, max: expected.total });
    assert.deepEqual(await page.locator('#calendar-past progress').evaluate(element => ({ value: element.value, max: element.max })), progress,
      'The visible calendar summary and current day show the same completed progress');
    const numbers = selector => parts.section.locator(selector).innerText().then(text => text.match(/\d+/g)?.join(''));
    assert.equal(await numbers('.lab-current__target'), String(expected.today));
    assert.ok((await parts.section.locator('.lab-current__next').innerText()).includes(String(expected.next)), 'The next special stage is shown');
    await page.locator('.hero__actions a[href$="#race-day-05"]').click();
    await parts.section.waitFor({ state: 'visible' });
    assert.equal(new URL(page.url()).hash, '#race-day-05');
    assert.ok(new URL(page.url()).pathname.endsWith(`/december/${profile.lang === 'en' ? 'en/' : ''}`));
    await parts.canvas.locator('.lab-frame img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    const originalFrames = await parts.section.locator('.lab-frame').elementHandles();
    await assertFullStory(parts.section, profile.lang);
    const firstScene = await assertScene(page, parts.section);
    await frame(page, output, `${name}-entry`);

    const photo = parts.section.locator('[data-slot="0"] .lab-photo');
    await photo.click();
    const dialog = parts.section.locator('.lab-viewer');
    assert.equal(await dialog.evaluate(element => element.open), true);
    await dialog.locator('img').evaluate(image => image.decode());
    assert.equal(await dialog.locator('img').evaluate(image => image.src), await photo.evaluate(link => link.href));
    await page.keyboard.press('Escape');
    assert.equal(await dialog.evaluate(element => element.open), false);
    assert.equal(await photo.evaluate(element => element === document.activeElement), true, 'Full-view return restores photo focus');

    await parts.section.locator('[data-kind="video"] .lab-select').click();
    await settled(page, parts.section, 1);
    assert.ok(await parts.video.evaluate(video => video.controls && video.playsInline && !video.autoplay && !!video.poster));
    assert.equal(await parts.video.evaluate(video => video.paused), true, 'Selecting video does not autoplay');
    await playNative(page, parts.video, engine);
    await assertScene(page, parts.section);
    const transitions = [await activateWithoutScroll(page, parts, parts.next, 2)];
    assert.equal(await parts.video.evaluate(video => video.paused), true, 'Leaving a playing video pauses it');
    await assertScene(page, parts.section);
    await frame(page, output, `${name}-native-3x4`);
    transitions.push(await activateWithoutScroll(page, parts, parts.next, 0));
    transitions.push(await activateWithoutScroll(page, parts, parts.previous, 2));
    transitions.push(await activateWithoutScroll(page, parts, parts.previous, 1));
    if (profile.reduced) assert.equal(await parts.section.locator('.lab-frame').evaluateAll(frames =>
      frames.flatMap(frame => frame.getAnimations({ subtree: true })).filter(animation => animation.playState === 'running').length), 0);

    await playNative(page, parts.video, engine);
    await assertFullStory(parts.section, profile.lang);
    await parts.section.locator('.lab-previous').click();
    await page.locator('[data-episode="04"]').waitFor({ state: 'visible' });
    assert.equal(await parts.video.evaluate(video => video.paused), true, 'Opening an archived story pauses the current video');
    await page.goBack();
    await parts.section.waitFor({ state: 'visible' });
    await settled(page, parts.section, 1);
    await parts.section.locator('.lab-previous').click();
    const archive = page.locator('[data-episode="04"]');
    await archive.waitFor({ state: 'visible' });
    await archive.locator('a[href$="#race-day-05"]').click();
    await parts.section.waitFor({ state: 'visible' });
    await settled(page, parts.section, 1);
    assert.equal(await parts.video.evaluate(video => video.paused), true, 'Returning to the current day preserves selection without autoplay');

    if (profile.name === '390-en-dark') {
      // The calendar reaches the same complete story without a reload.
      const beforeCalendar = await parts.section.elementHandle();
      await page.locator('.december-row--today [data-stage-calendar-link]').click();
      await assertFullStory(parts.section, profile.lang);
      assert.equal(new URL(page.url()).hash, '#life-story-05');
      assert.equal(await beforeCalendar.evaluate(element => element.isConnected), true, 'The calendar opens the full memoir without reloading the page');
      await settled(page, parts.section, 1);
    }

    if (profile.name === '1512-ru') {
      await page.setViewportSize({ width: 1366, height: 768 });
      await page.waitForFunction(() => innerWidth === 1366);
      await settled(page, parts.section, 1);
      await assertScene(page, parts.section);
      await page.setViewportSize({ width: profile.width, height: profile.height });
    }
    assert.equal(await page.evaluate(frames => frames.every(frame => frame.isConnected &&
      document.querySelector('[data-current-day] .lab-canvas').contains(frame)), originalFrames), true,
    'Loop, archive and resize keep the original frame nodes');
    assert.equal(await parts.section.locator('.lab-frame').count(), 3);
    await parts.section.locator('.lab-controls').scrollIntoViewIfNeeded();
    await assertScene(page, parts.section);
    await assertFullStory(parts.section, profile.lang);
    await frame(page, output, `${name}-returned`);
    assert.deepEqual(errors, []);
    const evidence = `${name}-geometry.json`;
    await writeFile(path.join(output, evidence), JSON.stringify({ firstScene, transitions }, null, 2));
    return { engine, kind: 'selected-current-day', profile: profile.name, passed: true, evidence, transitions };
  } catch (error) {
    await frame(page, output, `${name}-failure`).catch(() => {});
    error.message = `${engine}/${profile.name}: ${error.message}`;
    throw error;
  } finally { await context.close(); }
}

async function checkRetry(browser, base, output) {
  const profile = { ...profiles[2], reduced: true };
  const { context, page, parts, errors } = await openPage(browser, base, profile);
  try {
    const image = parts.section.locator('[data-lab-index="0"] img');
    const source = await image.evaluate(image => image.currentSrc || image.src);
    let blocked = true;
    let failures = 0;
    await page.route(source, route => { if (blocked) { failures++; return route.abort('failed'); } return route.continue(); });
    await page.reload();
    const error = parts.section.locator('[data-lab-index="0"] .lab-error');
    await error.waitFor({ state: 'visible' });
    assert.ok(failures > 0, 'The real current photo request actually failed');
    const retry = error.locator('[data-retry]');
    assert.equal(await retry.isEnabled(), true);
    blocked = false;
    const response = page.waitForResponse(response => response.url() === source && response.ok());
    await retry.click();
    await response;
    await error.waitFor({ state: 'hidden' });
    await image.evaluate(image => image.decode());
    assert.ok(await image.evaluate(image => image.complete && image.naturalWidth > 0));
    await settled(page, parts.section, 0);
    await assertScene(page, parts.section);
    assert.deepEqual(errors, []);
    await frame(page, output, 'chromium-current-day-real-photo-retry');
    return { engine: 'chromium', kind: 'selected-current-day/photo-retry', passed: true, source };
  } finally { await context.close(); }
}

export async function checkCurrentDay(browser, engine, base, output, { failuresOnly = false } = {}) {
  if (failuresOnly) return [await checkRetry(browser, base, output)];
  const plan = JSON.parse(await readFile(new URL('../../src/project-plan.json', import.meta.url), 'utf8'));
  const date = '2026-12-05';
  const completed = plan.segments.reduce((total, segment) => {
    if (segment.endDate < date) return total + segment.totalDistanceKm;
    if (segment.startDate < date && segment.dailyDistanceKm)
      return total + (Number(date.slice(-2)) - Number(segment.startDate.slice(-2))) * segment.dailyDistanceKm;
    return total;
  }, 0);
  const today = plan.segments.find(segment => segment.startDate <= date && segment.endDate >= date);
  const next = plan.segments.find(segment => segment.startDate > date && segment.kind === 'special');
  const expected = { completed, total: plan.targetDistanceKm, today: today.dailyDistanceKm || today.totalDistanceKm, next: next.totalDistanceKm };
  const results = [];
  if (engine === 'chromium') {
    const page = await browser.newPage();
    try {
      for (const route of ['/', '/en/']) {
        await page.goto(routeUrl(base, route));
        assert.equal(await page.locator(sectionSelector).count(), 0, 'The pre-start homepage does not receive the December module');
        assert.equal(await page.locator('[data-five-days]').count(), 0);
      }
    } finally { await page.close(); }
  }
  const selectedProfiles = engine === 'webkit' ? [{ ...profiles[2], reduced: true }] : profiles;
  for (const profile of selectedProfiles) {
    console.log(`[december-gallery] ${engine} selected current day / ${profile.name}`);
    results.push(await checkProfile(browser, engine, base, output, profile, expected));
  }
  if (engine === 'chromium') results.push(await checkRetry(browser, base, output));
  return results;
}
