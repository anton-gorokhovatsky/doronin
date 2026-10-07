import assert from 'node:assert/strict';

export async function checkDiaryWidget(page) {
  const widget = page.locator('.return-calendar');
  const toggle = widget.locator('[data-calendar-toggle]');
  const scrollTo = async y => {
    await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), y);
    await page.evaluate(() => new Promise(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  const bounds = selector => page.locator(selector).evaluate(el => {
    const box = el.getBoundingClientRect();
    return { top: box.top + scrollY, bottom: box.bottom + scrollY };
  });
  const height = await page.evaluate(() => innerHeight);
  const action = await bounds('.hero__actions [href="#diary"]');
  await page.locator('.hero__actions [href="#diary"]').focus();
  await scrollTo(0);
  await widget.waitFor({ state: 'hidden' });
  assert(await widget.isHidden(), 'The hero already provides the diary action');
  await scrollTo(action.bottom + 20);
  await widget.waitFor({ state: 'visible' });
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false', 'The shortcut starts compact on every screen');
  await scrollTo(action.bottom + 4);
  assert(await widget.isVisible(), 'Small reverse scrolling does not dismiss the shortcut');
  await scrollTo(action.bottom - 1);
  await widget.waitFor({ state: 'hidden' });
  await scrollTo(action.bottom + 4);
  assert(await widget.isHidden(), 'The hero action boundary has a small buffer');
  await scrollTo(action.bottom + 20);
  await widget.waitFor({ state: 'visible' });

  // Exercise ordinary continuous scrolling, with no pause to reveal the card.
  // The calendar, film, diary and footer are reading destinations, not blockers.
  const end = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const stops = [];
  for (let y = action.bottom + 20; y < end; y += height * 0.8) stops.push(y);
  stops.push(end);
  for (const y of [...stops, ...stops.toReversed()]) {
    await scrollTo(y);
    assert(await widget.isVisible(), `The shortcut stays available while scrolling at ${Math.round(y)}`);
  }
  const fits = await widget.evaluate(el => {
    const box = el.getBoundingClientRect();
    const link = el.querySelector('a').getBoundingClientRect();
    const toggle = el.querySelector('button').getBoundingClientRect();
    const text = el.querySelector('.return-calendar__compact').getBoundingClientRect();
    return box.left >= 0 && box.right <= innerWidth && box.bottom <= innerHeight &&
      el.scrollWidth <= el.clientWidth + 1 && link.height >= 44 && toggle.width >= 44 &&
      toggle.height >= 44 && text.right <= toggle.left;
  });
  assert(fits, 'The compact date, label and separate touch target fit without clipping');

  await toggle.press('Enter');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  const motion = await widget.evaluate(el => ({
    morphing: el.classList.contains('is-morphing'),
    ghost: Boolean(el.querySelector('.return-calendar__ghost')),
    durations: el.getAnimations({ subtree: true }).map(animation => {
      const timing = animation.effect.getComputedTiming();
      return timing.activeDuration + Math.max(0, timing.delay);
    }),
  }));
  assert(!motion.morphing && !motion.ghost && motion.durations.every(duration => duration <= 1),
    'Reduced motion keeps the disclosure instant');
  const material = await page.evaluate(() => {
    const w = getComputedStyle(document.querySelector('.return-calendar'));
    const m = getComputedStyle(document.querySelector('.menu-toggle'));
    return [w.backgroundImage === m.backgroundImage,
      w.backdropFilter === m.backdropFilter, w.boxShadow === m.boxShadow];
  });
  assert(material.every(Boolean), 'The shortcut shares the menu glass material');
  for (const selector of ['#distance', '.ride-film__screen', '#diary', '.site-footer']) {
    await scrollTo((await bounds(selector)).top);
    assert(await widget.isVisible(), `The shortcut remains available in ${selector}`);
  }
  await page.locator('.menu-toggle').click();
  await widget.waitFor({ state: 'hidden' });
  await page.locator('.menu-toggle').click();
  await widget.waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('.nav-shell').open &&
    !document.querySelector('.return-calendar').inert);
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true',
    'Temporary hiding preserves the chosen disclosure state');
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');

  // Put an actual page action under the floating control and focus it without
  // scrolling: keyboard access takes precedence over the shortcut.
  const pageAction = page.locator('[data-calendar-details] > summary');
  const pageActionBounds = await bounds('[data-calendar-details] > summary');
  const widgetTop = await widget.evaluate(el => el.getBoundingClientRect().top);
  await scrollTo(pageActionBounds.top - widgetTop + 1);
  await pageAction.evaluate(el => el.focus({ preventScroll: true }));
  await widget.waitFor({ state: 'hidden' });
  assert(await widget.isHidden(), 'The shortcut never obscures a focused page control');
  await scrollTo(pageActionBounds.top - height / 2);
  await widget.waitFor({ state: 'visible' });

  const latest = await page.evaluate(() =>
    JSON.parse(document.querySelector('#project-updates-data').textContent)
      .filter(item => item.kind === 'diary').at(-1));
  assert.equal(await widget.locator('[data-calendar-link]').getAttribute('href'), latest.href);
  assert.equal(await widget.locator('[data-calendar-date]').getAttribute('datetime'), latest.date);
  await widget.locator('[data-calendar-link]').click();
  await page.waitForFunction(id => document.activeElement?.id === id, latest.href.slice(1));
  await widget.waitFor({ state: 'visible' });
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
  await scrollTo((await bounds('#diary')).top);
  await widget.waitFor({ state: 'visible' });
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  assert(await page.locator('[data-return-update]').isHidden());
}
