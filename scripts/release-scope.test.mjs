import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { classifyChanges, classifyComponentChanges, detectReleaseScope } from "./release-scope.mjs";

const source = readFileSync(new URL("../src/build.mjs", import.meta.url), "utf8");
const change = (key, url) => source.replace(new RegExp(`(^  ${key}: ")[^"]+`, "m"), `$1${url}`);
const paths = ["src/build.mjs"];

test("a shared external destination is eligible, including query parameters", () => {
  const result = classifyChanges(paths, source, change("designHref", "https://example.com/?point=eleven&lang=ru"));
  assert.equal(result.scope, "links");
  assert.equal(result.links[0].key, "designHref");
});

test("all changes in the push must be link-only", () => {
  const after = change("designHref", "https://example.com/");
  for (const file of ["src/assets/app.js", "src/assets/styles/40-partners-footer.css", ".github/workflows/pages.yml"]) {
    assert.equal(classifyChanges([...paths, file], source, after).scope, "full");
  }
  assert.equal(classifyChanges(paths, source, after + "\n// code change\n").scope, "full");
});

test("copy, markup, data and media links do not bypass the full gate", () => {
  for (const after of [source.replace("startDate:", "otherDate:"), change("filmHref", "https://example.com/"), source.replace("site-footer__credits", "new-credit-layout")]) {
    assert.equal(classifyChanges(paths, source, after).scope, "full");
  }
});

test("invalid destinations and changed source structure fall back to full", () => {
  for (const url of ["javascript:alert(1)", "https://", "https://user:secret@example.com/", "https://example.com/<tag>"]) {
    assert.equal(classifyChanges(paths, source, change("designHref", url)).scope, "full");
  }
  assert.equal(classifyChanges(paths, source, source).scope, "full");
  assert.equal(classifyChanges(paths, source, change("designHref", "https://example.com/") + '\n  designHref: "https://example.com/",').scope, "full");
});

test("scheduled, manual without a known base and missing-base runs keep the full gate", () => {
  for (const event of ["schedule", "workflow_dispatch", undefined]) {
    assert.equal(detectReleaseScope({ event, base: "a".repeat(40) }).scope, "full");
  }
  for (const base of ["0".repeat(40), "a".repeat(40), "invalid"]) {
    assert.equal(detectReleaseScope({ event: "push", base }).scope, "full");
  }
});

const widgetSources = Object.fromEntries(["src/assets/journey.js", "src/assets/styles/70-journey.css"].map(file =>
  [file, readFileSync(new URL(`../${file}`, import.meta.url), "utf8")]));

test("isolated widget changes use the component gate", () => {
  const after = { ...widgetSources,
    "src/assets/journey.js": widgetSources["src/assets/journey.js"].replace("let collapsed = true", "let collapsed = false"),
    "src/assets/styles/70-journey.css": widgetSources["src/assets/styles/70-journey.css"].replace("outline-offset: -4px", "outline-offset: -3px"),
  };
  assert.equal(classifyComponentChanges(Object.keys(after), widgetSources, after).scope, "widget");
});

test("other journey behavior and styling cannot bypass the full gate", () => {
  for (const [file, from, to] of [
    ["src/assets/journey.js", "const KEY =", "const OTHER_KEY ="],
    ["src/assets/styles/70-journey.css", ".ride-replay__controls button", ".ride-replay__controls a"],
  ]) {
    assert.equal(classifyComponentChanges([file], widgetSources,
      { ...widgetSources, [file]: widgetSources[file].replace(from, to) }).scope, "full");
  }
  assert.equal(classifyComponentChanges(["src/assets/journey.js", "src/assets/app.js"], widgetSources, widgetSources).scope, "full");
});

test("release-check changes validate the short gate itself", () => {
  assert.equal(classifyComponentChanges([".github/workflows/pages.yml", "scripts/release-gate.mjs"], {}, {}).scope, "widget");
  assert.equal(classifyComponentChanges([".github/workflows/pages.yml", "src/build.mjs"], {}, {}).scope, "full");
});

test("an unrecognized widget boundary keeps the full gate", () => {
  const file = "src/assets/journey.js";
  const after = { ...widgetSources, [file]: widgetSources[file].replace("function initCalendar(", "function otherCalendar(") };
  assert.equal(classifyComponentChanges([file], widgetSources, after).scope, "full");
  assert.equal(classifyComponentChanges([file], {}, {}).scope, "full");
});

test("dedicated archival-film changes use the film component checks", () => {
  const paths = ["src/ride-film.mjs", "src/assets/ride-film.js", "src/assets/styles/76-ride-film.css"];
  assert.equal(classifyComponentChanges(paths, {}, {}).scope, "film");
  assert.equal(classifyComponentChanges([...paths, "scripts/ride-film-check.mjs", ".github/workflows/pages.yml"], {}, {}).scope, "film");
  for (const outside of ["src/assets/app.js", "src/assets/ride-2024.json", "src/assets/ride-film/sources.json", "src/assets/styles/70-journey.css"]) {
    assert.equal(classifyComponentChanges([...paths, outside], {}, {}).scope, "full");
  }
});

test("a manual comparison checks the actual diff against the named commit", () => {
  const result = detectReleaseScope({ event: "workflow_dispatch", base: "b106cf59f5c096e09d2c16872d28c5971a882367" });
  assert.equal(result.scope, detectReleaseScope({ event: "push", base: "b106cf59f5c096e09d2c16872d28c5971a882367" }).scope);
});
