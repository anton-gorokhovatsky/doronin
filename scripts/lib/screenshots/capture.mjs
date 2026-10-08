import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { prepareScreenshot } from "./prepare.mjs";
import { readScreenshotMetrics } from "./metrics.mjs";
import { assertScreenshotMetrics } from "./assertions.mjs";

export async function capture(browser, origin, spec, outputRoot) {
  const context = await browser.newContext({
    colorScheme: spec.colorScheme || "light",
    forcedColors: spec.forcedColors || "none",
    reducedMotion: spec.reducedMotion || "no-preference",
    viewport: spec.viewport,
  });
  if (spec.blockVideo !== false) {
    await context.route(/\.mp4(?:\?.*)?$/u, (route) => route.abort());
  }
  const page = await context.newPage();
  // Keep the standard composition stable across one-day celebrations.
  await page.clock.setFixedTime(new Date(spec.date || "2026-10-06T12:00:00+03:00"));
  await page.route("https://mc.yandex.ru/**", (route) => route.abort());
  await page.route("https://api.met.no/**", (route) => route.abort());

  try {
    await prepareScreenshot(page, origin, spec);
    await page.waitForTimeout(180);
    const metrics = await readScreenshotMetrics(page);
    await assertScreenshotMetrics(page, metrics, spec);
    const file = resolve(outputRoot, `${spec.name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    const hash = createHash("sha256").update(await readFile(file)).digest("hex");
    return { ...spec, file, hash, metrics };
  } finally {
    await context.close();
  }
}
