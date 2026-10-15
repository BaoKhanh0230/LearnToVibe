import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function buildVercel({ root = process.cwd(), output = resolve(root, "_site"), siteUrl = process.env.APP_URL } = {}) {
  const url = new URL(siteUrl);
  if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    throw new Error("APP_URL cần là địa chỉ HTTPS chính thức của website, không có đường dẫn.");
  }
  mkdirSync(output, { recursive: true });
  for (const name of ["index.html", "styles.css", "robots.txt", "sitemap.xml", "src", "image"]) {
    cpSync(resolve(root, name), resolve(output, name), { recursive: true });
  }
  for (const name of ["index.html", "robots.txt", "sitemap.xml"]) {
    const file = resolve(output, name);
    writeFileSync(file, readFileSync(file, "utf8").replaceAll("https://vibelog-baokhanh.onrender.com", url.origin));
  }
  // Keep auto mode: Google credentials and persistent sessions stay in the API.
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) buildVercel();
