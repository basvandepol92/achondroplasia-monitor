import cron from 'node-cron';
import { fetch as fetchClinicalTrials } from './fetchers/clinicaltrials.js';
import { fetch as fetchPubMed } from './fetchers/pubmed.js';
import { fetch as fetchEdgar } from './fetchers/edgar.js';
import { fetch as fetchRss } from './fetchers/rss.js';
import { fetch as fetchScraper } from './fetchers/scraper.js';
import { fetch as fetchCtis } from './fetchers/ctis.js';
import { upsertItem, getRecentSourceCounts } from './db/database.js';
import { sendDigest } from './email/mailer.js';

const FETCHERS = [
  { name: 'clinicaltrials', fn: fetchClinicalTrials },
  { name: 'pubmed',         fn: fetchPubMed },
  { name: 'edgar',          fn: fetchEdgar },
  { name: 'rss',            fn: fetchRss },
  { name: 'scraper',        fn: fetchScraper },
  { name: 'ctis',           fn: fetchCtis },
];

// Track consecutive zero-result counts per source for break detection
const zeroStreak = {};

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
    if (zeroStreak[source] >= 5) {
      sendScraperAlert(source, zeroStreak[source]);
    }
  } else {
    zeroStreak[source] = 0;
  }
}

async function sendScraperAlert(source, streak) {
  const nodemailer = await import('nodemailer');
  const transport = nodemailer.default.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  await transport.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      process.env.EMAIL_TO,
    subject: `⚠️ Achondroplasia monitor — scraper mogelijk stuk`,
    text:    `De fetcher voor "${source}" heeft de afgelopen ${streak} runs geen items gevonden.\nDit kan betekenen dat de website z'n structuur heeft gewijzigd.\n`,
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

  // 08:00 Amsterdam: fetch + stuur digest met alles wat er 's nachts is binnengekomen
  cron.schedule('0 8 * * *', async () => {
    try {
      const statusChanges = await runFetchers();
      await sendDigest(statusChanges);
    } catch (err) {
      console.error('[scheduler] Morning digest run failed:', err);
    }
  }, { timezone: TZ });

  // 09:00–22:00 Amsterdam: fetch elk uur, geen e-mail
  cron.schedule('0 9-22 * * *', async () => {
    try {
      await runFetchers();
    } catch (err) {
      console.error('[scheduler] Fetch run failed:', err);
    }
  }, { timezone: TZ });

  console.log('[scheduler] Daemon running (Europe/Amsterdam). Fetch: 08:00–22:00 elk uur. Digest: dagelijks 08:00.');
}
