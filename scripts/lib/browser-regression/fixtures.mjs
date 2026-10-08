import { readFile } from "node:fs/promises";
import { createDiaryContent } from "../../../src/content/diary/index.mjs";

export const projectPlan = JSON.parse(await readFile(new URL("../../../src/project-plan.json", import.meta.url), "utf8"));
export const diaryEntries = createDiaryContent("ru").entries;
export const diaryEntryCount = diaryEntries.length;
const diaryMedia = diaryEntries.flatMap((entry) => entry.media);
export const diaryVideoMediaCount = diaryMedia.filter(
  (media) => media.kind === "video",
).length;
export const diaryImageMediaCount = diaryMedia.length - diaryVideoMediaCount;
export const mixedDiaryEntryIndex = diaryEntries.findIndex(
  (entry) => entry.date === "2026-07-06",
);
export const mixedDiaryEntry = diaryEntries[mixedDiaryEntryIndex];
