import { createServer } from 'http';
import { config } from 'dotenv';
config();

import { getStats, getRecentItems, getRecentStatusChanges } from './db/database.js';

const PORT = process.env.DASHBOARD_PORT ?? 3000;

const SOURCE_LABELS = {
  clinicaltrials: '🔬 ClinicalTrials',
  pubmed:         '📄 PubMed',
  edgar:          '📈 SEC EDGAR',
  rss:            '📡 RSS',
  scraper:        '🌐 Scraper',
  ctis:           '🇪🇺 CTIS',
};

function esc(str) {
  if (!str) return '—';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const MONTH_ABBR = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };

function parseDate(str) {
  if (!str) return null;

  // ISO datetime: 2021-07-22T13:25:00.000Z  or  SQLite: 2026-05-27 08:33
  // ISO date: 2023-01-11
  const d = new Date(str);
  if (!isNaN(d)) return d;

  // "2026 Apr" or "2026 Apr 24" or "2025 Jul 17"
  const m = str.match(/^(\d{4})\s+([A-Za-z]{3})(?:\s+(\d{1,2}))?/);
  if (m) {
    const month = MONTH_ABBR[m[2].toLowerCase()];
    if (month !== undefined) {
      return new Date(Number(m[1]), month, Number(m[3] ?? 1));
    }
  }

  return null;
}

function formatDate(str) {
  const d = parseDate(str);
  if (!d) return '—';
  const dd   = String(d.getDate()).padStart(2, '0');
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function sortByDateDesc(arr, dateFn) {
  return [...arr].sort((a, b) => {
    const da = parseDate(dateFn(a))?.getTime() ?? 0;
    const db = parseDate(dateFn(b))?.getTime() ?? 0;
    return db - da;
  });
}

function renderPage() {
  const stats = getStats();
  const items = getRecentItems(100);
  const changes = getRecentStatusChanges(50);

  const sourceRows = stats.bySources.map(s => `
    <tr>
      <td>${SOURCE_LABELS[s.source] ?? s.source}</td>
      <td class="num">${s.count}</td>
    </tr>`).join('');

  const sortedItems = sortByDateDesc(items, i => i.published_at ?? i.created_at);
  const itemRows = sortedItems.map(item => `
    <tr class="${item.emailed ? '' : 'unsent'}">
      <td>${SOURCE_LABELS[item.source] ?? item.source}</td>
      <td>${item.url
        ? `<a href="${esc(item.url)}" target="_blank">${esc(item.title)}</a>`
        : esc(item.title)}</td>
      <td>${item.status ? `<span class="badge">${esc(item.status)}</span>` : '—'}</td>
      <td>${item.phase ?? '—'}</td>
      <td class="date">${formatDate(item.published_at ?? item.created_at)}</td>
      <td>${item.emailed ? '✓' : '<span class="new">nieuw</span>'}</td>
    </tr>`).join('');

  const sortedChanges = sortByDateDesc(changes, c => c.changed_at);
  const changeRows = sortedChanges.length === 0
    ? '<tr><td colspan="5" class="empty">Geen statuswijzigingen</td></tr>'
    : sortedChanges.map(c => `
    <tr>
      <td>${SOURCE_LABELS[c.source] ?? c.source}</td>
      <td>${c.url
        ? `<a href="${esc(c.url)}" target="_blank">${esc(c.title)}</a>`
        : esc(c.title)}</td>
      <td>${esc(c.field)}</td>
      <td><span class="badge old">${esc(c.old_value)}</span> → <span class="badge">${esc(c.new_value)}</span></td>
      <td class="date">${formatDate(c.changed_at)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Achondroplasia Monitor</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; background: #f5f5f5; color: #222; }
  header { background: #1a1a2e; color: #fff; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
  header h1 { font-size: 16px; font-weight: 600; letter-spacing: 0.3px; }
  header time { font-size: 12px; opacity: 0.6; }
  .container { max-width: 1200px; margin: 0 auto; padding: 20px 24px; }
  .stats { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
  .stat { background: #fff; border-radius: 8px; padding: 14px 18px; border: 1px solid #e0e0e0; min-width: 130px; }
  .stat .val { font-size: 28px; font-weight: 700; line-height: 1; }
  .stat .label { font-size: 11px; color: #888; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .stat.highlight .val { color: #e65c00; }
  section { background: #fff; border-radius: 8px; border: 1px solid #e0e0e0; margin-bottom: 20px; overflow: hidden; }
  section h2 { font-size: 13px; font-weight: 600; padding: 12px 16px; background: #fafafa; border-bottom: 1px solid #e0e0e0; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; padding: 8px 12px; text-align: left; border-bottom: 1px solid #eee; }
  td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  td a { color: #0066cc; text-decoration: none; }
  td a:hover { text-decoration: underline; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .date { color: #888; white-space: nowrap; }
  .badge { display: inline-block; padding: 2px 7px; border-radius: 3px; font-size: 11px; font-weight: 500; background: #e8f4e8; color: #2a7a2a; }
  .badge.old { background: #f5f5f5; color: #666; }
  .new { display: inline-block; padding: 2px 7px; border-radius: 3px; font-size: 11px; font-weight: 600; background: #fff3e0; color: #e65c00; }
  tr.unsent td { background: #fffdf5; }
  .empty { text-align: center; color: #aaa; padding: 20px !important; }
  .refresh { display: inline-block; margin-left: 12px; padding: 5px 12px; background: rgba(255,255,255,0.15); color: #fff; border-radius: 4px; font-size: 12px; text-decoration: none; }
  .refresh:hover { background: rgba(255,255,255,0.25); }
  .sources-table { width: auto; min-width: 260px; }
</style>
</head>
<body>
<header>
  <h1>🧬 Achondroplasia Monitor</h1>
  <div>
    <time>${new Date().toLocaleString('nl-NL')}</time>
    <a class="refresh" href="/">↻ Vernieuwen</a>
  </div>
</header>
<div class="container">

  <div class="stats">
    <div class="stat">
      <div class="val">${stats.total}</div>
      <div class="label">Totaal items</div>
    </div>
    <div class="stat highlight">
      <div class="val">${stats.unsent}</div>
      <div class="label">Nog niet gemaild</div>
    </div>
    <div class="stat">
      <div class="val">${changes.length}</div>
      <div class="label">Statuswijzigingen</div>
    </div>
  </div>

  <section>
    <h2>Items per bron</h2>
    <table class="sources-table">
      <thead><tr><th>Bron</th><th class="num">Items</th></tr></thead>
      <tbody>${sourceRows || '<tr><td colspan="2" class="empty">Geen data</td></tr>'}</tbody>
    </table>
  </section>

  <section>
    <h2>🔴 Statuswijzigingen trials</h2>
    <table>
      <thead><tr><th>Bron</th><th>Titel</th><th>Veld</th><th>Wijziging</th><th>Datum</th></tr></thead>
      <tbody>${changeRows}</tbody>
    </table>
  </section>

  <section>
    <h2>Recente items (laatste 100)</h2>
    <table>
      <thead><tr><th>Bron</th><th>Titel</th><th>Status</th><th>Fase</th><th>Datum</th><th>Mail</th></tr></thead>
      <tbody>${itemRows || '<tr><td colspan="6" class="empty">Database is leeg — voer eerst een run uit</td></tr>'}</tbody>
    </table>
  </section>

</div>
</body>
</html>`;
}

const VALID_STATUSES = ['Not recruiting', 'Recruiting', 'Completed', 'Terminated', 'Suspended', 'Pending', 'Other'];
const statusPlaceholders = VALID_STATUSES.map(() => '?').join(',');

function runCleanup() {
  const lines = [];

  const badChanges = db.prepare(`
    SELECT COUNT(*) as n FROM status_changes sc
    JOIN items i ON i.id = sc.item_id
    WHERE i.source = 'whoictrp' AND sc.old_value NOT IN (${statusPlaceholders})
  `).get(...VALID_STATUSES).n;
  lines.push(`Valse whoictrp status_changes gevonden: ${badChanges}`);

  const del1 = db.prepare(`
    DELETE FROM status_changes WHERE id IN (
      SELECT sc.id FROM status_changes sc
      JOIN items i ON i.id = sc.item_id
      WHERE i.source = 'whoictrp' AND sc.old_value NOT IN (${statusPlaceholders})
    )
  `).run(...VALID_STATUSES);
  lines.push(`Verwijderd (valse whoictrp changes): ${del1.changes}`);

  const del2 = db.prepare(`
    DELETE FROM status_changes WHERE id NOT IN (
      SELECT MIN(id) FROM status_changes GROUP BY item_id, field, new_value
    )
  `).run();
  lines.push(`Verwijderd (dubbele changes): ${del2.changes}`);

  const fix = db.prepare(`
    UPDATE items SET status = NULL
    WHERE source = 'whoictrp' AND status NOT IN (${statusPlaceholders}) AND status IS NOT NULL
  `).run(...VALID_STATUSES);
  lines.push(`Gereset (corrupte whoictrp status): ${fix.changes}`);

  const totals = db.prepare(`SELECT COUNT(*) as n FROM status_changes`).get();
  lines.push(`Status_changes resterend: ${totals.n}`);

  return lines;
}

const server = createServer((req, res) => {
  if (req.url === '/admin/cleanup') {
    try {
      const results = runCleanup();
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('=== Cleanup uitgevoerd ===\n\n' + results.join('\n') + '\n\nKlaar. Verwijder dit endpoint na gebruik.');
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Fout: ${err.message}`);
    }
    return;
  }

  if (req.url !== '/') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  try {
    const html = renderPage();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`Error: ${err.message}`);
  }
});

export function startDashboard(port = PORT) {
  server.listen(port, () => {
    console.log(`[dashboard] Draait op http://localhost:${port}`);
  });
}

// Standalone: `npm run dashboard`
if (process.argv[1].endsWith('dashboard.js')) {
  startDashboard(PORT);
}
