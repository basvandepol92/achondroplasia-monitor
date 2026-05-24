import { config } from 'dotenv';
config();

import { runFetchers, startDaemon } from './src/scheduler.js';
import { sendDigest } from './src/email/mailer.js';

const isDaemon = process.argv.includes('--daemon');

if (isDaemon) {
  startDaemon();
} else {
  // Single run: fetch everything, then send digest if there are new items
  const statusChanges = await runFetchers();
  await sendDigest(statusChanges);
}
