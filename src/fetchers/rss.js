import Parser from 'rss-parser';
import { RSS_FEEDS, matchesKeyword } from '../config.js';

const parser = new Parser();

export async function fetch() {
  const results = [];

  for (const feed of RSS_FEEDS) {
    let parsed;
    try {
      parsed = await parser.parseURL(feed.url);
    } catch (err) {
      console.warn(`[rss] Failed to fetch ${feed.name}: ${err.message}`);
      continue;
    }

    for (const item of parsed?.items ?? []) {
      const text = `${item.title ?? ''} ${item.contentSnippet ?? ''}`;
      if (!matchesKeyword(text)) continue;

      results.push({
        source:       'rss',
        external_id:  item.link ?? item.guid,
        title:        item.title ?? null,
        summary:      item.contentSnippet ?? null,
        url:          item.link ?? null,
        published_at: item.isoDate ?? item.pubDate ?? null,
        raw_json:     { feed: feed.name, ...item },
      });
    }
  }

  return results;
}
