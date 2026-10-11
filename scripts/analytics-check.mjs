import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startSiteServer } from './lib/site-server.mjs';

const server = await startSiteServer(process.argv[2] || 'site');
const browser = await chromium.launch();
const publicOrigin = 'https://audience.test';
const requests = [];
async function visit(path = '/', { automated = false, local = false, off = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  await page.addInitScript(({ automated, off }) => {
    if (!automated) Object.defineProperty(navigator, 'webdriver', { get: () => false });
    if (off) localStorage.setItem('analytics', 'off');
    window.__analyticsCalls = [];
    window.ym = (...args) => window.__analyticsCalls.push(args);
  }, { automated, off });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'mc.yandex.ru') {
      requests.push(url.href);
      return route.abort();
    }
    if (/\.(?:mp4|webm|m4a)$/.test(url.pathname)) return route.abort();
    if (url.origin === publicOrigin) {
      const response = await route.fetch({ url: server.origin + url.pathname + url.search });
      return route.fulfill({ response });
    }
    return url.origin === server.origin ? route.continue() : route.abort();
  });
  await page.goto((local ? server.origin : publicOrigin) + path, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  return { page, context };
}
async function choose(page, preference) {
  if (!await page.locator('.nav-shell').evaluate(el => el.open)) await page.locator('.menu-toggle').click();
  // The current UI has no analytics buttons; exercise its existing preference
  // handler and persisted choice without adding controls to the public page.
  await page.evaluate(preference => window.applyAnalyticsPreference(preference), preference);
  assert.equal(await page.evaluate(() => localStorage.getItem('analytics')), preference === 'off' ? 'off' : null);
}
const calls = page => page.evaluate(() => window.__analyticsCalls);
try {
  for (const [name, path, options] of [
    ['automated public visit', '/', { automated: true }],
    ['local development', '/', { local: true }],
    ['explicit service visit', '/?service=check', {}],
    ...['phase=before', 'calendar=confirmed', 'text=200', 'theme=dark', 'film=check', 'browser-regression=ru']
      .map(query => ['fixture ' + query, '/?' + query, {}]),
  ]) {
    const requestCount = requests.length;
    const { page, context } = await visit(path, options);
    await page.locator('.menu-toggle').click();
    await page.locator('.nav-shell [data-theme-option="dark"]').click();
    await choose(page, 'off');
    await choose(page, 'on');
    assert.deepEqual(await calls(page), [], name + ': no initialization or goals');
    assert.equal(await page.locator('[data-analytics-loader]').count(), 0);
    assert.equal(requests.length, requestCount, name + ': no analytics network request');
    await context.close();
    console.log('PASS analytics: ' + name);
  }

  for (const locale of ['', 'en/']) {
    const { page, context } = await visit('/' + locale + '?release=verification&utm_source=check');
    const init = (await calls(page)).filter(([, command]) => command === 'init');
    assert.equal(init.length, 1, 'A normal audience visit initializes once');
    assert.equal(await page.locator('[data-analytics-loader]').count(), 1);
    await page.locator('.menu-toggle').click();
    await page.locator('.nav-shell [data-theme-option="dark"]').click();
    // Prevent only cross-locale navigation, retaining the real click listener.
    await page.locator('.site-nav [data-language-switch]').evaluate(el => {
      el.addEventListener('click', event => event.preventDefault(), { once: true });
    });
    await page.locator('.site-nav [data-language-switch]').click();
    if (!await page.locator('.nav-shell').evaluate(el => el.open)) await page.locator('.menu-toggle').click();
    await page.locator('.nav-shell .site-nav__link[href="#distance"]').click();
    await page.locator('[data-calendar-details] > summary').click();
    await page.locator('.proof-sources > summary').click();
    const events = (await calls(page)).filter(([, command]) => command === 'reachGoal');
    for (const goal of ['menu_open', 'theme_change', 'language_switch', 'chapter_navigation', 'calendar_open', 'proof_open', 'project_explore']) {
      assert(events.some(([, , id]) => id === goal), 'The real action sends ' + goal);
    }
    assert(events.every(([counter, , , params]) => counter === 111159425 &&
      Object.entries(params || {}).every(([key, value]) =>
        ['chapter', 'language', 'location', 'phase', 'theme'].includes(key) && /^[a-z0-9_-]{1,48}$/i.test(value))));
    await choose(page, 'off');
    assert((await calls(page)).some(([, command]) => command === 'destruct'));
    const count = (await calls(page)).length;
    await page.locator('.nav-shell [data-theme-option="light"]').click();
    assert.equal((await calls(page)).length, count, 'Opting out also stops goals');
    await choose(page, 'on');
    assert.equal((await calls(page)).filter(([, command]) => command === 'init').length, 2);
    assert.equal(await page.locator('[data-analytics-loader]').count(), 1, 'Re-enabling does not duplicate the loader');
    await context.close();
    console.log('PASS analytics: ' + (locale || 'ru/') + ' audience goals and preferences');
  }
  const { page, context } = await visit('/', { off: true });
  assert.deepEqual(await calls(page), []);
  assert.equal(await page.locator('[data-analytics-loader]').count(), 0);
  await choose(page, 'on');
  assert.equal((await calls(page)).filter(([, command]) => command === 'init').length, 1);
  await context.close();
  console.log('PASS analytics: saved opt-out and explicit opt-in');
} finally {
  await browser.close();
  await server.close();
}
