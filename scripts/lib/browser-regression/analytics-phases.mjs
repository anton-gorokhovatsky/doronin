import { expect } from "../check-assertions.mjs";

export async function checkAnalyticsAndPhases({ page, origin, testCase, prefix }) {
  const analytics = await page.evaluate(() =>
    window.__analyticsCalls
      .filter(([, command]) => command === "reachGoal")
      .map(([counterId, command, goal, params]) => ({
        counterId,
        command,
        goal,
        params,
      })),
  );
  for (const goal of [
    "menu_open",
    "theme_change",
    "proof_open",
    "calendar_open",
    "chapter_navigation",
    "project_explore",
    "language_switch",
  ]) {
    expect(
      analytics.some((event) => event.goal === goal),
      `${prefix}: analytics goal ${goal} did not fire`,
    );
  }
  expect(
    analytics.every(
      ({ counterId, command, params }) =>
        counterId === 111159425 &&
        command === "reachGoal" &&
        Object.keys(params || {}).every((key) =>
          ["chapter", "language", "location", "phase", "theme"].includes(
            key,
          ),
        ),
    ),
    `${prefix}: analytics emitted an unknown counter, command, or parameter`,
  );

  if (testCase.name === "RU 1440×900") {
    const phaseCases = [
      ["near-unconfirmed", "/?phase=near#distance"],
      ["near-confirmed", "/?phase=near&calendar=confirmed#distance"],
      ["active", "/?phase=active#distance"],
      ["finished", "/?phase=finished#distance"],
    ];
    const calendarPhases = [];

    for (const [name, path] of phaseCases) {
      await page.goto(`${origin}${path}`, { waitUntil: "domcontentloaded" });
      await page.evaluate(() => document.fonts.ready);
      calendarPhases.push(
        await page.evaluate((phaseName) => {
          const details = document.querySelector("[data-calendar-details]");
          const current = document.querySelector("[data-calendar-current]");
          return {
            calendarPhase: document.body.dataset.calendarPhase,
            calendarReady: document.body.dataset.calendarReady,
            currentCount: document.querySelectorAll(
              '.calendar-program__row[aria-current="step"]',
            ).length,
            currentHidden: current?.hidden ?? true,
            currentHref: current
              ?.querySelector("[data-calendar-current-link]")
              ?.getAttribute("href"),
            currentDate: current?.querySelector("[data-calendar-current-date]")?.textContent.replace(/\s+/g, " ").trim(),
            currentTitle: current?.querySelector("[data-calendar-current-title]")?.textContent.trim(),
            currentValue: current?.querySelector("[data-calendar-current-value]")?.textContent.replace(/\s+/g, " ").trim(),
            name: phaseName,
            open: details?.open ?? false,
            projectPhase: document.body.dataset.projectPhase,
            title: details?.querySelector("[data-calendar-phase-copy]")?.textContent.trim(),
          };
        }, name),
      );
    }

    const [nearUnconfirmed, nearConfirmed, active, finished] = calendarPhases;
    expect(
      nearUnconfirmed.calendarPhase === "near" &&
        nearUnconfirmed.calendarReady === "false" &&
        nearUnconfirmed.open === false &&
        nearUnconfirmed.title === "План декабря" &&
        nearConfirmed.calendarPhase === "near" &&
        nearConfirmed.calendarReady === "true" &&
        nearConfirmed.open === true &&
        active.projectPhase === "active" &&
        active.calendarPhase === "active" &&
        active.open === true &&
        active.currentCount === 1 &&
        active.currentHidden === false &&
        active.currentHref === "#calendar-segment-06" &&
        active.currentDate === "15 декабря" &&
        active.currentTitle === "Базовый день" &&
        active.currentValue === "333 км в день" &&
        active.title === "Календарь прохождения" &&
        finished.projectPhase === "finished" &&
        finished.calendarPhase === "finished" &&
        finished.open === true &&
        finished.currentCount === 0 &&
        finished.currentHidden === true &&
        finished.title === "Архив плана декабря",
      `${prefix}: calendar phase contract regressed (${JSON.stringify(calendarPhases)})`,
    );
  }
}
