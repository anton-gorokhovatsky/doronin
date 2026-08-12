import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { validateProjectPlan } from "../src/project-plan-validation.mjs";

const plan = JSON.parse(await readFile(resolve("src/project-plan.json"), "utf8"));
const errors = validateProjectPlan(plan);

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  const distance = new Intl.NumberFormat("ru-RU").format(plan.targetDistanceKm);
  console.log(
    `Approved cycling plan: ${distance} km · ${plan.segments.length} segments · ${plan.period.startDate}—${plan.period.finishDate}`,
  );
}
