import assert from 'node:assert/strict';

// Sample the whole recording: dynamic values must keep their common left axis.
export async function checkFilmReadings(page) {
  const samples = await page.evaluate(() => {
    const panel = document.querySelector('[data-ride-film]');
    const range = panel.querySelector('[data-film-range]');
    const samples = [];
    for (let fraction = 0; fraction <= 100; fraction++) {
      range.value = String(Number(range.max) * fraction / 100);
      range.dispatchEvent(new Event('input', {bubbles:true}));
      const group = panel.querySelector('.ride-film__position').getBoundingClientRect();
      const distance = panel.querySelector('[data-film-distance-value]').getBoundingClientRect();
      const clock = panel.querySelector('[data-film-clock]').getBoundingClientRect();
      samples.push({phase:panel.dataset.filmPhase, dx:distance.x-group.x, dy:distance.y-group.y, cx:clock.x-group.x, cy:clock.y-group.y});
    }
    range.value = '0'; range.dispatchEvent(new Event('input', {bubbles:true}));
    return samples;
  });
  for (const axis of ['dx','dy','cx','cy']) {
    const values = samples.map(s=>s[axis]);
    assert(Math.max(...values)-Math.min(...values)<.5, `Film reading ${axis} shifts while values change`);
  }
  assert.equal(new Set(samples.map(s=>s.phase)).size,4,'Both days and both nights are represented');
}

export async function checkFilmAppearance(page) {
  const original = await page.locator('html').getAttribute('data-theme');
  const read = () => page.evaluate(() => {
    const panel = document.querySelector('[data-ride-film]');
    return {
      time:panel.querySelector('[data-film-range]').value,
      timer:panel.querySelector('[data-film-total]').textContent,
      playing:panel.querySelector('[data-film-play]').dataset.playing,
      sound:panel.querySelector('[data-film-sound]').getAttribute('aria-pressed'),
      noteColor:getComputedStyle(panel.querySelector('.ride-film__notes')).color,
      noteBackground:getComputedStyle(panel.querySelector('.ride-film__notes')).backgroundColor,
    };
  });
  const samples = [];
  for (const mode of ['light','dark']) {
    await page.locator(`.site-footer [data-theme-option="${mode}"]`).click();
    await page.waitForFunction(mode => document.documentElement.classList.contains(`theme-${mode}`), mode);
    // Sample the rendered notes after the theme change, rather than reading
    // both inherited colors within the same style-recalculation task.
    await page.locator('.ride-film__notes').scrollIntoViewIfNeeded();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    samples.push(await read());
  }
  await page.locator(`.site-footer [data-theme-option="${original}"]`).click();
  for (const key of ['time','timer','playing','sound']) assert.equal(samples[0][key],samples[1][key],`Theme preserves ${key}`);
  assert.equal(samples[0].playing,'false','Appearance controls do not start the film');
  assert.notEqual(samples[0].noteColor,samples[1].noteColor,'Provenance follows the global theme');
  assert(samples.every(s=>s.noteBackground==='rgba(0, 0, 0, 0)'),'Provenance shares the section surface');
}
