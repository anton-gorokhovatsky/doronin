import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { staticChecks, browserChecks, selectChecks } from "./lib/check-registry.mjs";
const options = selectChecks(process.argv.slice(2));
if (options.list) {
  for (const check of [...staticChecks, ...browserChecks]) console.log(check.id.padEnd(12) + " " + check.script);
} else {
  const report = { startedAt: new Date().toISOString(), mode: options.full ? "full" : "focused/static", status: "running", checks: [] };
  const output = "artifacts/gate/automated/checks-report.json";
  await mkdir("artifacts/gate/automated", { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + "\n");
  for (const check of options.checks) {
    if (options.full && check.id === "browser" && process.env.CI_BROWSER_REGRESSION_JOB === "separate") {
      report.checks.push({ id: check.id, status: "separate-ci-job" });
      continue;
    }
    console.log("\n[check] " + check.label);
    const started = performance.now();
    let result;
    try {
      result = await new Promise((resolve, reject) => {
        const child = spawn(check.command ?? process.execPath,
          check.command ? check.args : [...(check.nodeArgs ?? []), check.script, ...(check.args ?? [])],
          { stdio: "inherit", env: process.env, timeout: 20 * 60 * 1000 });
        child.once("error", reject);
        child.once("close", (code, signal) => resolve({ code, signal }));
      });
    } catch (error) {
      result = { code: 1, error: error.message };
    }
    const seconds = Math.round((performance.now() - started) / 100) / 10;
    const status = result.code === 0 ? "passed" : "failed";
    report.checks.push({ id: check.id, status, seconds, ...result });
    report.status = status === "failed" ? "failed" : "running";
    report.finishedAt = new Date().toISOString();
    await writeFile(output, JSON.stringify(report, null, 2) + "\n");
    console.log("[check] " + check.id + ": " + status + " (" + seconds + "s)");
    if (status === "failed") {
      console.error("Stopped at " + check.id + ". Report: " + output);
      process.exitCode = 1;
      break;
    }
  }
  if (!process.exitCode) {
    report.status = "passed";
    report.finishedAt = new Date().toISOString();
    await writeFile(output, JSON.stringify(report, null, 2) + "\n");
    console.log("\nSelected checks passed. Report: " + output);
  }
}
