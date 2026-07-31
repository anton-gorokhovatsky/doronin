import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { validateProjectStatus } from "../src/project-status-validation.mjs";

const status = JSON.parse(
  await readFile(resolve("src/project-status.json"), "utf8"),
);
const errors = validateProjectStatus(status);

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    status.verified
      ? `Verified project status: ${status.updatedAt} · ${status.distanceKm} km`
      : "Project status is valid and intentionally unverified.",
  );
}
