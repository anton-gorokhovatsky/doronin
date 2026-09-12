const localizedKeys = ["ru", "en"];

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  return (
    isPlainObject(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort())
  );
}

function isNullableLocalized(value, allowNull) {
  return (
    hasExactKeys(value, localizedKeys) &&
    localizedKeys.every((key) =>
      allowNull
        ? value[key] === null || typeof value[key] === "string"
        : typeof value[key] === "string" && value[key].trim().length > 0,
    )
  );
}

function validateSnapshot(status) {
  const errors = [];
  const topLevelKeys = [
    "version",
    "verified",
    "updatedAt",
    "distanceKm",
    "discipline",
    "note",
    "source",
  ];

  if (!hasExactKeys(status, topLevelKeys)) {
    errors.push("top-level keys must match project-status.schema.json");
    return errors;
  }
  if (status.version !== 1) errors.push("version must equal 1");
  if (status.verified !== true) return [...errors, "history accepts only verified snapshots"];
  if (!isNullableLocalized(status.note, true)) {
    errors.push("note must contain only nullable ru/en strings");
  }
  if (
    !hasExactKeys(status.source, ["label", "url"]) ||
    !isNullableLocalized(status.source?.label, true)
  ) {
    errors.push("source must contain localized label and url");
  }

  if (status.verified) {
    if (
      typeof status.updatedAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(status.updatedAt) ||
      Number.isNaN(Date.parse(status.updatedAt))
    ) {
      errors.push("verified status requires an ISO date-time updatedAt");
    }
    if (
      !Number.isFinite(status.distanceKm) ||
      status.distanceKm < 0 ||
      status.distanceKm > 11111
    ) {
      errors.push("verified distanceKm must be between 0 and 11111");
    }
    if (!isNullableLocalized(status.discipline, false)) {
      errors.push("verified status requires ru/en discipline labels");
    }
    if (!isNullableLocalized(status.source?.label, false)) {
      errors.push("verified status requires ru/en source labels");
    }
    try {
      const sourceUrl = new URL(status.source?.url);
      if (sourceUrl.protocol !== "https:") {
        errors.push("verified source url must use https");
      }
    } catch {
      errors.push("verified status requires a valid source url");
    }
  }

  return errors;
}

// One append-only record is the source for the current status and its history.
export function validateProjectStatus(log, now = Date.now()) {
  if (!hasExactKeys(log, ['version', 'entries']) || log.version !== 2 || !Array.isArray(log.entries)) {
    return ['project status must be a version 2 history with an entries array'];
  }
  const errors = [];
  let previousTime = -Infinity;
  let previousDistance = 0;
  for (const [index, entry] of log.entries.entries()) {
    errors.push(...validateSnapshot(entry).map(error => `entry ${index + 1}: ${error}`));
    if (!entry?.verified) errors.push(`entry ${index + 1}: only verified updates belong in history`);
    const time = Date.parse(entry?.updatedAt);
    if (time <= previousTime) errors.push(`entry ${index + 1}: timestamps must strictly increase`);
    if (time < Date.parse('2026-12-01T00:00:00+04:00')) errors.push(`entry ${index + 1}: project distance cannot precede the start`);
    if (time > now + 60000) errors.push(`entry ${index + 1}: an update cannot be published in the future`);
    if (entry?.distanceKm < previousDistance) errors.push(`entry ${index + 1}: cumulative distance cannot decrease; correct the original record explicitly`);
    previousTime = time;
    previousDistance = entry?.distanceKm;
  }
  return errors;
}

export function currentProjectStatus(log) {
  return log.entries.at(-1) || {
    version: 1, verified: false, updatedAt: null, distanceKm: null,
    discipline: { ru: null, en: null }, note: { ru: null, en: null },
    source: { label: { ru: null, en: null }, url: null },
  };
}
