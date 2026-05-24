import axios from 'axios';
import * as cheerio from 'cheerio';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SCRAPER_SOURCES, matchesKeyword } from '../config.js';

const MODEL = 'gemini-3.1-flash-lite-preview';
const MAX_HTML_CHARS = 25000;

function cleanHtml(html) {
  const $ = cheerio.load(html);
  $('script, style, nav, footer, header, aside, form, iframe, noscript, svg').remove();
  return $('body').html() ?? '';
}

async function extractWithGemini(html, source) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.warn('[scraper] GOOGLE_API_KEY not set, skipping AI extraction');
    return [];
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL });

  const prompt = `Extract all news articles, press releases, or publications listed on this webpage.
Base URL: ${source.url}
Return ONLY a valid JSON array, no other text or markdown.
Format: [{"title":"...","url":"...","date":"YYYY-MM-DD or null"}]
Convert relative URLs to absolute using the base URL.
If no items are found, return [].

HTML:
${html.slice(0, MAX_HTML_CHARS)}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    console.warn(`[scraper] ${source.name}: failed to parse Gemini response`);
    return [];
  }
}

async function scrapeSite(source) {
  const res = await axios.get(source.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; achondroplasia-monitor/1.0)' },
    timeout: 15000,
  });

  const html = cleanHtml(res.data);
  const extracted = await extractWithGemini(html, source);
  const items = [];

  for (const item of extracted) {
    if (!item.title || !item.url) continue;
    if (!matchesKeyword(`${item.title} ${item.url}`)) continue;

    items.push({
      source:       'scraper',
      external_id:  item.url,
      title:        item.title,
      summary:      null,
      url:          item.url,
      published_at: item.date ?? null,
      raw_json:     { siteName: source.name },
    });
  }

  console.log(`[scraper] ${source.name}: ${extracted.length} items extracted, ${items.length} matched keywords`);
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
    // Small pause to stay within per-minute rate limits
    await new Promise(r => setTimeout(r, 2000));
  }

  return results;
}
