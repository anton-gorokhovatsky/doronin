(() => {
// Shared by the first-paint theme, the live light and the historical replay.
// Venue: centre of Challenge_1111KM.gpx; confirmed September 12, 2026.
// Solar equations: https://gml.noaa.gov/grad/solcalc/solareqns.PDF
const DUBAI = { latitude: 25.1654, longitude: 55.2851, offset: 4 };
const RAD = Math.PI / 180;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function dubaiClock(now = new Date()) {
  const local = new Date(now.getTime() + DUBAI.offset * 3600000);
  return { date: local.toISOString().slice(0, 10), minutes: local.getUTCHours() * 60 + local.getUTCMinutes() };
}

function solarPosition(date, minutes) {
  const day = new Date(`${date}T12:00:00Z`);
  const year = day.getUTCFullYear();
  const ordinal = Math.floor((day - Date.UTC(year, 0, 1)) / 86400000) + 1;
  const days = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000;
  // Daily solar terms use noon, keeping that day's sunrise/sunset stable as time moves.
  const gamma = 2 * Math.PI / days * (ordinal - 1);
  const equation = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const declination = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const latitude = DUBAI.latitude * RAD;
  const noon = 720 - 4 * DUBAI.longitude - equation + DUBAI.offset * 60;
  const halfDay = Math.acos(clamp((Math.cos(90.833 * RAD) / Math.cos(latitude) / Math.cos(declination)) - Math.tan(latitude) * Math.tan(declination), -1, 1)) / RAD * 4;
  const hourAngle = (minutes - noon) / 4 * RAD;
  const altitude = Math.asin(clamp(Math.sin(latitude) * Math.sin(declination) + Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle), -1, 1)) / RAD;
  const azimuth = (Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(latitude) - Math.tan(declination) * Math.cos(latitude)) / RAD + 180 + 360) % 360;
  const phase = altitude < -6 ? 'night' : altitude < 12 ? (minutes < noon ? 'dawn' : 'sunset') : 'day';
  return { altitude, azimuth, phase, sunrise: noon - halfDay, sunset: noon + halfDay, noon };
}

function solarTheme(date, minutes) {
  const sun = solarPosition(date, minutes);
  // Sunset is not yet darkness: use the same civil-twilight boundary as the
  // scene palette, in both directions. Manual theme choices remain independent.
  return sun.phase === 'night' ? 'dark' : 'light';
}


const root = document.documentElement;
root.classList.add("js");
let preference = "auto";
try {
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") preference = stored;
} catch { /* Automatic light does not depend on storage. */ }
const clock = dubaiClock();
try {
  const saved = JSON.parse(sessionStorage.getItem("11111-dubai-light"));
  if (saved?.mode === "preview" && Number.isFinite(saved.minutes)) {
    clock.date = root.dataset.projectStart;
    clock.minutes = Math.max(0, Math.min(1439, saved.minutes));
  }
} catch { /* Use today's light if preview storage is unavailable. */ }
root.dataset.theme = preference;
root.dataset.solarTheme = solarTheme(clock.date, clock.minutes);
const resolved = preference === "auto" ? root.dataset.solarTheme : preference;
root.classList.toggle("theme-dark", resolved === "dark");
root.classList.toggle("theme-light", resolved === "light");

// One dated greeting, on the user's Moscow calendar day. It is independent
// of the Dubai weather preview and expires even in a tab left open overnight.
const birthdayStart = Date.parse("2026-10-05T00:00:00+03:00");
const birthdayEnd = Date.parse("2026-10-06T00:00:00+03:00");
let birthdayTimer;
function syncBirthdayGreeting() {
  clearTimeout(birthdayTimer);
  if (root.hasAttribute("data-birthday-archive")) {
    root.classList.add("has-birthday-greeting");
    return;
  }
  const now = Date.now();
  root.classList.toggle("has-birthday-greeting", now >= birthdayStart && now < birthdayEnd);
  const nextBoundary = now < birthdayStart ? birthdayStart : birthdayEnd;
  if (now < nextBoundary) {
    birthdayTimer = setTimeout(syncBirthdayGreeting, Math.min(nextBoundary - now, 86_400_000));
  }
}
syncBirthdayGreeting();
window.addEventListener("pageshow", syncBirthdayGreeting);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) syncBirthdayGreeting();
});

})();
