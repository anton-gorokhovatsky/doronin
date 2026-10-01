import assert from "node:assert/strict";
import { chromium } from "playwright";
import { detectReleaseScope } from "./release-scope.mjs";
import { startSiteServer } from "./lib/site-server.mjs";

const { scope, links } = detectReleaseScope();
assert.equal(scope, "links", "The short gate requires a verified link-only diff");
const server = await startSiteServer("site");
const browser = await chromium.launch();
try {
  for (const locale of ["ru", "en"]) {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    // Verify navigation without making third-party availability a release dependency.
    await context.route("**/*", (route) => new URL(route.request().url()).origin === server.origin
      ? route.continue()
      : route.fulfill({ status: 200, contentType: "text/html", body: "Link destination" }));
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    await page.goto(`${server.origin}/${locale === "en" ? "en/" : ""}`, { waitUntil: "domcontentloaded" });
    for (const { key, to } of links) {
      const anchors = page.locator(`a[href=${JSON.stringify(to)}]`);
      assert.ok(await anchors.count(), `${locale}: missing ${key}`);
      for (const anchor of await anchors.all()) {
        const attributes = await anchor.evaluate((a) => ({ href: a.href, label: a.getAttribute("aria-label") || a.textContent.trim(), target: a.target, rel: a.rel }));
        assert.equal(attributes.href, new URL(to).href);
        assert.ok(attributes.label, `${locale}: unnamed ${key}`);
        assert.equal(attributes.target, "_blank");
        assert.ok(attributes.rel.split(/\s+/).includes("noopener"));
      }
      const visible = anchors.filter({ visible: true }).first();
      await visible.focus();
      const popupPromise = page.waitForEvent("popup");
      await visible.press("Enter");
      const popup = await popupPromise;
      await popup.waitForLoadState("domcontentloaded");
      assert.equal(popup.url(), new URL(to).href);
      await popup.close();
      console.log(`${locale}: ${key} — correct destination and keyboard navigation`);
    }
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
