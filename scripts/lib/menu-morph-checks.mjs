import assert from "node:assert/strict";

export async function checkMenuMorph(page) {
  const toggle = page.locator(".menu-toggle");
  await page.waitForSelector(".menu-toggle__icon[data-morph-ready]");
  const path = page.locator(".menu-toggle__icon path");
  const closed = await path.getAttribute("d");
  const open = await path.getAttribute("data-open-path");
  const settled = (expected) => page.waitForFunction(
    (d) => document.querySelector(".menu-toggle__icon path").getAttribute("d") === d,
    expected,
  );

  await toggle.click();
  await settled(open);
  await page.keyboard.press("Escape");
  await settled(closed);
  assert.equal(await toggle.evaluate((el) => el === document.activeElement), true);

  // Retarget an unfinished transition, then confirm the native final state.
  for (let index = 0; index < 4; index += 1) {
    await toggle.evaluate((el) => el.click());
    await page.waitForTimeout(35);
  }
  await settled(closed);
  assert.equal(await page.locator(".nav-shell").evaluate((el) => el.open), false);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await toggle.click();
  await page.waitForTimeout(30);
  assert.equal(await path.getAttribute("d"), open, "Reduced motion must swap instantly");
  await page.keyboard.press("Escape");
  await settled(closed);
  await page.emulateMedia({ reducedMotion: "no-preference" });
}
