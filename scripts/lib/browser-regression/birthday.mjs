import { expect } from "../check-assertions.mjs";

export async function auditBirthdayHero(browser, browserName, origin, testCase) {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: testCase.viewport });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date("2026-10-05T12:00:00+03:00"));
  await page.route("https://mc.yandex.ru/**", route => route.abort());
  await page.route("https://api.met.no/**", route => route.abort());
  try {
    await page.goto(`${origin}${testCase.path}`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    const prefix = `${browserName} ${testCase.name} birthday`;
    expect(await page.locator(".birthday-stage").isVisible(), `${prefix}: greeting hidden`);
    expect(await page.locator(".birthday-diary").isVisible(), `${prefix}: diary action hidden`);
    expect(!(await page.locator(".hero__main").isVisible()), `${prefix}: ordinary hero competes with greeting`);
    expect(await page.getByRole("heading", { level: 1 }).count() === 1, `${prefix}: ambiguous primary heading`);
    expect(await page.locator("[data-birthday-replay]").isHidden(), `${prefix}: confetti ignores reduced motion`);
    const media = await page.locator("[data-hero-video]").evaluate(v => ({
      paused: v.paused, poster: v.poster, sources: [...v.querySelectorAll("source")].map(s => s.src),
    }));
    expect(media.paused && media.poster.includes("birthday-2026-film") &&
      media.sources.every(src => src.includes("birthday-2026-film")), `${prefix}: birthday media or motion preference lost`);
    await page.clock.setFixedTime(new Date("2026-10-06T00:00:00+03:00"));
    await page.evaluate(() => window.dispatchEvent(new Event("pageshow")));
    await page.locator(".hero__main").waitFor({ state: "visible" });
    expect(!(await page.locator(".birthday-stage").isVisible()), `${prefix}: greeting survived midnight`);
    const restored = await page.locator("[data-hero-video]").evaluate(v => ({
      paused: v.paused, poster: v.poster, sources: [...v.querySelectorAll("source")].map(s => s.src),
    }));
    expect(restored.paused && restored.poster.endsWith("hero.jpg") &&
      restored.sources.every(src => src.includes("hero-loop")), `${prefix}: normal media did not return`);
    expect(await page.locator(".hero").getAttribute("aria-labelledby") === "hero-title", `${prefix}: ordinary heading not restored`);
    const homeHref = testCase.path.startsWith("/en/") ? "/en/" : "/";
    await page.goto(`${origin}${homeHref}birthday/`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    expect(await page.getByRole("heading", { level: 1 }).isVisible(), `${prefix}: archive greeting expired`);
    expect(await page.locator(".birthday-diary").getAttribute("href") === `${homeHref}#diary`, `${prefix}: archive diary link is broken`);
    expect(await page.locator(".birthday-home").getAttribute("href") === `${homeHref}#about`, `${prefix}: archive return link is broken`);
    expect(await page.locator("[data-birthday-replay]").isHidden(), `${prefix}: archive ignores reduced motion`);
    const archiveMedia = await page.locator("[data-hero-video]").evaluate(v => ({
      paused: v.paused, poster: v.poster, sources: [...v.querySelectorAll("source")].map(s => s.src),
    }));
    expect(archiveMedia.paused && archiveMedia.poster.includes("birthday-2026-film") &&
      archiveMedia.sources.every(src => src.includes("birthday-2026-film")), `${prefix}: archive media lost`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${prefix}: archive overflows`);
    // On the birthday itself the homepage has the same greeting. The return
    // action must land on project content, not merely change the page URL.
    await page.clock.setFixedTime(new Date("2026-10-05T12:00:00+03:00"));
    await page.locator(".birthday-home").click();
    await page.waitForURL(`${origin}${homeHref}#about`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => {
      const title = document.querySelector("#manifesto-title")?.getBoundingClientRect();
      return title && title.top >= 0 && title.top < innerHeight - 40;
    });
    return `${prefix}: dated homepage, permanent archive and return to project PASS`;
  } finally {
    await context.close();
  }
}
