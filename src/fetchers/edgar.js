import axios from 'axios';
import { EDGAR_COMPANIES, matchesKeyword } from '../config.js';

const BASE_URL = 'https://efts.sec.gov/LATEST/search-index';
const FORM_TYPES = '8-K,20-F,6-K';

export async function fetch() {
  const results = [];

  for (const company of EDGAR_COMPANIES) {
    const params = {
      q: `"achondroplasia" "${company}"`,
      dateRange: 'custom',
      startdt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      forms: FORM_TYPES,
    };

    const res = await axios.get(BASE_URL, {
      params,
      headers: { 'User-Agent': 'achondroplasia-monitor contact@example.com' },
    });

    const hits = res.data?.hits?.hits ?? [];

    for (const hit of hits) {
      const src = hit._source ?? {};
      const title = src.display_names?.[0] ?? src.file_date ?? 'SEC Filing';
      const text = `${title} ${src.period_of_report ?? ''}`;

      if (!matchesKeyword(text)) continue;

      results.push({
        source:       'edgar',
        external_id:  hit._id,
        title:        `${company} — ${src.form_type}: ${title}`,
        summary:      null,
        url:          `https://www.sec.gov/Archives/edgar/data/${src.entity_id}/${src.file_date}`,
        published_at: src.file_date ?? null,
        raw_json:     src,
      });
    }
  }

  return results;
}
