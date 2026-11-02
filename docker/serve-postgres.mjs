// Local Docker lesson only: no changes to the production TLS connector.
import pg from 'pg';
import { SessionStore } from '../scripts/session-store.mjs';
import { PostgresSessionStore } from '../scripts/postgres-session-store.mjs';
import { createVibeLogServer } from '../scripts/server.mjs';

if (process.env.NODE_ENV !== 'development') {
  throw new Error('Entrypoint này chỉ dành cho bài Docker local.');
}

// Fixed Docker service hostname and demo credentials; no cloud .env is loaded.
const pool = new pg.Pool({
  host: 'db', port: 5432, database: 'vibelog_lab',
  user: 'vibelog_lab_app', password: 'local-learning-only', ssl: false,
  max: 3, connectionTimeoutMillis: 10000, statement_timeout: 15000,
});
pool.on('error', () => console.error('Database bài học mất kết nối.'));
// The same named volume preserves the encryption key across container recreation.
const local = new SessionStore('/app/.vibelog-data');
const store = new PostgresSessionStore(pool, local.key.toString('base64'));
try {
  // Tables are provisioned by init SQL, so the app needs no schema CREATE privilege.
  await pool.query('DELETE FROM vibelog_sessions WHERE expires_at <= $1', [Date.now()]);
  const server = createVibeLogServer({
    origin: process.env.APP_URL || 'http://localhost:4174', sessionStore: store,
  });
  server.listen(4173, '0.0.0.0', () => {
    console.log('Docker lab: VibeLog tại http://localhost:4174, PostgreSQL tại db:5432.');
    console.log('Google OAuth chưa cấu hình; có thể dùng nhật ký trên thiết bị.');
  });
  let closing = false;
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
    if (closing) return;
    closing = true;
    server.close(async () => { await pool.end(); });
  });
} catch (error) {
  await pool.end();
  throw error;
}
