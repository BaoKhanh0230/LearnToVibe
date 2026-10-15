import { createVibeLogHandler } from "../scripts/server.mjs";
import { connectPostgresStore } from "../scripts/postgres-session-store.mjs";

let initializing;

async function initialize() {
  if (!process.env.APP_URL || !process.env.DATABASE_URL) {
    throw new Error("Vercel cần APP_URL và DATABASE_URL của database đã cấu hình.");
  }
  const sessionStore = await connectPostgresStore({
    databaseUrl: process.env.DATABASE_URL,
    encryptionKey: process.env.SESSION_ENCRYPTION_KEY,
  });
  return createVibeLogHandler({ origin: process.env.APP_URL, sessionStore });
}

export default async function handler(request, response) {
  try {
    initializing ??= initialize().catch(error => { initializing = undefined; throw error; });
    const handle = await initializing;
    await handle(request, response);
  } catch {
    if (!response.headersSent) {
      response.writeHead(503, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" });
      response.end(JSON.stringify({ error: "Máy chủ chưa sẵn sàng. Hãy thử lại sau." }));
    } else response.destroy();
  }
}
