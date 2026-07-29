const requestedTheme = new URLSearchParams(window.location.search).get("theme");

if (requestedTheme === "dark" || requestedTheme === "light") {
  document.documentElement.dataset.theme = requestedTheme;
}

const eventStatus = document.querySelector("[data-event-status]");

if (eventStatus) {
  const start = new Date(eventStatus.dataset.start);
  const end = new Date(eventStatus.dataset.end);
  const now = new Date();
  const value = eventStatus.querySelector("[data-status-value]");
  const label = eventStatus.querySelector("[data-status-label]");
  const day = 86_400_000;

  if (now < start) {
    const days = Math.max(1, Math.ceil((start - now) / day));
    let form = eventStatus.dataset.beforeMany;

    if (eventStatus.dataset.lang === "ru") {
      const mod10 = days % 10;
      const mod100 = days % 100;

      if (mod10 === 1 && mod100 !== 11) {
        form = eventStatus.dataset.beforeOne;
      } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
        form = eventStatus.dataset.beforeFew;
      }
    } else if (days === 1) {
      form = eventStatus.dataset.beforeOne;
    }

    value.textContent = String(days);
    label.textContent = form;
  } else if (now < end) {
    const projectDay = Math.min(31, Math.floor((now - start) / day) + 1);
    value.textContent = String(projectDay).padStart(2, "0");
    label.textContent = eventStatus.dataset.active;
  } else {
    value.textContent = "31/31";
    label.textContent = eventStatus.dataset.finished;
  }
}

const desktopNavigation = window.matchMedia("(min-width: 961px)");

function syncNavigationMode() {
  for (const navigation of document.querySelectorAll(".nav-shell")) {
    navigation.toggleAttribute("open", desktopNavigation.matches);
  }
}

syncNavigationMode();
desktopNavigation.addEventListener?.("change", syncNavigationMode);

for (const navigation of document.querySelectorAll(".nav-shell")) {
  navigation.addEventListener("click", (event) => {
    if (event.target.closest("a") && !desktopNavigation.matches) {
      navigation.removeAttribute("open");
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !desktopNavigation.matches) {
    for (const navigation of document.querySelectorAll(".nav-shell[open]")) {
      navigation.removeAttribute("open");
      navigation.querySelector("summary")?.focus();
    }
  }
});

for (const languageSwitch of document.querySelectorAll("[data-language-switch]")) {
  languageSwitch.addEventListener("click", () => {
    if (!window.location.hash) {
      return;
    }

    const target = new URL(languageSwitch.href);
    target.hash = window.location.hash;
    languageSwitch.href = target.href;
  });
}
