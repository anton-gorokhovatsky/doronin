export function replayPoint(data, seconds) {
  let lo = 0, hi = data.points.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (data.points[mid][0] <= seconds) lo = mid; else hi = mid - 1;
  }
  return { index: lo, point: data.points[lo] };
}
export function validReplay(data) {
  if (data?.version !== 1 || data.source !== 'https://www.strava.com/activities/13190277378' || !Array.isArray(data.points) || data.points.length < 2 || data.points.length > 20000) return false;
  const start = Date.parse(data.start), end = Date.parse(data.end);
  if (!['time', 'distance'].includes(data.mode)) return false;
  if (data.mode === 'time' && (!Number.isFinite(start) || !Number.isFinite(end) || !data.start.startsWith('2024-') || end <= start || end - start > 7 * 86400000)) return false;
  if (data.mode === 'distance' && (data.start !== null || data.end !== null)) return false;
  if (!Number.isFinite(data.distanceKm) || data.distanceKm <= 0) return false;
  if (data.timing && (data.mode !== 'time' || data.timing.kind !== 'strava-lap-reconstruction' || data.timing.source !== `${data.source}/laps` || data.timing.lapCount !== 203 || data.timing.startPrecision !== 'minute' || data.timing.elapsedSeconds !== (end-start)/1000)) return false;
  let previous = [-1, -1];
  for (const point of data.points) {
    if (!Array.isArray(point) || point.length !== 4 || point.some(value => !Number.isFinite(value))
      || point[0] <= previous[0] || point[1] < previous[1] || point[2] < 0 || point[2] > 600 || point[3] < 0 || point[3] > 410) return false;
    previous = point;
  }
  return data.points[0][0] === 0 && data.points[0][1] === 0 && (data.mode === 'distance' ? Math.abs(previous[0] - data.distanceKm) < 0.01 : Math.abs(previous[0] - (end-start)/1000) < 2) && Math.abs(previous[1] - data.distanceKm) < 0.01;
}
