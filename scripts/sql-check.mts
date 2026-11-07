import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadModule, parse } from 'libpg-query';

/**
 * Liest die drei Blätter mit dem Parser von Postgres selbst. Eine halb gespielte
 * Migration, ein Komma zu viel, ein `do`-Block ohne Ende – das fällt hier auf und
 * nicht erst im Projekt, wenn die App schon auf Antworten wartet.
 */

const WURZEL = process.cwd();
const blätter = ['supabase/schema.sql', 'supabase/migrations/20261107000000_reiseplan.sql', 'supabase/neu-aufbau.sql'];

await loadModule();

let aussagen = 0;
const zählung: string[] = [];
for (const blatt of blätter) {
  assert.ok(existsSync(join(WURZEL, blatt)), `${blatt} fehlt`);
  const inhalt = readFileSync(join(WURZEL, blatt), 'utf8');
  const { stmts } = await parse(inhalt);
  assert.ok(Array.isArray(stmts) && stmts.length > 0, `${blatt}: keine einzige Aussage`);
  aussagen += stmts.length;
  zählung.push(`${blatt.split('/').pop()} ${stmts.length}`);
}

// Der Neuaufbau nacherzählt nichts, er nimmt das Grundblatt wortwörtlich auf.
const grund = readFileSync(join(WURZEL, 'supabase/schema.sql'), 'utf8').trim();
const neu = readFileSync(join(WURZEL, 'supabase/neu-aufbau.sql'), 'utf8');
assert.ok(neu.includes(grund), 'der Neuaufbau legt wortgleich das Blatt aus schema.sql an');
assert.ok(neu.indexOf('drop table') < neu.indexOf('create table'), 'im Neuaufbau steht das Aufräumen vor dem Anlegen');
assert.ok(neu.includes('begin;') && neu.includes('commit;'), 'der Neuaufbau ist ein Durchgang, keine halbe Arbeit');
assert.match(neu, /notify pgrst/, 'PostgREST darf keinen veralteten Zwischenspeicher behalten');
assert.match(neu, /drop table if exists public\.eintraege cascade/, 'der Neuaufbau wirft erst die Einträge fort, dann die Reisen');
assert.ok(!/alter default privileges/.test(neu), 'der Neuaufbau ändert keine künftigen Rechte, nur die jetzigen');

// dasselbe Blatt, zweimal gelesen: migration und grund bleiben identisch
const migration = readFileSync(join(WURZEL, 'supabase/migrations/20261107000000_reiseplan.sql'), 'utf8');
assert.equal(migration.replace(/^\s*--.*$/gm, '').trim(), grund.replace(/^\s*--.*$/gm, '').trim(), 'migration und schema.sql sind dasselbe Blatt');

console.log(`🎉 Sql liest sich – ${blätter.length} Blätter, ${aussagen} Aussagen (${zählung.join(', ')})`);
