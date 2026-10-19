import { readFileSync } from 'node:fs';
import { connectPostgresStore } from './postgres-session-store.mjs';

const store = await connectPostgresStore({ databaseUrl: process.env.DATABASE_URL, encryptionKey: process.env.SESSION_ENCRYPTION_KEY });
try {
  await store.pool.query(readFileSync(new URL('./user-data-schema.sql', import.meta.url), 'utf8'));
  console.log('Đã tạo bảng dữ liệu tài khoản và phân quyền RLS.');
} finally { await store.pool.end(); }
