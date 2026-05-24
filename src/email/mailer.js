import nodemailer from 'nodemailer';
import { buildEmail } from './template.js';
import { getUnemailedItems, markAsEmailed } from '../db/database.js';

function createTransport() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Send the daily digest if there are unemailed items.
 * @param {object[]} statusChanges - Status changes detected during the last fetch run
 * @returns {{ sent: boolean, count: number }}
 */
export async function sendDigest(statusChanges = []) {
  const items = getUnemailedItems();

  if (items.length === 0 && statusChanges.length === 0) {
    console.log('[mailer] No new items, skipping digest');
    return { sent: false, count: 0 };
  }

  const { subject, html } = buildEmail(items, statusChanges);
  const transport = createTransport();

  await transport.sendMail({
    from:    process.env.EMAIL_FROM,
    to:      process.env.EMAIL_TO,
    subject,
    html,
  });

  markAsEmailed(items.map(i => i.id));

  console.log(`[mailer] Sent digest: "${subject}" (${items.length} items)`);
  return { sent: true, count: items.length };
}
