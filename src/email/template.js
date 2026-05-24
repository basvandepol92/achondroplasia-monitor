/**
 * Build the HTML digest email.
 * @param {object[]} items - Unemailed items from the database
 * @param {object[]} statusChanges - { item, field, old_value, new_value }[]
 */
export function buildEmail(items, statusChanges = []) {
  const date = new Date().toISOString().slice(0, 10);
  const isProd = process.env.NODE_ENV === 'production';
  const envLabel = isProd ? 'PROD' : 'TEST';
  const envColor = isProd ? '#1a6b2e' : '#b45309';

  const bySource = {
    statusChanges,
    clinicaltrials: items.filter(i => i.source === 'clinicaltrials'),
    pubmed:         items.filter(i => i.source === 'pubmed'),
    business:       items.filter(i => ['edgar', 'rss', 'scraper'].includes(i.source)),
    events:         items.filter(i => i.source === 'ctis'),
  };

  const total = items.length + statusChanges.length;
  const subject = isProd
    ? `Achondroplasia update — ${date} — ${total} new item${total !== 1 ? 's' : ''}`
    : `[TEST] Achondroplasia update — ${date} — ${total} new item${total !== 1 ? 's' : ''}`;

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: sans-serif; font-size: 14px; color: #222; max-width: 700px; margin: 0 auto; padding: 20px; }
  h1 { font-size: 18px; border-bottom: 2px solid #333; padding-bottom: 8px; }
  h2 { font-size: 15px; margin-top: 28px; margin-bottom: 8px; }
  .item { margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #eee; }
  .item a { font-weight: bold; color: #0066cc; text-decoration: none; }
  .meta { color: #666; font-size: 12px; margin-top: 2px; }
  .badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold; margin-right: 4px; }
  .badge-red { background: #fee; color: #c00; }
  .badge-yellow { background: #ffe; color: #880; }
  .badge-grey { background: #f0f0f0; color: #666; }
</style>
</head>
<body>
<p style="margin:0 0 8px">
  <span style="background:${envColor};color:#fff;padding:2px 8px;border-radius:3px;font-size:11px;font-weight:700;letter-spacing:0.5px">${envLabel}</span>
</p>
<h1>Achondroplasia update — ${date}</h1>
<p>${total} new item${total !== 1 ? 's' : ''} since last digest.</p>

${renderSection('🔴 Trial status changes', bySource.statusChanges, renderStatusChange, 'badge-red')}
${renderSection('🟡 New clinical trials', bySource.clinicaltrials, renderItem, 'badge-yellow')}
${renderSection('🟡 New publications', bySource.pubmed, renderItem, 'badge-yellow')}
${renderSection('⚪ Company news', bySource.business, renderItem, 'badge-grey')}
${renderSection('⚪ EU trial registry', bySource.events, renderItem, 'badge-grey')}

<p style="color:#999;font-size:11px;margin-top:40px;">Achondroplasia Monitor — automated digest</p>
</body>
</html>`;

  return { subject, html };
}

function renderSection(title, items, renderer, badge) {
  if (!items || items.length === 0) return '';
  return `<h2>${title} (${items.length})</h2>${items.map(i => renderer(i, badge)).join('\n')}`;
}

function renderItem(item, badgeClass) {
  const date = item.published_at ? `<span class="meta">${item.published_at} · ${item.source}</span>` : `<span class="meta">${item.source}</span>`;
  const summary = item.summary ? `<p style="margin:4px 0 0">${truncate(item.summary, 200)}</p>` : '';
  return `<div class="item">
  <a href="${item.url ?? '#'}">${escapeHtml(item.title ?? 'Untitled')}</a>
  ${date}
  ${summary}
</div>`;
}

function renderStatusChange({ item, field, old_value, new_value }, badgeClass) {
  return `<div class="item">
  <span class="badge ${badgeClass}">${field.toUpperCase()}</span>
  <a href="${item.url ?? '#'}">${escapeHtml(item.title ?? 'Untitled')}</a>
  <span class="meta">${old_value} → ${new_value}</span>
</div>`;
}

function truncate(str, len) {
  return str.length > len ? str.slice(0, len) + '…' : str;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
