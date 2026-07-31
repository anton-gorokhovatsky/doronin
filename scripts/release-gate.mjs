import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const steps = [
  ["Status schema", process.execPath, ["scripts/validate-project-status.mjs"]],
  ["Production build", process.execPath, ["src/build.mjs"]],
  ["Static contract", process.execPath, ["src/check.mjs"]],
  ["Chromium/WebKit regression", process.execPath, ["scripts/browser-regression.mjs"]],
  ["Screenshot gate", process.execPath, ["scripts/screenshot-gate.mjs"]],
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

process.stdout.write("\nRelease gate passed.\n");
