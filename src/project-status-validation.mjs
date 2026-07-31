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

export function validateProjectStatus(status) {
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
  if (typeof status.verified !== "boolean") errors.push("verified must be boolean");
  if (!isNullableLocalized(status.note, true)) {
    errors.push("note must contain only nullable ru/en strings");
  }
  if (
    !hasExactKeys(status.source, ["label", "url"]) ||
    !isNullableLocalized(status.source.label, true)
  ) {
    errors.push("source must contain localized label and url");
  }

  if (status.verified) {
    if (
      typeof status.updatedAt !== "string" ||
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
    if (!isNullableLocalized(status.source.label, false)) {
      errors.push("verified status requires ru/en source labels");
    }
    try {
      const sourceUrl = new URL(status.source.url);
      if (sourceUrl.protocol !== "https:") {
        errors.push("verified source url must use https");
      }
    } catch {
      errors.push("verified status requires a valid source url");
    }
  } else if (
    status.updatedAt !== null ||
    status.distanceKm !== null ||
    !isNullableLocalized(status.discipline, true) ||
    localizedKeys.some((key) => status.discipline[key] !== null) ||
    localizedKeys.some((key) => status.note[key] !== null) ||
    localizedKeys.some((key) => status.source.label[key] !== null) ||
    status.source.url !== null
  ) {
    errors.push("unverified status must not retain unpublished figures or sources");
  }

  return errors;
}
