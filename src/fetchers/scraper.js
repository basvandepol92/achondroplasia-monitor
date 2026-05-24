import axios from 'axios';
import * as cheerio from 'cheerio';
import { SCRAPER_SOURCES, matchesKeyword } from '../config.js';

async function scrapeSite(source) {
  const res = await axios.get(source.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; achondroplasia-monitor/1.0)' },
    timeout: 15000,
  });

  const $ = cheerio.load(res.data);
  const { selectors } = source;
  const items = [];

  $(selectors.items).each((_, el) => {
    const title = $(el).find(selectors.title).first().text().trim();
    const linkEl = $(el).find(selectors.link).first();
    const href = linkEl.attr('href') ?? '';
    const date = $(el).find(selectors.date).first().attr('datetime')
      ?? $(el).find(selectors.date).first().text().trim()
      ?? null;

    if (!title) return;

    const url = href.startsWith('http') ? href : new URL(href, source.url).toString();
    const text = `${title} ${url}`;
    if (!matchesKeyword(text)) return;

    items.push({
      source:       'scraper',
      external_id:  url,
      title,
      summary:      null,
      url,
      published_at: date,
      raw_json:     { siteName: source.name },
    });
  });

  return items;
}

export async function fetch() {
  const results = [];

  for (const source of SCRAPER_SOURCES) {
    try {
      const items = await scrapeSite(source);
      results.push(...items);
    } catch (err) {
      console.warn(`[scraper] Failed to scrape ${source.name}: ${err.message}`);
    }
  }

  return results;
}
