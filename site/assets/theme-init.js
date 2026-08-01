try {
  const root = document.documentElement;
  root.classList.add("js");
  const theme = localStorage.getItem("theme");

  if (theme === "light" || theme === "dark") {
    root.dataset.theme = theme;
  }

  const resolvedTheme =
    theme === "light" || theme === "dark"
      ? theme
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";

  root.classList.toggle("theme-dark", resolvedTheme === "dark");
  root.classList.toggle("theme-light", resolvedTheme === "light");
} catch {}
