import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { startSiteServer } from "./site-server.mjs";

test("browser fixture server handles media ranges and closes connections", async t => {
  const root = await mkdtemp(join(tmpdir(), "doronin-check-server-"));
  await writeFile(join(root, "index.html"), "<title>fixture</title>");
  await writeFile(join(root, "movie.mp4"), "0123456789");
  const server = await startSiteServer(root);
  t.after(async () => { await server.close(); await rm(root, { recursive: true, force: true }); });
  for (const [range, expected, contentRange] of [
    ["bytes=0-1", "01", "bytes 0-1/10"],
    ["bytes=7-", "789", "bytes 7-9/10"],
    ["bytes=-3", "789", "bytes 7-9/10"],
    ["bytes=8-99", "89", "bytes 8-9/10"],
  ]) {
    const response = await fetch(server.origin + "/movie.mp4", { headers: { Range: range } });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get("content-range"), contentRange);
    assert.equal(await response.text(), expected);
  }
  for (const range of ["bytes=10-", "bytes=5-2", "bytes=-0", "bytes=-", "bytes=0-1,4-5"]) {
    const response = await fetch(server.origin + "/movie.mp4", { headers: { Range: range } });
    assert.equal(response.status, 416);
    assert.equal(response.headers.get("content-range"), "bytes */10");
    await response.text();
  }
  const head = await fetch(server.origin + "/movie.mp4", { method: "HEAD" });
  assert.equal(head.headers.get("content-length"), "10");
  assert.equal(await head.text(), "");
  assert.equal((await fetch(server.origin + "/missing")).status, 404);
});
test("a missing built site fails before opening a browser", async () => {
  await assert.rejects(() => startSiteServer(join(tmpdir(), "doronin-no-such-site")));
});
