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
  const hero = await bounds('.hero');
  const calendar = await bounds('#distance');
  const calendarLabel = await bounds('#distance .section-label');
  await scrollTo(0);
  await widget.waitFor({ state: 'hidden' });
  assert(await widget.isHidden(), 'The hero already provides the diary action');
  await scrollTo(hero.bottom + 40);
  await scrollTo(calendar.top + 48);
  await page.waitForTimeout(220);
  assert(await widget.isHidden(), 'Fast travel cancels the pending appearance instead of flashing a card');
  await scrollTo(hero.bottom + 40);
  await page.waitForTimeout(220);
  const beforeNormalScroll = await widget.isVisible();
  await scrollTo(hero.bottom + 220);
  await page.waitForTimeout(220);
  assert.equal(await widget.isVisible(), beforeNormalScroll,
    'One ordinary scroll must not flash a shortcut in the short gap before the calendar');
  if (beforeNormalScroll) {
    await scrollTo(hero.bottom + 40);
    // The reported regression: the heading alone entering the bottom of the
    // viewport must not immediately dismiss the shortcut.
    const headingPeek = Math.max(hero.bottom + 40, calendar.top - height + 24);
    if (headingPeek + height < calendarLabel.top) {
      await scrollTo(headingPeek);
      assert(await widget.isVisible(), 'The heading entering the viewport does not dismiss the shortcut');
    }
    await scrollTo(hero.bottom + 12);
    assert(await widget.isVisible(), 'Small reverse scrolling keeps a visible shortcut');
    await scrollTo(hero.bottom - 1);
    await widget.waitFor({ state: 'hidden' });
    assert(await widget.isHidden(), 'Returning to the hero hides the duplicate action');
    await scrollTo(hero.bottom + 12);
    assert(await widget.isHidden(), 'The hero boundary has a buffer before reappearing');
  }
  await scrollTo(calendarLabel.top - height + 16);
  await widget.waitFor({ state: 'hidden' });
  assert(await widget.isHidden(), 'The shortcut leaves calendar dates unobstructed while reading');
  await scrollTo(calendarLabel.top - height - 16);
  assert(await widget.isHidden(), 'Small reverse scrolling at the calendar does not flicker');
  const diaryBeforeToggle = await bounds('#diary');
  await scrollTo(diaryBeforeToggle.bottom + 48);
  await widget.waitFor({ state: 'visible' });
  await scrollTo(diaryBeforeToggle.bottom + 228);
  assert(await widget.isVisible(), 'The shortcut stays visible through an ordinary scroll in a reading stretch');

  const expanded = await toggle.getAttribute('aria-expanded');
  await toggle.press('Enter');
  assert.notEqual(await toggle.getAttribute('aria-expanded'), expanded);
  const chosenState = await toggle.getAttribute('aria-expanded');
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

  const film = await bounds('.ride-film__screen');
  await scrollTo(film.top - height + 16);
  await widget.waitFor({ state: 'hidden' });
  assert(await widget.isHidden(), 'The shortcut leaves film controls unobstructed');
  await scrollTo(film.top - height - 16);
  assert(await widget.isHidden(), 'Small reverse scrolling at the film does not flicker');
  const diary = await bounds('#diary');
  await scrollTo(diary.top + 48);
  await widget.waitFor({ state: 'hidden' });
  assert(await widget.isHidden(), 'The diary is already the reading destination');
  await scrollTo(diary.bottom + 48);
  await widget.waitFor({ state: 'visible' });
  assert(await widget.isVisible(), 'The shortcut returns after leaving the diary');
  assert.equal(await toggle.getAttribute('aria-expanded'), chosenState,
    'Temporary hiding preserves the chosen disclosure state');
  await page.locator('.menu-toggle').click();
  await widget.waitFor({ state: 'hidden' });
  assert(await widget.isHidden(), 'The open menu provides navigation itself');
  await page.locator('.menu-toggle').click();
  await widget.waitFor({ state: 'visible' });
  assert(await widget.isVisible());

  const footer = await bounds('.site-footer');
  await scrollTo(footer.top - height + 16);
  await widget.waitFor({ state: 'hidden' });
  assert(await widget.isHidden(), 'The shortcut never covers footer information');
  await scrollTo(footer.top - height - 16);
  assert(await widget.isHidden(), 'The footer boundary does not flicker');
  await scrollTo(footer.top - height - 48);
  await widget.waitFor({ state: 'visible' });
  assert(await widget.isVisible());
  assert.equal(await toggle.getAttribute('aria-expanded'), chosenState);

  const latest = await page.evaluate(() =>
    JSON.parse(document.querySelector('#project-updates-data').textContent)
      .filter(item => item.kind === 'diary').at(-1));
  assert.equal(await widget.locator('[data-calendar-link]').getAttribute('href'), latest.href);
  assert.equal(await widget.locator('[data-calendar-date]').getAttribute('datetime'), latest.date);
  await widget.locator('[data-calendar-link]').click();
  await page.waitForFunction(id => document.activeElement?.id === id, latest.href.slice(1));
  await widget.waitFor({ state: 'hidden' });
  await page.reload();
  await widget.waitFor({ state: 'hidden' });
  await scrollTo((await bounds('#diary')).bottom + 48);
  await widget.waitFor({ state: 'visible' });
  assert(await page.locator('[data-return-update]').isHidden());
}
