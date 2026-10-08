import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);
export async function prepareTestSite(root) {
  if (root) return root;
  await execFileAsync(process.execPath, ["src/build.mjs", "preview"]);
  return "preview";
}
export function selectBrowserEngines(launchers, legacyVariable) {
  const requested = process.env[legacyVariable] ?? process.env.CHECK_ENGINES ?? Object.keys(launchers).join(",");
  const names = [...new Set(requested.split(",").map(name => name.trim()).filter(Boolean))];
  if (!names.length || names.some(name => !Object.hasOwn(launchers, name))) throw new Error("Unknown or empty browser engines: " + requested);
  return names.map(name => [name, launchers[name]]);
}
