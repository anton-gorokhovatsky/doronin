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
