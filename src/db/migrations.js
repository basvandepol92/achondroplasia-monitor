import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const DB_PATH = process.env.DB_PATH || './data/monitor.db';

mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id           INTEGER PRIMARY KEY,
    source       TEXT NOT NULL,
    external_id  TEXT NOT NULL,
    title        TEXT,
    summary      TEXT,
    url          TEXT,
    published_at TEXT,
    status       TEXT,
    age_min      TEXT,
    age_max      TEXT,
    phase        TEXT,
    locations    TEXT,
    raw_json     TEXT,
    created_at   TEXT DEFAULT (datetime('now')),
    emailed      INTEGER DEFAULT 0,
    UNIQUE(source, external_id)
  );

  CREATE TABLE IF NOT EXISTS status_changes (
    id         INTEGER PRIMARY KEY,
    item_id    INTEGER REFERENCES items(id),
    field      TEXT,
    old_value  TEXT,
    new_value  TEXT,
    changed_at TEXT DEFAULT (datetime('now'))
  );
`);

console.log(`Database initialised at ${DB_PATH}`);
db.close();
