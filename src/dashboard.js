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

function renderPage() {
  const stats = getStats();
  const items = getRecentItems(100);
  const changes = getRecentStatusChanges(50);

  const sourceRows = stats.bySources.map(s => `
    <tr>
      <td>${SOURCE_LABELS[s.source] ?? s.source}</td>
      <td class="num">${s.count}</td>
    </tr>`).join('');

  const itemRows = items.map(item => `
    <tr class="${item.emailed ? '' : 'unsent'}">
      <td>${SOURCE_LABELS[item.source] ?? item.source}</td>
      <td>${item.url
        ? `<a href="${esc(item.url)}" target="_blank">${esc(item.title)}</a>`
        : esc(item.title)}</td>
      <td>${item.status ? `<span class="badge">${esc(item.status)}</span>` : '—'}</td>
      <td>${item.phase ?? '—'}</td>
      <td class="date">${item.published_at ?? item.created_at?.slice(0, 10) ?? '—'}</td>
      <td>${item.emailed ? '✓' : '<span class="new">nieuw</span>'}</td>
    </tr>`).join('');

  const changeRows = changes.length === 0
    ? '<tr><td colspan="5" class="empty">Geen statuswijzigingen</td></tr>'
    : changes.map(c => `
    <tr>
      <td>${SOURCE_LABELS[c.source] ?? c.source}</td>
      <td>${c.url
        ? `<a href="${esc(c.url)}" target="_blank">${esc(c.title)}</a>`
        : esc(c.title)}</td>
      <td>${esc(c.field)}</td>
      <td><span class="badge old">${esc(c.old_value)}</span> → <span class="badge">${esc(c.new_value)}</span></td>
      <td class="date">${c.changed_at?.slice(0, 16) ?? '—'}</td>
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

const server = createServer((req, res) => {
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

server.listen(PORT, () => {
  console.log(`Dashboard draait op http://localhost:${PORT}`);
});
