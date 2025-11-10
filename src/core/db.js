import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.QUEUECTL_DB_PATH || path.resolve(process.cwd(), 'jobs.db');
const dbExists = fs.existsSync(DB_PATH);
const db = new Database(DB_PATH);

// PRAGMAs for concurrency & durability
db.pragma('journal_mode = WAL'); // improves concurrency
db.pragma('synchronous = NORMAL');

// Create tables if not exist
db.exec(`
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  command TEXT NOT NULL,
  state TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  next_run INTEGER NOT NULL DEFAULT 0,
  locked_by TEXT,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

// Default config values
const getConfigRow = db.prepare('SELECT value FROM config WHERE key = ?');
const setConfigRow = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');

const ensureDefault = (key, defaultValue) => {
  const r = getConfigRow.get(key);
  if (!r) setConfigRow.run(key, String(defaultValue));
};

ensureDefault('max_retries', '3');
ensureDefault('base_backoff', '2');

export default db;
export { getConfigRow, setConfigRow, DB_PATH };
