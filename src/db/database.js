import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const DB_PATH = process.env.DB_PATH || './data/monitor.db';
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const stmtUpsert = db.prepare(`
  INSERT INTO items (source, external_id, title, summary, url, published_at, status, age_min, age_max, phase, locations, raw_json)
  VALUES (@source, @external_id, @title, @summary, @url, @published_at, @status, @age_min, @age_max, @phase, @locations, @raw_json)
  ON CONFLICT(source, external_id) DO UPDATE SET
    title        = excluded.title,
    summary      = excluded.summary,
    url          = excluded.url,
    published_at = excluded.published_at,
    status       = COALESCE(excluded.status, status),
    phase        = COALESCE(excluded.phase, phase),
    raw_json     = excluded.raw_json
  RETURNING *
`);

const stmtGetByExternalId = db.prepare(`
  SELECT * FROM items WHERE source = ? AND external_id = ?
`);

const stmtLogChange = db.prepare(`
  INSERT INTO status_changes (item_id, field, old_value, new_value)
  VALUES (?, ?, ?, ?)
`);

const stmtGetUnemailed = db.prepare(`
  SELECT * FROM items WHERE emailed = 0 ORDER BY created_at DESC
`);

const stmtMarkEmailed = db.prepare(`
  UPDATE items SET emailed = 1 WHERE id = ?
`);

const stmtGetRecentCounts = db.prepare(`
  SELECT source, COUNT(*) as count
  FROM items
  WHERE created_at >= datetime('now', '-6 hours')
  GROUP BY source
`);

/**
 * Upsert an item. Detects changes in `status` and `phase` and logs them.
 * Returns { item, isNew, changes[] }
 */
export function upsertItem(item) {
  const existing = stmtGetByExternalId.get(item.source, item.external_id);

  const row = stmtUpsert.get({
    source:       item.source,
    external_id:  item.external_id,
    title:        item.title ?? null,
    summary:      item.summary ?? null,
    url:          item.url ?? null,
    published_at: item.published_at ?? null,
    status:       item.status ?? null,
    age_min:      item.age_min ?? null,
    age_max:      item.age_max ?? null,
    phase:        item.phase ?? null,
    locations:    item.locations ? JSON.stringify(item.locations) : null,
    raw_json:     item.raw_json ? JSON.stringify(item.raw_json) : null,
  });

  const changes = [];

  if (existing) {
    for (const field of ['status', 'phase']) {
      const oldVal = existing[field];
      const newVal = item[field] ?? null;
      if (oldVal !== newVal && newVal !== null) {
        stmtLogChange.run(row.id, field, oldVal, newVal);
        changes.push({ field, old_value: oldVal, new_value: newVal });
      }
    }
  }

  return { item: row, isNew: !existing, changes };
}

export function getUnemailedItems() {
  return stmtGetUnemailed.all();
}

export function markAsEmailed(ids) {
  const tx = db.transaction((ids) => {
    for (const id of ids) stmtMarkEmailed.run(id);
  });
  tx(ids);
}

export function getRecentSourceCounts() {
  return stmtGetRecentCounts.all();
}

export function getStats() {
  return {
    total:   db.prepare('SELECT COUNT(*) as n FROM items').get().n,
    unsent:  db.prepare('SELECT COUNT(*) as n FROM items WHERE emailed = 0').get().n,
    bySources: db.prepare('SELECT source, COUNT(*) as count FROM items GROUP BY source ORDER BY count DESC').all(),
  };
}

export function getRecentItems(limit = 100) {
  return db.prepare('SELECT * FROM items ORDER BY created_at DESC LIMIT ?').all(limit);
}

export function getRecentStatusChanges(limit = 50) {
  return db.prepare(`
    SELECT sc.*, i.title, i.url, i.source
    FROM status_changes sc
    JOIN items i ON i.id = sc.item_id
    ORDER BY sc.changed_at DESC LIMIT ?
  `).all(limit);
}

export default db;
