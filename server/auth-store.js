import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, hash] = storedHash.split(':');
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'));
}

function extensionFromMimeType(mimeType) {
  if (/ogg/i.test(mimeType)) return '.ogg';
  if (/mp4|mpeg4|aac/i.test(mimeType)) return '.m4a';
  if (/wav/i.test(mimeType)) return '.wav';
  return '.webm';
}

class AuthStore {
  constructor({ dataDir }) {
    this.dataDir = dataDir;
    this.recordingsDir = path.join(this.dataDir, 'recordings');
    fs.mkdirSync(this.recordingsDir, { recursive: true });

    this.db = new DatabaseSync(path.join(this.dataDir, 'specula-elementae.sqlite'));
    this._migrate();
  }

  _migrate() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        revoked_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS recordings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        prompt_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, prompt_id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    `);
  }

  createUser(username, password) {
    const trimmedUsername = String(username || '').trim();
    const rawPassword = String(password || '');
    if (!trimmedUsername || !rawPassword) {
      throw new Error('username_password_required');
    }

    const stmt = this.db.prepare(`
      INSERT INTO users (username, password_hash)
      VALUES (?, ?)
      RETURNING id, username, created_at
    `);

    return stmt.get(trimmedUsername, hashPassword(rawPassword));
  }

  authenticateUser(username, password) {
    const row = this.db.prepare(`
      SELECT id, username, password_hash
      FROM users
      WHERE username = ?
    `).get(String(username || '').trim());

    if (!row || !verifyPassword(String(password || ''), row.password_hash)) {
      return null;
    }

    return {
      id: row.id,
      username: row.username
    };
  }

  createToken(userId) {
    const token = crypto.randomBytes(24).toString('hex');
    const tokenHash = hashToken(token);

    const row = this.db.prepare(`
      INSERT INTO tokens (user_id, token_hash)
      VALUES (?, ?)
      RETURNING created_at
    `).get(userId, tokenHash);

    return {
      token,
      createdAt: row.created_at
    };
  }

  getUserByToken(token) {
    if (!token) return null;
    const tokenHash = hashToken(token);
    const row = this.db.prepare(`
      SELECT users.id, users.username
      FROM tokens
      JOIN users ON users.id = tokens.user_id
      WHERE tokens.token_hash = ?
        AND tokens.revoked_at IS NULL
    `).get(tokenHash);

    return row || null;
  }

  revokeToken(token) {
    if (!token) return;
    const tokenHash = hashToken(token);
    this.db.prepare(`
      UPDATE tokens
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE token_hash = ?
        AND revoked_at IS NULL
    `).run(tokenHash);
  }

  listRecordingStatus(userId) {
    const rows = this.db.prepare(`
      SELECT prompt_id, updated_at
      FROM recordings
      WHERE user_id = ?
    `).all(userId);

    const status = {};
    for (const row of rows) {
      status[row.prompt_id] = {
        hasRecording: true,
        updatedAt: row.updated_at
      };
    }
    return status;
  }

  getRecording(userId, promptId) {
    const row = this.db.prepare(`
      SELECT prompt_id, file_path, mime_type, updated_at
      FROM recordings
      WHERE user_id = ?
        AND prompt_id = ?
    `).get(userId, promptId);

    return row || null;
  }

  saveRecording(userId, promptId, buffer, mimeType) {
    const existing = this.getRecording(userId, promptId);
    const userDir = path.join(this.recordingsDir, String(userId));
    fs.mkdirSync(userDir, { recursive: true });

    const ext = extensionFromMimeType(mimeType);
    const fileBase = crypto.createHash('sha1').update(promptId).digest('hex');
    const relativePath = path.posix.join(String(userId), `${fileBase}${ext}`);
    const absolutePath = path.join(this.recordingsDir, relativePath);

    fs.writeFileSync(absolutePath, buffer);

    if (existing && existing.file_path && existing.file_path !== relativePath) {
      const oldPath = path.join(this.recordingsDir, existing.file_path);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    this.db.prepare(`
      INSERT INTO recordings (user_id, prompt_id, file_path, mime_type, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, prompt_id)
      DO UPDATE SET
        file_path = excluded.file_path,
        mime_type = excluded.mime_type,
        updated_at = CURRENT_TIMESTAMP
    `).run(userId, promptId, relativePath, mimeType);

    return this.getRecording(userId, promptId);
  }

  deleteRecording(userId, promptId) {
    const existing = this.getRecording(userId, promptId);
    if (!existing) return false;

    this.db.prepare(`
      DELETE FROM recordings
      WHERE user_id = ?
        AND prompt_id = ?
    `).run(userId, promptId);

    const absolutePath = path.join(this.recordingsDir, existing.file_path);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }
    return true;
  }
}

export {
  AuthStore
};
