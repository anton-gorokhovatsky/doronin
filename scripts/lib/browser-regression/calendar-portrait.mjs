import { expect, near } from "../check-assertions.mjs";
import { projectPlan } from "./fixtures.mjs";

export async function checkCalendarAndPortrait({ page, testCase, prefix }) {
  const calendarDetails = page.locator("[data-calendar-details]");
  expect(
    (await page.locator("body").getAttribute("data-calendar-phase")) === "far" &&
      !(await calendarDetails.evaluate((element) => element.open)),
    `${prefix}: far-before calendar must start collapsed`,
  );
  await calendarDetails.locator("summary").click();
  expect(
    await calendarDetails.evaluate((element) => element.open),
    `${prefix}: full calendar did not open from its named disclosure`,
  );

  const calendarState = await page.locator(".bike-calendar").evaluate((element) => {
    const rect = (node) => node?.getBoundingClientRect().toJSON() || null;
    const contained = (box, parent) => !box ||
      (box.left >= parent.left - 1 && box.right <= parent.right + 1 &&
       box.top >= parent.top - 1 && box.bottom <= parent.bottom + 1);
    const sequence = element.querySelector(".calendar-poster");
    const stages = [...sequence.children].map((stage) => ({
      box: rect(stage),
      date: rect(stage.querySelector(".calendar-poster__date")),
      value: rect(stage.querySelector(".calendar-poster__value")),
      unit: rect(stage.querySelector(".calendar-poster__value > span")),
      distance: Number(stage.querySelector("strong").textContent.trim()),
      href: stage.querySelector("a").getAttribute("href"),
      fontSize: Number.parseFloat(getComputedStyle(stage.querySelector("strong")).fontSize),
    }));
    const segments = [...element.querySelectorAll(".calendar-program__row")].map((row) => {
      const box = rect(row);
      const parts = [...row.children].map(rect);
      const overlaps = parts.some((a, index) => parts.slice(index + 1).some((b) =>
        a.left < b.right - 1 && a.right > b.left + 1 &&
        a.top < b.bottom - 1 && a.bottom > b.top + 1));
      return {
        id: row.id,
        kind: row.dataset.calendarKind,
        start: row.dataset.calendarStart,
        end: row.dataset.calendarEnd,
        datetime: row.querySelector("time").dateTime,
        dateLeft: rect(row.querySelector("time")).left,
        distance: row.querySelector(".calendar-program__distance > strong")?.textContent.trim() || null,
        cumulative: row.querySelector("[data-plan-cumulative]")?.dataset.planCumulative || null,
        label: row.querySelector(".calendar-program__name").textContent.trim(),
        hasNote: Boolean(row.querySelector(".calendar-program__note")),
        contained: parts.every((part) => contained(part, box)),
        overlaps,
      };
    });
    return {
      stages, segments,
      stageContentFits: stages.every((stage) =>
        contained(stage.date, stage.box) && contained(stage.value, stage.box) && contained(stage.unit, stage.box)),
      sequenceDisplay: getComputedStyle(sequence).display,
      sequenceWidth: rect(sequence).width,
      parentWidth: rect(element).width,
      finishLabel: element.querySelector(".calendar-program__row--finish .calendar-program__name").textContent.trim(),
    };
  });
  let cumulativeDistance = 0;
  const expectedSegments = projectPlan.segments.map((segment, index) => {
    cumulativeDistance += segment.totalDistanceKm;
    return {
      id: `calendar-segment-${String(index + 1).padStart(2, "0")}`,
      kind: segment.kind, start: segment.startDate, end: segment.endDate,
      distance: segment.kind === "finish" ? null :
        String(segment.kind === "base" ? segment.dailyDistanceKm : segment.totalDistanceKm),
      cumulative: segment.kind === "finish" ? null : String(cumulativeDistance),
    };
  });
  const actualSegments = calendarState.segments.map(({id, kind, start, end, distance, cumulative}) =>
    ({id, kind, start, end, distance, cumulative}));
  const expectedStageLinks = expectedSegments.filter((segment) => segment.kind === "special").map((segment) => `#${segment.id}`);
  expect(
    calendarState.stages.length === projectPlan.specialSequenceKm.length &&
      calendarState.stages.map((stage) => stage.distance).join(",") === projectPlan.specialSequenceKm.join(",") &&
      calendarState.stages.map((stage) => stage.href).join(",") === expectedStageLinks.join(",") &&
      JSON.stringify(actualSegments) === JSON.stringify(expectedSegments),
    `${prefix}: poster or full calendar differs from the canonical plan (${JSON.stringify(calendarState)})`,
  );
  expect(
    calendarState.sequenceDisplay === "grid" &&
      calendarState.sequenceWidth <= calendarState.parentWidth + 1 &&
      calendarState.stageContentFits &&
      calendarState.stages.every((stage, index, rows) => index === 0 ||
        (stage.box.top >= rows[index - 1].box.bottom - 1 && stage.fontSize > rows[index - 1].fontSize)) &&
      calendarState.stages.every((stage) => stage.date.height >= 44 &&
        (testCase.viewport.width <= 720 ? stage.value.top >= stage.date.bottom - 1 :
          stage.value.left >= stage.date.right - 1)),
    `${prefix}: poster loses its increasing type, target sizes or non-overlapping rows (${JSON.stringify(calendarState.stages)})`,
  );
  const finish = calendarState.segments.at(-1);
  expect(
    calendarState.segments.every((segment) => segment.contained && !segment.overlaps && segment.datetime === segment.start) &&
      Math.max(...calendarState.segments.map((segment) => segment.dateLeft)) -
        Math.min(...calendarState.segments.map((segment) => segment.dateLeft)) <= 1 &&
      finish.kind === "finish" && !finish.hasNote && finish.distance === null && finish.cumulative === null &&
      calendarState.finishLabel === (testCase.path.startsWith("/en/") ? "Result confirmation" : "Фиксация результата"),
    `${prefix}: calendar rows overlap, lose their date axis or repeat a distance at the finish (${JSON.stringify(calendarState.segments)})`,
  );

  // A date in the poster opens the full program with native keyboard navigation.
  await calendarDetails.locator("summary").click();
  const finalStageDate = page.locator(".calendar-poster__date").last();
  await finalStageDate.focus();
  await finalStageDate.press("Enter");
  await page.waitForFunction(() => document.querySelector("[data-calendar-details]").open &&
    location.hash === "#calendar-segment-10");

  if (testCase.viewport.width > 960) {
    const stickyState = await page.locator(".athlete").evaluate(async (section) => {
      const media = section.querySelector(".athlete__media");
      const read = () => {
        const box = media.getBoundingClientRect();
        return { bottom: box.bottom, top: box.top };
      };
      const settle = () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
      const previousScrollBehavior = document.documentElement.style.scrollBehavior;
      const previousBodyScrollBehavior = document.body.style.scrollBehavior;
      document.documentElement.style.setProperty("scroll-behavior", "auto", "important");
      document.body.style.setProperty("scroll-behavior", "auto", "important");
      scrollTo(0, 0);
      await settle();
      const style = getComputedStyle(media);
      const topOffset = Number.parseFloat(style.top);
      const sectionTop = section.getBoundingClientRect().top + scrollY;
      const maxScroll =
        sectionTop + section.offsetHeight - media.offsetHeight - topOffset;
      const holdStart = sectionTop - topOffset;
      const holdEnd = maxScroll;
      scrollTo(0, holdStart + Math.max(40, (holdEnd - holdStart) * 0.45));
      await settle();
      const held = read();
      scrollTo(0, maxScroll + 120);
      await settle();
      const released = read();
      document.documentElement.style.scrollBehavior = previousScrollBehavior;
      document.body.style.scrollBehavior = previousBodyScrollBehavior;
      return {
        corridor: maxScroll - sectionTop,
        held,
        position: style.position,
        released,
        scrollY,
        sectionTop,
        topOffset,
      };
    });
    expect(
      stickyState.position === "sticky" &&
        near(stickyState.held.top, stickyState.topOffset, 2) &&
        stickyState.released.top < stickyState.topOffset - 20,
      `${prefix}: Viktor portrait does not hold and release as a sticky chapter image (${JSON.stringify(stickyState)})`,
    );
  }

}
