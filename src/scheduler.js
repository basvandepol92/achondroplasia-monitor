import cron from 'node-cron';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { Resend } from 'resend';
import { fetch as fetchClinicalTrials } from './fetchers/clinicaltrials.js';
import { fetch as fetchPubMed } from './fetchers/pubmed.js';
import { fetch as fetchEdgar } from './fetchers/edgar.js';
import { fetch as fetchRss } from './fetchers/rss.js';
import { fetch as fetchScraper } from './fetchers/scraper.js';
import { fetch as fetchCtis } from './fetchers/ctis.js';
import { fetch as fetchWhoIctrp } from './fetchers/whoictrp.js';
import { upsertItem, getRecentSourceCounts } from './db/database.js';
import { sendDigest } from './email/mailer.js';

const FETCHERS = [
  { name: 'clinicaltrials', fn: fetchClinicalTrials },
  { name: 'pubmed',         fn: fetchPubMed },
  { name: 'edgar',          fn: fetchEdgar },
  { name: 'rss',            fn: fetchRss },
  { name: 'scraper',        fn: fetchScraper },
  { name: 'ctis',           fn: fetchCtis },
  { name: 'whoictrp',       fn: fetchWhoIctrp },
];

const STREAKS_FILE = (process.env.DB_PATH ?? './data/monitor.db').replace(/[^/\\]+$/, 'zero_streaks.json');

function loadStreaks() {
  try { return JSON.parse(readFileSync(STREAKS_FILE, 'utf8')); }
  catch { return {}; }
}

function saveStreaks(obj) {
  try {
    mkdirSync((process.env.DB_PATH ?? './data/monitor.db').replace(/[^/\\]+$/, ''), { recursive: true });
    writeFileSync(STREAKS_FILE, JSON.stringify(obj));
  } catch (err) {
    console.warn('[scheduler] Could not persist zero streaks:', err.message);
  }
}

// Loaded from disk so streaks survive process restarts
const zeroStreak = loadStreaks();

export async function runFetchers() {
  const timestamp = new Date().toISOString();
  console.log(`[scheduler] Run started at ${timestamp}`);

  const results = await Promise.allSettled(
    FETCHERS.map(async ({ name, fn }) => {
      const items = await fn();
      return { name, items };
    })
  );

  const allStatusChanges = [];

  for (const result of results) {
    if (result.status === 'rejected') {
      console.warn(`[scheduler] Fetcher failed: ${result.reason}`);
      continue;
    }

    const { name, items } = result.value;
    let newCount = 0;

    for (const item of items) {
      const { isNew, changes } = upsertItem(item);
      if (isNew) newCount++;
      if (changes.length > 0) {
        allStatusChanges.push(...changes.map(c => ({ item, ...c })));
      }
    }

    console.log(`[scheduler] ${name}: ${items.length} fetched, ${newCount} new`);
    checkScraperHealth(name, items.length);
  }

  await pingHealthcheck();
  return allStatusChanges;
}

function checkScraperHealth(source, count) {
  if (count === 0) {
    zeroStreak[source] = (zeroStreak[source] ?? 0) + 1;
    // Alert once at 5, then every 24 runs (~daily) as a reminder
    const s = zeroStreak[source];
    if (s === 5 || (s > 5 && s % 24 === 0)) {
      sendScraperAlert(source, s);
    }
  } else {
    zeroStreak[source] = 0;
  }
  saveStreaks(zeroStreak);
}

async function sendScraperAlert(source, streak) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from:    process.env.EMAIL_FROM,
    to:      process.env.EMAIL_TO,
    subject: '⚠️ Achondroplasia monitor — fetcher mogelijk stuk',
    html:    `<p>De fetcher voor <strong>${source}</strong> heeft de afgelopen <strong>${streak}</strong> runs geen items gevonden.<br>Dit kan betekenen dat de website z'n structuur heeft gewijzigd.</p>`,
  }).catch(err => console.warn('[scheduler] Failed to send scraper alert:', err.message));
}

async function pingHealthcheck() {
  const url = process.env.HEALTHCHECK_URL;
  if (!url) return;
  try {
    await fetch(url);
    console.log('[scheduler] Healthcheck pinged');
  } catch (err) {
    console.warn('[scheduler] Healthcheck ping failed:', err.message);
  }
}

const TZ = 'Europe/Amsterdam';

export function startDaemon() {
  console.log('[scheduler] Starting daemon...');

  // 08:00–22:00 Amsterdam: fetch elk uur + stuur digest als er nieuwe items zijn
  cron.schedule('0 8-22 * * *', async () => {
    try {
      const statusChanges = await runFetchers();
      await sendDigest(statusChanges);
    } catch (err) {
      console.error('[scheduler] Fetch run failed:', err);
    }
  }, { timezone: TZ });

  // 23:00–07:00 Amsterdam: alleen healthcheck pingen zodat de monitor niet DOWN meldt
  cron.schedule('0 23,0,1,2,3,4,5,6,7 * * *', async () => {
    await pingHealthcheck();
  }, { timezone: TZ });

  console.log('[scheduler] Daemon running (Europe/Amsterdam). Fetch: 08:00–22:00 elk uur. Nachtelijke ping: 23:00–07:00.');
}
