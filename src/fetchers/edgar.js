import axios from 'axios';
import { EDGAR_COMPANIES } from '../config.js';

// EDGAR full-text search — API query already filters for achondroplasia,
// so no keyword check needed here. DB deduplication handles re-runs.
const BASE_URL = 'https://efts.sec.gov/LATEST/search-index';
const FORM_TYPES = '8-K,20-F,6-K';
const LOOKBACK_DAYS = 90;

export async function fetch() {
  const results = [];
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10); // Datumfilter in code want startdt werkt niet op dit endpoint

  for (const company of EDGAR_COMPANIES) {
    let hits;
    try {
      const res = await axios.get(BASE_URL, {
        params: {
          q:     `"achondroplasia" "${company}"`,
          forms: FORM_TYPES,
        },
        headers: { 'User-Agent': 'achondroplasia-monitor contact@example.com' },
        timeout: 15000,
      });
      hits = res.data?.hits?.hits ?? [];
    } catch (err) {
      console.warn(`[edgar] Failed for ${company}: ${err.message}`);
      continue;
    }

    // Filter op datum in code (API-parameter startdt heeft geen effect)
    hits = hits.filter(h => (h._source?.file_date ?? '') >= since);

    for (const hit of hits) {
      const src = hit._source ?? {};
      const cik  = src.ciks?.[0]?.replace(/^0+/, '');          // "0001048477" → "1048477"
      const adsh = src.adsh?.replace(/-/g, '');                 // "0001193125-14-072103" → "000119312514072103"
      const url  = cik && adsh
        ? `https://www.sec.gov/Archives/edgar/data/${cik}/${adsh}/`
        : `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=${src.form ?? '8-K'}`;

      const name  = src.display_names?.[0]?.replace(/\s+\(.*\)/, '') ?? company;
      const title = `${name} — ${src.form ?? 'Filing'} (${src.file_date ?? '?'})`;

      results.push({
        source:       'edgar',
        external_id:  hit._id ?? adsh,
        title,
        summary:      src.file_description ?? null,
        url,
        published_at: src.file_date ?? null,
        raw_json:     src,
      });
    }
  }

  return results;
}
