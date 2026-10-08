import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const full = process.argv.includes("--full");
const browserRegressionRunsSeparately =
  process.env.CI_BROWSER_REGRESSION_JOB === "separate";
const steps = [
  ["Project plan", process.execPath, ["scripts/validate-project-plan.mjs"]],
  ["Status schema", process.execPath, ["scripts/validate-project-status.mjs"]],
  ["Journey and environmental data", process.execPath, ["scripts/journey-check.mjs"]],
  ["Production build", process.execPath, ["src/build.mjs", "site"]],
  ["Static contract", process.execPath, ["src/check.mjs", "site"]],
  ...(full ? [
    ["Accessibility matrix", process.execPath, ["scripts/accessibility-gate.mjs"]],
    ...(!browserRegressionRunsSeparately ? [
      ["Chromium/WebKit regression", process.execPath, ["scripts/browser-regression.mjs"]],
    ] : []),
    ["Automatic appearance", process.execPath, ["scripts/appearance-check.mjs", "site"]],
    ["Archival film playback and sound", process.execPath, ["scripts/ride-film-check.mjs", "site"]],
    ["Dubai light and data fallbacks", process.execPath, ["scripts/dubai-light-check.mjs", "site"]],
    ["Journey interactions and reflow", process.execPath, ["scripts/journey-browser-check.mjs"]],
    ["Screenshot gate", process.execPath, ["scripts/screenshot-gate.mjs"]],
  ] : []),
  ["Whitespace/errors", "git", ["diff", "--check"]],
];

for (const [label, executable, args] of steps) {
  process.stdout.write(`\n[gate] ${label}\n`);
  const { stdout, stderr } = await execFileAsync(executable, args, {
    cwd: process.cwd(),
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
}

process.stdout.write(full
  ? "\nFull site checks passed.\n"
  : "\nBuild and static release checks passed.\n");
