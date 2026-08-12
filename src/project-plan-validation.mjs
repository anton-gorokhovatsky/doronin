const topLevelKeys = [
  "version",
  "status",
  "period",
  "targetDistanceKm",
  "baselineDistanceKm",
  "preFinalCheckpointKm",
  "specialSequenceKm",
  "segments",
  "unconfirmedFacts",
];
const segmentKeys = [
  "id",
  "kind",
  "startDate",
  "endDate",
  "calendarDays",
  "totalDistanceKm",
  "dailyDistanceKm",
  "continuous",
];
const dayMs = 24 * 60 * 60 * 1000;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  return (
    isPlainObject(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort())
  );
}

function parseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value
    ? null
    : date;
}

function inclusiveDays(start, end) {
  return Math.round((end.valueOf() - start.valueOf()) / dayMs) + 1;
}

export function validateProjectPlan(plan) {
  const errors = [];

  if (!hasExactKeys(plan, topLevelKeys)) {
    return ["top-level keys must match project-plan.schema.json"];
  }

  if (plan.version !== 1) errors.push("version must equal 1");
  if (plan.status !== "approved-concept") {
    errors.push("status must equal approved-concept");
  }
  if (!hasExactKeys(plan.period, ["startDate", "finishDate"])) {
    errors.push("period must contain only startDate and finishDate");
  }

  const periodStart = parseDate(plan.period?.startDate);
  const periodFinish = parseDate(plan.period?.finishDate);
  if (!periodStart || !periodFinish || periodStart > periodFinish) {
    errors.push("period must contain a valid chronological date range");
  }
  if (plan.targetDistanceKm !== 11111) {
    errors.push("targetDistanceKm must equal 11111");
  }
  if (plan.baselineDistanceKm !== 333) {
    errors.push("baselineDistanceKm must equal 333");
  }
  if (plan.preFinalCheckpointKm !== 10000) {
    errors.push("preFinalCheckpointKm must equal 10000");
  }
  if (
    !Array.isArray(plan.specialSequenceKm) ||
    JSON.stringify(plan.specialSequenceKm) !== JSON.stringify([333, 555, 777, 999, 1111])
  ) {
    errors.push("specialSequenceKm must equal 333, 555, 777, 999, 1111");
  }
  if (
    !Array.isArray(plan.unconfirmedFacts) ||
    plan.unconfirmedFacts.length === 0 ||
    plan.unconfirmedFacts.some(
      (fact) => typeof fact !== "string" || fact.trim().length === 0,
    ) ||
    new Set(plan.unconfirmedFacts).size !== plan.unconfirmedFacts.length
  ) {
    errors.push("unconfirmedFacts must contain unique non-empty identifiers");
  }
  if (!Array.isArray(plan.segments) || plan.segments.length === 0) {
    errors.push("segments must be a non-empty array");
    return errors;
  }

  const ids = new Set();
  const coveredDates = new Set();
  const validSegments = [];

  for (const [index, segment] of plan.segments.entries()) {
    const prefix = `segments[${index}]`;
    if (!hasExactKeys(segment, segmentKeys)) {
      errors.push(`${prefix} keys must match project-plan.schema.json`);
      continue;
    }
    if (!/^[a-z0-9-]+$/.test(segment.id)) {
      errors.push(`${prefix}.id must use lowercase ASCII, digits and hyphens`);
    }
    if (ids.has(segment.id)) errors.push(`${prefix}.id must be unique`);
    ids.add(segment.id);
    if (!["base", "special", "finish"].includes(segment.kind)) {
      errors.push(`${prefix}.kind is invalid`);
    }

    const start = parseDate(segment.startDate);
    const end = parseDate(segment.endDate);
    if (!start || !end || start > end) {
      errors.push(`${prefix} must contain a valid chronological date range`);
      continue;
    }
    const expectedDays = inclusiveDays(start, end);
    if (!Number.isInteger(segment.calendarDays) || segment.calendarDays !== expectedDays) {
      errors.push(`${prefix}.calendarDays must equal ${expectedDays}`);
    }
    if (
      !Number.isInteger(segment.totalDistanceKm) ||
      segment.totalDistanceKm < 0
    ) {
      errors.push(`${prefix}.totalDistanceKm must be a non-negative integer`);
    }
    if (typeof segment.continuous !== "boolean") {
      errors.push(`${prefix}.continuous must be boolean`);
    }

    if (segment.kind === "base") {
      if (!Number.isInteger(segment.dailyDistanceKm) || segment.dailyDistanceKm <= 0) {
        errors.push(`${prefix}: a base segment requires dailyDistanceKm`);
      } else if (
        segment.totalDistanceKm !== segment.dailyDistanceKm * segment.calendarDays
      ) {
        errors.push(`${prefix}: base total must equal daily distance × calendar days`);
      }
      if (segment.continuous !== false) {
        errors.push(`${prefix}: a base segment is not one continuous multi-day ride`);
      }
    }
    if (segment.kind === "special") {
      if (segment.dailyDistanceKm !== null || segment.continuous !== true) {
        errors.push(`${prefix}: a special stage is one continuous ride with no daily split`);
      }
      if (segment.totalDistanceKm <= 0) {
        errors.push(`${prefix}: a special stage requires a positive distance`);
      }
    }
    if (segment.kind === "finish") {
      if (
        segment.dailyDistanceKm !== null ||
        segment.continuous !== false ||
        segment.totalDistanceKm !== 0 ||
        segment.calendarDays !== 1
      ) {
        errors.push(`${prefix}: finish must be a one-day zero-distance marker`);
      }
    }

    for (let timestamp = start.valueOf(); timestamp <= end.valueOf(); timestamp += dayMs) {
      const date = new Date(timestamp).toISOString().slice(0, 10);
      if (coveredDates.has(date)) errors.push(`${prefix}: date ${date} is duplicated`);
      coveredDates.add(date);
    }
    validSegments.push({ ...segment, start, end });
  }

  if (periodStart && periodFinish && validSegments.length) {
    for (
      let timestamp = periodStart.valueOf();
      timestamp <= periodFinish.valueOf();
      timestamp += dayMs
    ) {
      const date = new Date(timestamp).toISOString().slice(0, 10);
      if (!coveredDates.has(date)) errors.push(`calendar date ${date} is not covered`);
    }
    if (
      validSegments.some(
        ({ start, end }) => start < periodStart || end > periodFinish,
      )
    ) {
      errors.push("all segments must remain inside the project period");
    }
  }

  const totalDistance = validSegments.reduce(
    (sum, segment) => sum + segment.totalDistanceKm,
    0,
  );
  if (totalDistance !== plan.targetDistanceKm) {
    errors.push(`segment distances must total ${plan.targetDistanceKm}, got ${totalDistance}`);
  }
  const baseSegments = validSegments.filter(({ kind }) => kind === "base");
  const specialSegments = validSegments.filter(({ kind }) => kind === "special");
  const finishSegments = validSegments.filter(({ kind }) => kind === "finish");
  const baseDays = baseSegments.reduce((sum, segment) => sum + segment.calendarDays, 0);
  const specialDays = specialSegments.reduce(
    (sum, segment) => sum + segment.calendarDays,
    0,
  );
  if (baseDays !== 22) errors.push(`base segments must cover 22 days, got ${baseDays}`);
  if (specialDays !== 8) {
    errors.push(`special stages must occupy 8 calendar days, got ${specialDays}`);
  }
  if (specialSegments.length !== 5) {
    errors.push(`the plan must contain 5 special stages, got ${specialSegments.length}`);
  }
  if (finishSegments.length !== 1 || finishSegments[0]?.startDate !== plan.period.finishDate) {
    errors.push("the plan must contain one finish marker on finishDate");
  }

  const sequence = specialSegments.map(({ totalDistanceKm }) => totalDistanceKm);
  if (JSON.stringify(sequence) !== JSON.stringify(plan.specialSequenceKm)) {
    errors.push("special stages must follow specialSequenceKm chronologically");
  }
  const finalStage = specialSegments.at(-1);
  if (finalStage) {
    const beforeFinalDistance = validSegments
      .filter(({ end }) => end < finalStage.start)
      .reduce((sum, segment) => sum + segment.totalDistanceKm, 0);
    if (beforeFinalDistance !== plan.preFinalCheckpointKm) {
      errors.push(
        `distance before the final stage must equal ${plan.preFinalCheckpointKm}, got ${beforeFinalDistance}`,
      );
    }
  }

  const baselineDays = baseSegments.reduce(
    (sum, segment) =>
      sum +
      (segment.dailyDistanceKm === plan.baselineDistanceKm
        ? segment.calendarDays
        : 0),
    0,
  );
  const precisionDays = baseSegments.reduce(
    (sum, segment) => sum + (segment.dailyDistanceKm === 338 ? segment.calendarDays : 0),
    0,
  );
  if (baselineDays !== 20 || precisionDays !== 2) {
    errors.push(
      `base rhythm must contain 20 × ${plan.baselineDistanceKm} km days and 2 × 338 km days`,
    );
  }

  return errors;
}
