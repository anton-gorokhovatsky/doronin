export const staticChecks = [
  { id: "rules", label: "Rules and check references", script: "scripts/validate-checks.mjs" },
  { id: "harness", label: "Check system regression", script: "scripts/check-system.test.mjs", nodeArgs: ["--test"], args: ["scripts/lib/site-server.test.mjs"] },
  { id: "plan", label: "Project plan", script: "scripts/validate-project-plan.mjs" },
  { id: "status", label: "Status schema", script: "scripts/validate-project-status.mjs" },
  { id: "data", label: "Journey and environmental data", script: "scripts/journey-check.mjs" },
  { id: "build", label: "Production build", script: "src/build.mjs", args: ["site"] },
  { id: "contract", label: "Static contract", script: "src/check.mjs", args: ["site"] },
];
export const browserChecks = [
  { id: "a11y", label: "Accessibility", script: "scripts/accessibility-gate.mjs" },
  { id: "browser", label: "Page interactions", script: "scripts/browser-regression.mjs" },
  { id: "appearance", label: "Automatic and manual appearance", script: "scripts/appearance-check.mjs" },
  { id: "film", label: "Archival film playback and sound", script: "scripts/ride-film-check.mjs" },
  { id: "light", label: "Dubai light and data fallbacks", script: "scripts/dubai-light-check.mjs" },
  { id: "journey", label: "Journey interactions and reflow", script: "scripts/journey-browser-check.mjs" },
  { id: "diary", label: "Diary widget scrolling, hover and keyboard", script: "scripts/diary-widget-check.mjs" },
  { id: "screenshots", label: "Rendered scenario captures", script: "scripts/screenshot-gate.mjs" },
].map(check => ({ ...check, args: ["site"] }));
export function selectChecks(args) {
  const selected = [];
  let full = false;
  let list = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--full") full = true;
    else if (arg === "--list") list = true;
    else if (arg === "--check") {
      const id = args[++index];
      if (!browserChecks.some(check => check.id === id)) throw new Error("Unknown check: " + (id ?? "missing name"));
      selected.push(id);
    } else throw new Error("Unknown option: " + arg);
  }
  if (full && selected.length) throw new Error("Choose --full or --check, not both");
  const checks = [...staticChecks, ...browserChecks.filter(check => full || selected.includes(check.id)),
    { id: "whitespace", label: "Whitespace/errors", command: "git", args: ["diff", "--check"] }];
  return { full, list, checks };
}
