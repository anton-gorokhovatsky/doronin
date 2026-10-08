import { expect } from "../check-assertions.mjs";
import { entryMenuSpecs } from "./entry-menu.mjs";
import { calendarSpecs } from "./calendar.mjs";
import { proofPartnerSpecs } from "./proof-partners.mjs";
import { diarySpecs } from "./diary.mjs";
import { closingPhaseSpecs } from "./closing-phases.mjs";

const specs = [
  ...entryMenuSpecs,
  ...calendarSpecs,
  ...proofPartnerSpecs,
  ...diarySpecs,
  ...closingPhaseSpecs,
];

const targetCaptureScopes = new Map([
  [".hero__evidence", "fragment"],
  [".athlete", "section"],
  [".diary-live", "section"],
  [".calendar-program__row--finish", "fragment"],
  [".site-footer__intro", "fragment"],
  [".calendar-poster", "fragment"],
  [".bike-calendar__details", "fragment"],
  [".calendar-current", "fragment"],
  [".diary-story:not([hidden]) .diary-story__heading", "fragment"],
  [".manifesto__copy", "fragment"],
  [".calendar-program__list", "fragment"],
  ["#calendar-segment-10", "fragment"],
  [".calendar-program__rhythm", "fragment"],
  [".achievement-grid", "fragment"],
  [".partners__closing", "fragment"],
  [".proof-source", "fragment"],
  [".partner-formats__list", "fragment"],
  [".diary-archive", "fragment"],
  [".diary-stories", "section"],
  [".diary-story:not([hidden])", "fragment"],
  [".diary-story:not([hidden]) .diary__gallery", "fragment"],
  [".story-frame:nth-child(3)", "fragment"],
]);

export const screenshotSpecs = specs.map((spec) => {
  if (!spec.target) return { ...spec, captureScope: "viewport" };

  const captureScope = targetCaptureScopes.get(spec.target);
  expect(
    captureScope,
    `${spec.name}: target ${spec.target} must declare section or fragment scope`,
  );

  return {
    ...spec,
    name: `${spec.name}-${captureScope}`,
    captureScope,
  };
});
