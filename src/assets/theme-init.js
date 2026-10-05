import { dubaiClock, solarTheme } from "./solar-clock.js";

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
