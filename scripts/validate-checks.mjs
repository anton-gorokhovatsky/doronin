import { execFile } from "node:child_process";
import { promisify } from "node:util";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { staticChecks, browserChecks } from "./lib/check-registry.mjs";
const checks = [...staticChecks, ...browserChecks];
assert.equal(new Set(checks.map(check => check.id)).size, checks.length, "Check IDs must be unique");
const execFileAsync = promisify(execFile);
// Follow local imports: extracted scenarios are part of the registered check.
const checkedModules = new Set();
async function validateModule(file) {
  const path = resolve(file);
  if (checkedModules.has(path)) return;
  checkedModules.add(path);
  await access(path);
  const source = await readFile(path, "utf8");
  await execFileAsync(process.execPath, ["--check", path]);
  const imports = [...source.matchAll(/(?:from\s+|import\s+)["'](\.{1,2}\/[^"']+\.(?:mjs|js))["']/g)];
  await Promise.all(imports.map(([, target]) => validateModule(resolve(dirname(path), target))));
}
await Promise.all(checks.map(check => validateModule(check.script)));
const pkg = JSON.parse(await readFile("package.json", "utf8"));
for (const [name, command] of Object.entries(pkg.scripts)) {
  for (const match of command.matchAll(/\b(?:src|scripts)\/[\w./-]+\.mjs\b/g)) {
    try { await access(match[0]); }
    catch { throw new Error("Command " + name + " refers to missing " + match[0]); }
  }
}
const documents = ["AGENTS.md", "README.md", "docs/verification.md", "docs/nng-ux-rules.md", "docs/product-rules.md", "docs/design-evals.md"];
let links = 0;
for (const file of documents) {
  const text = await readFile(file, "utf8");
  for (const match of text.matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
    const target = match[1];
    if (/^(?:[a-z]+:|#|\/)/i.test(target)) continue;
    const path = decodeURIComponent(target.split("#")[0]);
    if (!path) continue;
    try { await access(resolve(dirname(file), path)); }
    catch { throw new Error(file + ": missing local link " + target); }
    links++;
  }
  const tick = String.fromCharCode(96);
  for (const match of text.matchAll(new RegExp(tick + "((?:src|scripts)/[\\w./-]+\\.mjs)" + tick, "g"))) {
    try { await access(match[1]); }
    catch { throw new Error(file + ": missing script " + match[1]); }
  }
}
assert.equal(pkg.scripts.gate, "node scripts/release-gate.mjs");
assert.equal(pkg.scripts["gate:full"], "node scripts/release-gate.mjs --full");
console.log("Rules/check registry: " + checks.length + " checks, " + checkedModules.size + " modules, " + documents.length + " documents, " + links + " local links valid.");

const publish = await readFile(".github/workflows/pages.yml", "utf8");
assert.match(publish, /run: pnpm gate\s*$/m, "Publishing must call the static gate");
assert(!/gate:full|--full|playwright|release-scope|comparison_base/.test(publish), "Browser/full scope work must stay outside publishing");
const quality = await readFile(".github/workflows/quality.yml", "utf8");
assert.match(quality, /workflow_dispatch:/);
const triggers = quality.slice(quality.indexOf("\non:\n"), quality.indexOf("\npermissions:"));
assert(!/\n  (?:push|pull_request|schedule):/.test(triggers), "Full checks are an explicit manual workflow");
assert.match(quality, /run: pnpm gate:full/);
console.log("Publishing/full-workflow separation valid.");
