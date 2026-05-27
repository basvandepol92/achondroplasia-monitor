import axios from 'axios';
import * as cheerio from 'cheerio';

// Search results page — already filtered to achondroplasia, no keyword filter needed
const SEARCH_URL = 'https://trialsearch.who.int/Default.aspx';
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; achondroplasia-monitor/1.0)' };

// Trial IDs registered in major registries
const TRIAL_ID_RE = /\b(NCT\d{8}|ISRCTN\d+|EUCTR[\w-]+|ACTRN\d+|ChiCTR[\w-]+|CTRI\/[\d/]+|NTR\d+|UMIN\d+)\b/;

// Known WHO ICTRP recruitment status values
const STATUS_RE = /\b(Not recruiting|Recruiting|Completed|Terminated|Suspended|Pending|Other)\b/i;

export async function fetch() {
  const res = await axios.get(SEARCH_URL, {
    params: { searchWord: 'achondroplasia' },
    headers: HEADERS,
    timeout: 20000,
  });

  const $ = cheerio.load(res.data);
  const items = [];

  $('tr').each((_, el) => {
    const text = $(el).text();
    const match = text.match(TRIAL_ID_RE);
    if (!match) return;

    const id     = match[1];
    const linkEl = $(el).find('a').first();
    const href   = linkEl.attr('href') ?? '';
    const url    = href.startsWith('http')
      ? href
      : `https://trialsearch.who.int/Trial2.aspx?TrialID=${id}`;

    // Title: first <a> text if it looks like a title, else clean up the row text
    const linkText = linkEl.text().trim();
    const title = linkText.length > 10 ? linkText : text.replace(id, '').replace(/\s+/g, ' ').trim().slice(0, 200);

    // Date: last token matching yyyy-mm-dd
    const dateMatch = text.match(/\d{4}-\d{2}-\d{2}/g);
    const date = dateMatch ? dateMatch[dateMatch.length - 1] : null;

    // Status: match against known ICTRP values (avoids picking up table header text)
    const statusMatch = text.match(STATUS_RE);
    const status = statusMatch ? statusMatch[1] : null;

    items.push({
      source:       'whoictrp',
      external_id:  id,
      title,
      summary:      null,
      url,
      published_at: date,
      status,
      raw_json:     { source: 'whoictrp' },
    });
  });

  return items;
}
