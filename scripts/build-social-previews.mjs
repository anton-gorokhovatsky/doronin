import { chromium } from "playwright";
import { resolve } from "node:path";

import { startSiteServer } from "./lib/site-server.mjs";

const previews = [
  {
    file: "share-ru-bike-20260817.jpg",
    lang: "ru",
    date: "1–31 декабря 2026",
    name: "Виктор Доронин",
    distance: "11 111",
    unit: "км",
    line: "31 день на велосипеде",
  },
  {
    file: "share-en-bike-20260817.jpg",
    lang: "en",
    date: "December 1–31, 2026",
    name: "Viktor Doronin",
    distance: "11,111",
    unit: "km",
    line: "31 days by bike",
  },
];

const server = await startSiteServer("src/assets");
const browser = await chromium.launch({ headless: true });

try {
  for (const preview of previews) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    await page.setContent(
      `<!doctype html>
      <html lang="${preview.lang}">
        <head>
          <base href="${server.origin}/">
          <style>
            @font-face {
              font-family: "Commissioner";
              src: url("fonts/Commissioner-Cyrillic.woff2") format("woff2");
              font-weight: 400 800;
              font-display: block;
            }
            @font-face {
              font-family: "Commissioner";
              src: url("fonts/Commissioner-Latin.woff2") format("woff2");
              font-weight: 400 800;
              font-display: block;
            }
            @font-face {
              font-family: "Micra";
              src: url("fonts/Micra-Bold.woff") format("woff");
              font-weight: 700;
              font-display: block;
            }
            * { box-sizing: border-box; }
            html, body { width: 1200px; height: 630px; margin: 0; }
            body {
              background: #02160f;
              color: #f1f5ed;
              font-family: "Commissioner", Arial, sans-serif;
            }
            main {
              position: relative;
              isolation: isolate;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              width: 100%;
              height: 100%;
              padding: 42px 50px 44px;
              overflow: hidden;
              background: url("share-bike-source.jpg") 50% 50% / cover no-repeat;
            }
            main::before {
              position: absolute;
              z-index: -1;
              inset: 0;
              background:
                linear-gradient(90deg, rgb(2 22 15 / 0.92) 0%, rgb(2 22 15 / 0.7) 34%, rgb(2 22 15 / 0.08) 64%),
                linear-gradient(0deg, rgb(2 22 15 / 0.82) 0%, transparent 52%);
              content: "";
            }
            header {
              display: flex;
              align-items: flex-start;
              justify-content: space-between;
              gap: 32px;
            }
            header img { width: 104px; height: auto; }
            header p, section p { margin: 0; }
            header p, .name {
              font-size: 19px;
              font-weight: 760;
              letter-spacing: 0.08em;
              text-transform: uppercase;
            }
            section { max-width: 900px; }
            .name { margin-bottom: 18px; }
            h1 {
              display: flex;
              align-items: baseline;
              gap: 14px;
              margin: 0;
              font-family: "Micra", "Arial Black", sans-serif;
              font-size: 108px;
              font-weight: 700;
              letter-spacing: -0.025em;
              line-height: 0.88;
              text-transform: uppercase;
            }
            h1 > span {
              word-spacing: -0.1em;
            }
            h1 small {
              font-size: 0.34em;
              letter-spacing: 0.015em;
            }
            .line {
              width: fit-content;
              margin-top: 18px;
              padding: 9px 12px 8px;
              background: #dfff38;
              color: #041f15;
              font-family: "Micra", "Arial Black", sans-serif;
              font-size: 24px;
              line-height: 1;
              text-transform: uppercase;
            }
          </style>
        </head>
        <body>
          <main>
            <header>
              <img src="logo.svg" alt="">
              <p>${preview.date}</p>
            </header>
            <section>
              <p class="name">${preview.name}</p>
              <h1><span>${preview.distance}</span><small>${preview.unit}</small></h1>
              <p class="line">${preview.line}</p>
            </section>
          </main>
        </body>
      </html>`,
      { waitUntil: "networkidle" },
    );
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: resolve("src/assets", preview.file),
      type: "jpeg",
      quality: 90,
    });
    await page.close();
    process.stdout.write(`Built src/assets/${preview.file}\n`);
  }
} finally {
  await browser.close();
  await server.close();
}
