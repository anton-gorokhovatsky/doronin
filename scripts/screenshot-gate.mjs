import { prepareTestSite } from "./lib/check-runtime.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { startSiteServer } from "./lib/site-server.mjs";
import { expect } from "./lib/check-assertions.mjs";
import { capture } from "./lib/screenshots/capture.mjs";
import { screenshotSpecs } from "./lib/screenshots/specs.mjs";

const outputRoot = resolve("artifacts/gate/automated");

const screenshotFilter = process.env.SCREENSHOT_FILTER;
const selectedSpecs = screenshotFilter
  ? screenshotSpecs.filter((spec) => spec.name.includes(screenshotFilter))
  : screenshotSpecs;

expect(selectedSpecs.length > 0, "No screenshot scenarios match: " + screenshotFilter);
const testRoot = await prepareTestSite(process.argv[2]);
await mkdir(outputRoot, { recursive: true });
const server = await startSiteServer(testRoot);
const manifest = [];
let browser;
try {
  browser = await chromium.launch({ headless: true });
  for (const spec of selectedSpecs) manifest.push(await capture(browser, server.origin, spec, outputRoot));
} finally {
  await browser?.close();
  await server.close();
}

await writeFile(
  resolve(outputRoot, "manifest.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), captures: manifest }, null, 2)}\n`,
  "utf8",
);

console.log(`Screenshot gate: ${manifest.length}/${screenshotSpecs.length} PASS`);
for (const item of manifest) {
  console.log(`${item.name} ${item.hash.slice(0, 12)} overflow=0`);
}
