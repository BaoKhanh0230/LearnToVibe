import { createReadStream, existsSync, realpathSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { SessionStore } from "./session-store.mjs";
import { createGoogleAuth, json } from "./google-auth.mjs";

const contentTypes = {
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml",
};

export function createVibeLogServer({
  root = process.cwd(), origin = process.env.APP_URL || "http://localhost:4173",
  clientId = process.env.GOOGLE_CLIENT_ID, clientSecret = process.env.GOOGLE_CLIENT_SECRET,
  dataDirectory = resolve(root, ".vibelog-data"), fetcher = globalThis.fetch,
} = {}) {
  origin = new URL(origin).origin;
  const appUrl = new URL(origin);
  if (appUrl.protocol !== "https:" && !(appUrl.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(appUrl.hostname))) throw new Error("APP_URL phải dùng HTTPS, hoặc HTTP trên localhost.");
  const absoluteRoot = realpathSync(root);
  const store = new SessionStore(dataDirectory);
  const auth = createGoogleAuth({ origin, clientId, clientSecret, store, fetcher });
  return createServer(async (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Referrer-Policy", "same-origin");
    response.setHeader("X-Frame-Options", "DENY");
    try {
      const url = new URL(request.url, origin);
      if (await auth.handle(request, response, url)) return;
      if (!["GET", "HEAD"].includes(request.method)) { json(response, 405, { error: "Phương thức không được hỗ trợ." }); return; }
      const path = decodeURIComponent(url.pathname);
      // Only public application assets are served; credentials and server code are private.
      if (!(/^(?:\/|\/index\.html|\/styles\.css)$/.test(path) || /^\/(src|image)\//.test(path)) || path.split(/[\\/]/).some((part) => part.startsWith("."))) {
        json(response, 404, { error: "Không tìm thấy trang." }); return;
      }
      const file = resolve(absoluteRoot, path === "/" ? "index.html" : `.${path}`);
      if (!file.startsWith(`${absoluteRoot}${sep}`) || !existsSync(file) || !statSync(file).isFile() || !realpathSync(file).startsWith(`${absoluteRoot}${sep}`)) {
        json(response, 404, { error: "Không tìm thấy trang." }); return;
      }
      response.writeHead(200, { "Content-Type": contentTypes[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-cache" });
      if (request.method === "HEAD") response.end();
      else { const stream = createReadStream(file); stream.on("error", () => response.destroy()); stream.pipe(response); }
    } catch { if (!response.headersSent) json(response, 400, { error: "Yêu cầu không hợp lệ." }); else response.destroy(); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT) || 4173;
  const origin = process.env.APP_URL || `http://localhost:${port}`;
  createVibeLogServer({ origin }).listen(port, process.env.LISTEN_HOST || "127.0.0.1", () => {
    console.log(`VibeLog đang chạy tại ${origin}`);
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) console.log("Google Calendar: điền cấu hình trong .env để bật kết nối lâu dài.");
  });
}

