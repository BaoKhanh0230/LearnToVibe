import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { googleConfig } from "../src/google-config.js";

export function buildPages({ root = process.cwd(), output = resolve(root, "_site"),
  clientId = process.env.GOOGLE_CLIENT_ID || googleConfig.clientId } = {}) {
  if (!/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId) || clientId.startsWith("your-")) {
    throw new Error("Pages cần GOOGLE_CLIENT_ID (repository variable) hoặc clientId trong src/google-config.js. Không dùng Client Secret.");
  }
  mkdirSync(output, { recursive: true });
  for (const name of ["index.html", "styles.css", "robots.txt", "sitemap.xml", "src", "image"]) cpSync(resolve(root, name), resolve(output, name), { recursive: true });
  writeFileSync(resolve(output, "src/google-config.js"), `// Public OAuth configuration; contains no secrets.\nexport const googleConfig = ${JSON.stringify({ mode: "browser", clientId })};\n`);
  writeFileSync(resolve(output, ".nojekyll"), "");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) buildPages();
