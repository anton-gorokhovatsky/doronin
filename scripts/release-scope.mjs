import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// These shared values are used only as ordinary external anchor destinations.
const linkKeys = [
  "designHref", "photoHref", "viktorTelegramHref", "viktorStravaHref",
  "dustyDumbbellsHref", "gastrodinamikaHref",
];
const full = (reason) => ({ scope: "full", reason, links: [] });

export function classifyChanges(files, before, after) {
  if (files.length !== 1 || files[0] !== "src/build.mjs") {
    return full("Changes are not limited to shared external links");
  }
  let normalized = after;
  const links = [];
  for (const key of linkKeys) {
    const pattern = new RegExp(`^  ${key}: "(https://[^"\\\\\\s<>]+)",$`, "gm");
    const oldMatches = [...before.matchAll(pattern)];
    const newMatches = [...after.matchAll(pattern)];
    if (oldMatches.length !== 1 || newMatches.length !== 1) {
      return full("The shared link structure changed");
    }
    const from = oldMatches[0][1];
    const to = newMatches[0][1];
    if (from === to) continue;
    try {
      const url = new URL(to);
      if (url.protocol !== "https:" || url.username || url.password) {
        return full("Unsupported link destination");
      }
    } catch {
      return full("Invalid link destination");
    }
    normalized = normalized.replace(newMatches[0][0], () => oldMatches[0][0]);
    links.push({ key, from, to });
  }
  return links.length && normalized === before
    ? { scope: "links", reason: "Only ordinary external destinations changed", links }
    : full("Other source changes require the full gate");
}

export function detectReleaseScope({ event = process.env.RELEASE_EVENT, base = process.env.RELEASE_BASE, head = "HEAD", cwd = process.cwd() } = {}) {
  if (event !== "push" || !/^[0-9a-f]{40}$/.test(base || "") || /^0+$/.test(base)) {
    return full("Scheduled, manual or unknown comparison");
  }
  try {
    const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const files = git("diff", "--name-only", "--no-renames", "-z", base, head).split("\0").filter(Boolean);
    if (files.length !== 1 || files[0] !== "src/build.mjs") return full("Other files changed");
    return classifyChanges(files, git("show", `${base}:src/build.mjs`), git("show", `${head}:src/build.mjs`));
  } catch {
    return full("The previous revision is unavailable");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = detectReleaseScope();
  console.log(JSON.stringify(result, null, 2));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `scope=${result.scope}\n`);
}
