import { prepareTestSite, selectBrowserEngines } from "./lib/check-runtime.mjs";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { chromium, webkit } from "playwright";
import { startSiteServer } from "./lib/site-server.mjs";
import { expect } from "./lib/check-assertions.mjs";
import { cases } from "./lib/browser-regression/cases.mjs";
import { auditPage } from "./lib/browser-regression/page.mjs";
import { auditBirthdayHero } from "./lib/browser-regression/birthday.mjs";

const execFileAsync = promisify(execFile);
const browsers = selectBrowserEngines({ chromium, webkit }, "BROWSER_REGRESSION_ENGINES");

const workerMarker = "--case";
const workerIndex = process.argv.indexOf(workerMarker);

if (workerIndex >= 0) {
  const browserName = process.argv[workerIndex + 1];
  const caseIndex = Number(process.argv[workerIndex + 2]);
  const origin = process.argv[workerIndex + 3];
  const browserType = new Map(browsers).get(browserName);
  const testCase = cases[caseIndex];
  expect(browserType && testCase && origin, "Invalid browser regression worker arguments");

  const browser = await browserType.launch({ headless: true });
  try {
    console.log(await auditBirthdayHero(browser, browserName, origin, testCase));
    console.log(await auditPage(browser, browserName, origin, testCase));
  } finally {
    await browser.close().catch(() => {});
  }
} else {
  const testRoot = await prepareTestSite(process.argv[2]);
  const server = await startSiteServer(testRoot);
  const results = [];
  const scriptPath = fileURLToPath(import.meta.url);
  try {
    for (const [name] of browsers) {
      for (const [caseIndex, testCase] of cases.entries()) {
        console.log(`[browser-regression] ${name} ${testCase.name}`);
        const { stdout, stderr } = await execFileAsync(
          process.execPath,
          [scriptPath, workerMarker, name, String(caseIndex), server.origin],
          { maxBuffer: 10 * 1024 * 1024, timeout: 10 * 60 * 1000 },
        );
        if (stderr) process.stderr.write(stderr);
        results.push(stdout.trim());
      }
    }
  } finally {
    await server.close();
  }

  console.log(results.join("\n"));
}
