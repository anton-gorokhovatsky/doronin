import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { startSiteServer } from './lib/site-server.mjs';
import { checkDiaryWidget } from './lib/diary-widget-checks.mjs';
import { checkFooterLinks } from './lib/footer-link-checks.mjs';

const server = await startSiteServer(process.argv[2] || 'site');
const browser = await chromium.launch();
const output = 'artifacts/gate/automated/diary-widget';
await mkdir(output, { recursive: true });
try {
  for (const { locale, width, enlarged } of [
    { locale: 'ru', width: 1440 }, { locale: 'en', width: 1440 },
    { locale: 'ru', width: 390 }, { locale: 'en', width: 390 },
    { locale: 'ru', width: 320 }, { locale: 'ru', width: 320, enlarged: true },
  ]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(5000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      return url.origin === server.origin && !url.pathname.endsWith('.mp4') ? route.continue() : route.abort();
    });
    await page.goto(`${server.origin}/${locale === 'en' ? 'en/' : ''}${enlarged ? '?text=200' : ''}`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await checkDiaryWidget(page);
    const widget = page.locator('.return-calendar');
    const toggle = widget.locator('button');
    assert.equal(await toggle.getAttribute('title'), null, 'No native tooltip covers the widget');
    assert(await toggle.getAttribute('aria-label'), 'The disclosure keeps its accessible name');
    const capture = state => widget.screenshot({ path: `${output}/${locale}-${width}${enlarged ? '-enlarged' : ''}-${state}.png` });
    const hover = async () => {
      await toggle.hover();
      await page.waitForFunction(() => {
        const widget = document.querySelector('.return-calendar');
        return getComputedStyle(widget.querySelector('button')).color !== getComputedStyle(widget).color;
      });
      assert.equal(await toggle.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)', 'Hover leaves the glass surface uninterrupted');
      assert.equal(await toggle.evaluate(el => getComputedStyle(el).outlineStyle), 'none', 'Pointer hover does not masquerade as keyboard focus');
    };
    await hover();
    await capture('compact-hover');
    await toggle.click();
    await hover();
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    await capture('expanded-hover');
    await page.mouse.move(20, 100);
    await widget.locator('a').focus();
    await page.keyboard.press('Tab');
    assert(await toggle.evaluate(el => document.activeElement === el));
    assert.notEqual(await toggle.evaluate(el => getComputedStyle(el).outlineStyle), 'none', 'Keyboard focus remains visible');
    await capture('keyboard');
    await toggle.click();
    await hover();
    await page.keyboard.press('Shift');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(await toggle.evaluate(el => getComputedStyle(el).outlineStyle), 'none', 'A modifier key does not restore a pointer focus ring');
    await checkFooterLinks(page);
    await page.locator('.site-footer__legal').screenshot({ path: output + '/' + locale + '-' + width + (enlarged ? '-enlarged' : '') + '-footer.png' });
    assert.deepEqual(errors, []);
    console.log(`PASS diary widget: ${locale} ${width}px${enlarged ? ' 200% text' : ''}, scrolling, footer, disclosure, hover and keyboard`);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
