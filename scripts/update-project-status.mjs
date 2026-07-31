import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { validateProjectStatus } from "../src/project-status-validation.mjs";

const target = resolve("src/project-status.json");
const flags = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  flags.set(process.argv[index], process.argv[index + 1]);
}

const reset = process.argv.includes("--reset");
const dryRun = process.argv.includes("--dry-run");
let status;

if (reset) {
  status = {
    version: 1,
    verified: false,
    updatedAt: null,
    distanceKm: null,
    discipline: { ru: null, en: null },
    note: { ru: null, en: null },
    source: { label: { ru: null, en: null }, url: null },
  };
} else {
  status = {
    version: 1,
    verified: true,
    updatedAt: flags.get("--updated-at"),
    distanceKm: Number(flags.get("--distance-km")),
    discipline: {
      ru: flags.get("--discipline-ru"),
      en: flags.get("--discipline-en"),
    },
    note: {
      ru: flags.get("--note-ru") || "",
      en: flags.get("--note-en") || "",
    },
    source: {
      label: {
        ru: flags.get("--source-label-ru"),
        en: flags.get("--source-label-en"),
      },
      url: flags.get("--source-url"),
    },
  };
}

const errors = validateProjectStatus(status);
if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

const serialized = `${JSON.stringify(status, null, 2)}\n`;
if (dryRun) {
  process.stdout.write(serialized);
} else {
  await readFile(target, "utf8");
  await writeFile(target, serialized, "utf8");
  console.log(`Updated ${target}`);
}
