# December scenario

Separate, fixed-date preview authorized for public publication on 4 November 2026.

- Current two-day scenario: `/december/december-2.html` and `/december/en/december-2.html`.
- Preserved first-day comparison: `/december/december-1-saved/december-1.html` and its `en/` version.
- The November homepage is built normally. The Pages workflow copies this standalone package afterwards; it does not replace the homepage or add it to navigation or the sitemap.
- The two-day page always represents 2 December 2026, 09:20 Dubai time, including on a public host without query parameters. Its selector keeps the first day's story and photos on the same page. The preserved first-day page retains its own 1 December clock.
- These are future scenario fixtures, not verified live results. Search indexing and analytics are disabled for the package. Public metadata calls it a scenario; editorial provenance stays here rather than appearing as prototype labels in the visitor interface, as requested by the user.

## Materials and preservation

The package freezes the locally reviewed `prototypes/day-two/` result and the saved December 1 snapshot. Layout, authorial first-person text, the site's typography and source photographs are preserved. The publication adaptation changes URLs, metadata and the public-host fixed clock only.

The second story, “Обратный билет из Москвы” / “A Ticket Home from Moscow”, is an editorial first-person draft based on the interview at <https://www.youtube.com/watch?v=FuHM9yD1fa4>, approximately 22:33–26:55. It has not yet been approved by Viktor. The original working content and source notes are in the local `deliverables/start-day-2026-11-03/day-two-content.json`.

All six photographs are original frames from the 2024 film, used to rehearse the future two-day interface. They are not images of December 2026. The second day's originals are `FINAL_MAIN_00_34_00_03.png`, `FINAL_MAIN_00_36_49_18.png`, and `FINAL_MAIN_00_36_51_13.png`. Their PNG compression is optimized without changing pixels; the original size and full-image viewer are preserved.

Run `node scripts/publish-december-preview.mjs` after the normal build. All relative page resources are checked before copying. The package is self-contained so a later homepage rebuild cannot silently alter the reviewed scenario.
