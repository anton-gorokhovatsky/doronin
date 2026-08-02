import AxeBuilder from "@axe-core/playwright";

export const axeTags = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22a",
  "wcag22aa",
];

export function expect(condition, message) {
  if (!condition) throw new Error(message);
}

export async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
}

export async function openPage(browser, origin, spec) {
  const context = await browser.newContext({
    colorScheme: spec.colorScheme || "light",
    forcedColors: spec.forcedColors || "none",
    reducedMotion: spec.reducedMotion || "reduce",
    viewport: spec.viewport,
  });
  if (spec.blockVideo !== false) {
    await context.route(/\.mp4(?:\?.*)?$/u, (route) => route.abort());
  }
  const page = await context.newPage();
  await page.route("https://mc.yandex.ru/**", (route) => route.abort());
  await page.goto(`${origin}${spec.path}`, { waitUntil: "domcontentloaded" });
  await settle(page);

  if (spec.menuOpen) {
    await page.locator(".menu-toggle").click();
    await page.locator(".site-nav").waitFor({ state: "visible" });
  }

  return { context, page };
}

export function describeViolations(violations) {
  return violations
    .map(
      (violation) =>
        `${violation.id} (${violation.impact || "unknown"}): ${violation.help}\n` +
        violation.nodes
          .slice(0, 5)
          .map((node) => `  ${node.target.join(" ")} — ${node.failureSummary}`)
          .join("\n"),
    )
    .join("\n");
}

export async function axePage(page, prefix, { disableRules = [] } = {}) {
  let builder = new AxeBuilder({ page }).withTags(axeTags);
  if (disableRules.length > 0) builder = builder.disableRules(disableRules);
  const report = await builder.analyze();
  expect(
    report.violations.length === 0,
    `${prefix}: Axe found ${report.violations.length} violation(s)\n${describeViolations(report.violations)}`,
  );
}

export async function readLayout(page) {
  return page.evaluate(() => {
    const isVisible = (element) => {
      const closedDetails = element.closest("details:not([open])");
      if (closedDetails && !element.matches("summary") && !element.closest("summary")) {
        return false;
      }
      for (let current = element; current; current = current.parentElement) {
        const currentStyle = getComputedStyle(current);
        if (
          current.hidden ||
          current.inert ||
          currentStyle.display === "none" ||
          currentStyle.visibility === "hidden" ||
          Number(currentStyle.opacity) === 0
        ) {
          return false;
        }
      }
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) !== 0 &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    const describe = (element) => {
      const text = element.getAttribute("aria-label") || element.textContent || "";
      const region = element.closest(
        ".site-nav__primary, .site-footer__nav, header, main, footer",
      );
      const regionName = region
        ? `${region.tagName.toLowerCase()}.${String(region.className || "")
            .trim()
            .replace(/\s+/g, ".")}`
        : "document";
      return `${regionName} > ${element.tagName.toLowerCase()}.${String(element.className || "")
        .trim()
        .replace(/\s+/g, ".")} ${text.trim().replace(/\s+/g, " ").slice(0, 60)}`;
    };
    const isInsideHorizontalScroller = (element) => {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (
          ["auto", "scroll"].includes(style.overflowX) &&
          parent.scrollWidth > parent.clientWidth + 1
        ) {
          return true;
        }
      }
      return false;
    };
    const clippedText = [
      ...document.querySelectorAll("h1, h2, h3, p, li, a, button, summary, small, strong"),
    ]
      .filter(isVisible)
      .filter((element) => {
        const style = getComputedStyle(element);
        return (
          element.scrollWidth > element.clientWidth + 1 &&
          ["hidden", "clip"].includes(style.overflowX)
        );
      })
      .map(describe);
    const clippedActions = [
      ...document.querySelectorAll("a[href], button, summary, [tabindex]:not([tabindex='-1'])"),
    ]
      .filter(isVisible)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return (
          !isInsideHorizontalScroller(element) &&
          (rect.left < -1 || rect.right > innerWidth + 1)
        );
      })
      .map(describe);
    const overflowingElements = [...document.querySelectorAll("body *")]
      .filter((element) => getComputedStyle(element).display !== "none")
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return (
          !isInsideHorizontalScroller(element) &&
          (rect.left < -1 ||
            rect.right > document.documentElement.clientWidth + 1 ||
            element.scrollWidth > document.documentElement.clientWidth + 1)
        );
      })
      .slice(0, 12)
      .map(describe);

    return {
      clippedActions,
      clippedText,
      clientWidth: document.documentElement.clientWidth,
      overflowingElements,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
}

export async function scanFullPage(page, prefix) {
  const sections = page.locator("main > section, footer");
  const count = await sections.count();
  for (let index = 0; index < count; index += 1) {
    await sections.nth(index).scrollIntoViewIfNeeded();
    await settle(page);
    const layout = await readLayout(page);
    expect(
      layout.scrollWidth <= layout.clientWidth,
      `${prefix}: horizontal overflow ${layout.scrollWidth - layout.clientWidth}px at section ${index + 1}: ${layout.overflowingElements.join(" | ")}`,
    );
    expect(
      layout.clippedActions.length === 0,
      `${prefix}: clipped actions at section ${index + 1}: ${layout.clippedActions.join(" | ")}`,
    );
    expect(
      layout.clippedText.length === 0,
      `${prefix}: clipped text at section ${index + 1}: ${layout.clippedText.join(" | ")}`,
    );
  }
}
