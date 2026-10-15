import test from "node:test";
import assert from "node:assert/strict";
import { createVibeLogServer } from "../scripts/server.mjs";
import { buildPages } from "../scripts/build-pages.mjs";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request } from "node:http";

const canonical = "https://vibelog-baokhanh.onrender.com/";

test("crawler đọc trang chủ và sitemap trước đăng nhập; file riêng vẫn bị chặn", async t => {
  const directory = mkdtempSync(join(tmpdir(), "vibelog-seo-"));
  const server = createVibeLogServer({ dataDirectory: directory, origin: "http://localhost:4173",
    clientId: "public.apps.googleusercontent.com", clientSecret: "test-only" });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const page = await fetch(origin);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("x-robots-tag"), null);
  const html = await page.text();
  assert.ok(html.includes(`<link rel="canonical" href="${canonical}"`));
  assert.match(html, /<title>VibeLog.*Nhật ký học tập/);
  assert.match(html, /<p class="hero-copy">VibeLog/);
  assert.doesNotMatch(html, /<meta[^>]+name="robots"[^>]+noindex/);
  for (const [path, type] of [["/robots.txt", "text/plain"], ["/sitemap.xml", "application/xml"]]) {
    const response = await fetch(origin + path);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get("content-type").startsWith(type));
    const body = await response.text();
    assert.ok(body.includes(canonical));
    const head = await fetch(origin + path, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    assert.equal((await fetch(origin + path, { method: "POST" })).status, 405);
  }
  const sitemap = await (await fetch(origin + "/sitemap.xml")).text();
  assert.equal((sitemap.match(/<loc>/g) || []).length, 1);
  assert.doesNotMatch(sitemap, /\/api\/|localhost|github.io/);
  const events = await new Promise((resolve, reject) => {
    const req = request(origin + "/api/calendar/events", { headers: { Host: "localhost:4173" } }, response => {
      response.resume();
      response.on("end", () => resolve(response));
    });
    req.on("error", reject);
    req.end();
  });
  assert.equal(events.statusCode, 401);
  assert.equal(events.headers["x-robots-tag"], "noindex");
  for (const path of ["/.env", "/scripts/server.mjs", "/docs/seo.md", "/missing-page"]) {
    assert.equal((await fetch(origin + path)).status, 404);
  }
});

test("Pages giữ canonical về Render và đóng gói sitemap công khai", t => {
  const output = mkdtempSync(join(tmpdir(), "vibelog-seo-pages-"));
  t.after(() => rmSync(output, { recursive: true, force: true }));
  buildPages({ output, clientId: "public.apps.googleusercontent.com" });
  assert.ok(readFileSync(join(output, "index.html"), "utf8").includes(`href="${canonical}"`));
  assert.ok(readFileSync(join(output, "robots.txt"), "utf8").includes(`Sitemap: ${canonical}sitemap.xml`));
  assert.ok(readFileSync(join(output, "sitemap.xml"), "utf8").includes(`<loc>${canonical}</loc>`));
});
