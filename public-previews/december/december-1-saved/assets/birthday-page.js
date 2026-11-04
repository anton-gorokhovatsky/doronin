// The archive uses the site's saved motion preference and the same hero player.
const birthdaySystemMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let birthdaySavedMotion = false;
try { birthdaySavedMotion = localStorage.getItem("motion") === "reduced"; } catch {}
const birthdayMotion = {
  get matches() { return birthdaySavedMotion || birthdaySystemMotion.matches; },
  addEventListener(type, listener) {
    birthdaySystemMotion.addEventListener(type, () => listener({ matches: this.matches }));
  },
};
const birthdayRoot = document.documentElement;
const birthdayParameters = new URLSearchParams(window.location.search);
const birthdayTheme = birthdayParameters.get("theme");
if (["light", "dark", "auto"].includes(birthdayTheme)) birthdayRoot.dataset.theme = birthdayTheme;
const birthdayResolvedTheme = birthdayRoot.dataset.theme === "auto"
  ? birthdayRoot.dataset.solarTheme : birthdayRoot.dataset.theme;
birthdayRoot.classList.toggle("theme-dark", birthdayResolvedTheme === "dark");
birthdayRoot.classList.toggle("theme-light", birthdayResolvedTheme === "light");
for (const meta of document.querySelectorAll("[data-theme-color]")) {
  meta.media = meta.dataset.themeColor === birthdayResolvedTheme ? "all" : "not all";
}
if (/^(?:127(?:\.\d{1,3}){3}|localhost|\[::1\])$/i.test(location.hostname) && birthdayParameters.get("text") === "200") {
  birthdayRoot.dataset.textFixture = "200";
}
function syncBirthdayTextSize() {
  birthdayRoot.classList.toggle("text-enlarged", birthdayRoot.dataset.textFixture === "200" ||
    Number.parseFloat(getComputedStyle(birthdayRoot).fontSize) >= 24);
}
syncBirthdayTextSize();
window.addEventListener("resize", syncBirthdayTextSize, { passive: true });
setupHeroMedia(birthdayMotion);
