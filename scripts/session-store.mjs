import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const sessionKey = (cookie) => createHash("sha256").update(cookie).digest("hex");

export class SessionStore {
  constructor(directory, now = Date.now) {
    this.now = now;
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.file = join(directory, "sessions.enc");
    const keyFile = join(directory, "encryption.key");
    if (!existsSync(keyFile)) {
      if (existsSync(this.file)) throw new Error("Thiếu khóa lưu kết nối. Khôi phục cả thư mục dữ liệu hoặc kết nối lại với một thư mục dữ liệu mới.");
      writeFileSync(keyFile, randomBytes(32), { mode: 0o600, flag: "wx" });
    }
    this.key = readFileSync(keyFile);
    this.sessions = {};
    if (existsSync(this.file)) {
      const encrypted = readFileSync(this.file);
      const decipher = createDecipheriv("aes-256-gcm", this.key, encrypted.subarray(0, 12));
      decipher.setAuthTag(encrypted.subarray(12, 28));
      this.sessions = JSON.parse(Buffer.concat([decipher.update(encrypted.subarray(28)), decipher.final()]).toString());
    }
  }

  get(id) {
    const record = this.sessions[id];
    return record?.expiresAt > this.now() ? record : null;
  }

  set(id, value) { this.sessions[id] = value; this.save(); }
  delete(id) { delete this.sessions[id]; this.save(); }

  save() {
    for (const [id, record] of Object.entries(this.sessions)) if (record.expiresAt <= this.now()) delete this.sessions[id];
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const body = Buffer.concat([cipher.update(JSON.stringify(this.sessions)), cipher.final()]);
    writeFileSync(`${this.file}.tmp`, Buffer.concat([iv, cipher.getAuthTag(), body]), { mode: 0o600 });
    renameSync(`${this.file}.tmp`, this.file);
  }
}
