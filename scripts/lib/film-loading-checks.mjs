import assert from 'node:assert/strict';

export async function checkFilmLoading(browser, origin) {
  const results = [];
  for (const scenario of ['slow', 'cancelled', 'stalled']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
    let release;
    const held = new Promise(resolve => { release = resolve; });
    try {
      await page.clock.install();
      await page.route('https://api.met.no/**', route => route.abort());
      await page.route('https://mc.yandex.ru/**', route => route.abort());
      await page.route('**/ride-montage.mp4?*', async route => { await held; await route.continue(); });
      await page.goto(origin + '/?film=loading#ride-2024', { waitUntil: 'domcontentloaded' });
      const play = page.locator('[data-film-play]');
      const video = page.locator('[data-film-video]');
      await play.scrollIntoViewIfNeeded();
      await page.waitForFunction(() => !document.querySelector('[data-film-play]').disabled);
      await video.evaluate(el => {
        el.dataset.loads = '0';
        el.addEventListener('loadstart', () => { el.dataset.loads = String(Number(el.dataset.loads) + 1); });
      });
      const requested = page.waitForRequest('**/ride-montage.mp4?*', { timeout: 10000 });
      await play.click();
      await requested;
      await page.clock.fastForward(scenario === 'stalled' ? 31000 : 13000);
      if (scenario === 'stalled') {
        assert.match(await play.innerText(), /Повторить загрузку/u, 'A connection with no progress has a bounded fallback');
        assert.match(await page.locator('[data-film-status]').innerText(), /Не удалось/u);
        assert(await page.locator('.ride-film__picture').isVisible());
        assert(await page.locator('.ride-film__source').isVisible());
      } else {
        assert.match(await play.innerText(), /Загрузка/u, 'A cold load survives the old twelve-second deadline');
        assert.equal(await page.locator('[data-film-status]').innerText(), '');
      }
      if (scenario === 'cancelled') await page.locator('.menu-toggle').click();
      release();
      await page.waitForFunction(() => document.querySelector('[data-film-video]').readyState >= 2);
      if (scenario === 'slow') {
        await page.waitForFunction(() => {
          const video = document.querySelector('[data-film-video]');
          return !video.paused && video.currentTime > 0.2;
        });
        assert.equal(await page.locator('[data-film-status]').innerText(), '');
      } else {
        assert(await video.evaluate(el => el.paused), 'A cancelled or timed-out load never starts late');
        const loads = await video.getAttribute('data-loads');
        if (scenario === 'cancelled') await page.locator('.menu-toggle').click();
        await play.click();
        await page.waitForFunction(() => {
          const video = document.querySelector('[data-film-video]');
          return !video.paused && video.currentTime > 0.2;
        });
        assert.equal(await video.getAttribute('data-loads'), loads, 'A new action reuses the already decoded film');
        assert.equal(await page.locator('[data-film-status]').innerText(), '');
      }
      await play.click();
      assert(await video.evaluate(el => el.paused));
      results.push({ scenario, passed: true });
    } finally {
      release();
      await page.close();
    }
  }
  return results;
}
