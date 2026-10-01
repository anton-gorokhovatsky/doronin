import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { classifyChanges, detectReleaseScope } from "./release-scope.mjs";

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

test("scheduled, manual and missing-base runs keep the full gate", () => {
  for (const event of ["schedule", "workflow_dispatch", undefined]) {
    assert.equal(detectReleaseScope({ event, base: "a".repeat(40) }).scope, "full");
  }
  for (const base of ["0".repeat(40), "a".repeat(40), "invalid"]) {
    assert.equal(detectReleaseScope({ event: "push", base }).scope, "full");
  }
});
