import { Resend } from 'resend';
import { buildEmail } from './template.js';
import { getUnemailedItems, markAsEmailed } from '../db/database.js';

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
  const resend = new Resend(process.env.RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from:    process.env.EMAIL_FROM,
    to:      process.env.EMAIL_TO,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  markAsEmailed(items.map(i => i.id));

  console.log(`[mailer] Sent digest: "${subject}" (${items.length} items)`);
  return { sent: true, count: items.length };
}
