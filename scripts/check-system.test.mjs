import assert from "node:assert/strict";
import test from "node:test";
import { staticChecks, browserChecks, selectChecks } from "./lib/check-registry.mjs";
import { prepareTestSite, selectBrowserEngines } from "./lib/check-runtime.mjs";

test("ordinary publishing has no browser work", () => {
  const { checks } = selectChecks([]);
  assert(checks.some(check => check.id === "build"));
  assert(checks.some(check => check.id === "contract"));
  assert(checks.every(check => !browserChecks.some(browser => browser.id === check.id)));
});
test("a focused request builds once and runs only the chosen browser check", () => {
  const chosen = browserChecks[0].id;
  const { checks } = selectChecks(["--check", chosen, "--check", chosen]);
  assert.equal(checks.filter(check => check.id === "build").length, 1);
  assert.deepEqual(checks.filter(check => browserChecks.some(browser => browser.id === check.id)).map(check => check.id), [chosen]);
  assert.equal(checks.find(check => check.id === chosen).args[0], "site");
});
test("the explicit full set includes every registered browser check once", () => {
  const checks = selectChecks(["--full"]).checks;
  assert.equal(new Set(checks.map(check => check.id)).size, checks.length);
  assert(browserChecks.every(browser => checks.some(check => check.id === browser.id)));
  assert(checks.filter(check => browserChecks.some(browser => browser.id === check.id)).every(check => check.args[0] === "site"));
  assert.equal(checks.filter(check => check.id === "build").length, 1);
});
test("typos fail before any build or browser launch", () => {
  for (const args of [["--check"], ["--check", "diay"], ["--ful"], ["--full", "--check", browserChecks[0].id]]) assert.throws(() => selectChecks(args));
  const old = process.env.CHECK_ENGINES;
  try {
    process.env.CHECK_ENGINES = "chromium,webkt";
    assert.throws(() => selectBrowserEngines({ chromium: {}, webkit: {} }));
    process.env.CHECK_ENGINES = "";
    assert.throws(() => selectBrowserEngines({ chromium: {}, webkit: {} }));
  } finally {
    if (old === undefined) delete process.env.CHECK_ENGINES;
    else process.env.CHECK_ENGINES = old;
  }
});
test("an explicit built directory never triggers a second build", async () => {
  assert.equal(await prepareTestSite("site"), "site");
});
test("check scripts are distinct and do not recurse into the gate", () => {
  const checks = [...staticChecks, ...browserChecks];
  assert.equal(new Set(checks.map(check => check.script)).size, checks.length);
  assert(!checks.some(check => check.script === "scripts/release-gate.mjs"));
});

test("empty screenshot selection fails rather than reporting success", async () => {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  await assert.rejects(
    promisify(execFile)(process.execPath, ["scripts/screenshot-gate.mjs", "site"], {
      env: { ...process.env, SCREENSHOT_FILTER: "__no_such_scenario__" },
      timeout: 10000,
    }),
    error => error.code === 1 && /No screenshot scenarios match/.test(error.stderr),
  );
});
