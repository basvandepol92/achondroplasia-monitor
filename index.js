import { config } from 'dotenv';
config();

import { runFetchers, startDaemon } from './src/scheduler.js';
import { sendDigest } from './src/email/mailer.js';

const isDaemon = process.argv.includes('--daemon');

if (isDaemon) {
  startDaemon();
  // Start dashboard — Railway injecteert PORT, lokaal valt het terug op 3000
  const { startDashboard } = await import('./src/dashboard.js');
  startDashboard(process.env.PORT ?? 3000);
} else {
  // Single run: fetch everything, then send digest if there are new items
  const statusChanges = await runFetchers();
  await sendDigest(statusChanges);
}
