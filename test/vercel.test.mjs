import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildVercel } from "../scripts/build-vercel.mjs";

test("Vercel artifact chỉ chứa tài nguyên công khai và SEO trỏ đúng website mới", t => {
  const output = mkdtempSync(join(tmpdir(), "vibelog-vercel-"));
  t.after(() => rmSync(output, { recursive: true, force: true }));
  buildVercel({ output, siteUrl: "https://vibelog.example" });
  for (const name of ["index.html", "robots.txt", "sitemap.xml"]) {
    const text = readFileSync(join(output, name), "utf8");
    assert.ok(text.includes("https://vibelog.example/"));
    assert.ok(!text.includes("vibelog-baokhanh.onrender.com"));
  }
  for (const name of [".env", "scripts", "api", "supabase", ".vibelog-data", ".git"]) {
    assert.equal(existsSync(join(output, name)), false);
  }
  assert.match(readFileSync(join(output, "src/google-config.js"), "utf8"), /"mode":\s*"auto"/);
  for (const siteUrl of ["http://vibelog.example", "https://vibelog.example/wrong", "https://user:password@vibelog.example"]) {
    assert.throws(() => buildVercel({ output, siteUrl }));
  }
});
