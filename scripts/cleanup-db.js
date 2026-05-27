/**
 * Eenmalig opruimscript voor de productie-database.
 * Verwijdert valse status_changes en corrigeert slechte statuswaarden
 * die zijn ontstaan door de kapotte whoictrp status-parser.
 *
 * Gebruik: railway run node scripts/cleanup-db.js
 */

import { config } from 'dotenv';
config();

import db from '../src/db/database.js';

const VALID_STATUSES = ['Not recruiting', 'Recruiting', 'Completed', 'Terminated', 'Suspended', 'Pending', 'Other'];
const placeholders = VALID_STATUSES.map(() => '?').join(',');

// --- Diagnostiek eerst ---

const badStatusChanges = db.prepare(`
  SELECT sc.id, sc.old_value, sc.new_value, i.source
  FROM status_changes sc
  JOIN items i ON i.id = sc.item_id
  WHERE i.source = 'whoictrp'
    AND sc.old_value NOT IN (${placeholders})
`).all(...VALID_STATUSES);

const badItems = db.prepare(`
  SELECT id, status FROM items
  WHERE source = 'whoictrp'
    AND status NOT IN (${placeholders})
    AND status IS NOT NULL
`).all(...VALID_STATUSES);

const dupChanges = db.prepare(`
  SELECT item_id, field, new_value, COUNT(*) as cnt
  FROM status_changes
  GROUP BY item_id, field, new_value
  HAVING cnt > 1
`).all();

console.log(`\n=== Diagnostiek ===`);
console.log(`Valse whoictrp status_changes:  ${badStatusChanges.length}`);
console.log(`Items met corrupte status:       ${badItems.length}`);
console.log(`Dubbele status_changes (totaal): ${dupChanges.length} groepen`);

// --- Opruimen ---

const tx = db.transaction(() => {
  // 1. Verwijder valse status_changes van whoictrp
  const del1 = db.prepare(`
    DELETE FROM status_changes
    WHERE id IN (
      SELECT sc.id FROM status_changes sc
      JOIN items i ON i.id = sc.item_id
      WHERE i.source = 'whoictrp'
        AND sc.old_value NOT IN (${placeholders})
    )
  `).run(...VALID_STATUSES);
  console.log(`\nVerwijderd: ${del1.changes} valse whoictrp status_changes`);

  // 2. Verwijder dubbele status_changes (bewaar de oudste per groep)
  const del2 = db.prepare(`
    DELETE FROM status_changes
    WHERE id NOT IN (
      SELECT MIN(id) FROM status_changes
      GROUP BY item_id, field, new_value
    )
  `).run();
  console.log(`Verwijderd: ${del2.changes} dubbele status_changes`);

  // 3. Reset corrupte statuswaarden op whoictrp items
  const fix = db.prepare(`
    UPDATE items SET status = NULL
    WHERE source = 'whoictrp'
      AND status NOT IN (${placeholders})
  `).run(...VALID_STATUSES);
  console.log(`Gereset:    ${fix.changes} whoictrp items met corrupte status`);
});

tx();

// --- Verificatie ---

const remaining = db.prepare(`SELECT COUNT(*) as n FROM status_changes`).get();
const remainingItems = db.prepare(`SELECT COUNT(*) as n FROM items`).get();
console.log(`\n=== Na opruimen ===`);
console.log(`Items totaal:          ${remainingItems.n}`);
console.log(`Status_changes totaal: ${remaining.n}`);
console.log(`\nKlaar.`);
