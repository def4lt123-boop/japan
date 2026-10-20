#!/usr/bin/env node
/**
 * Erzeugt aus data/seed.json + supabase/schema.sql drei Dateien:
 *
 *   supabase/setup.sql     → ERSTES SETUP: Schema + Policies + Sichten + Beispieldaten
 *                            (ein File, einmal in den Supabase-SQL-Editor)
 *   supabase/seed.sql      → nur die Beispieldaten (wenn das Schema schon steht)
 *   supabase/migrations/*  → gespiegelte schema.sql für `supabase db push` / CI
 *
 * Aufruf: node scripts/emit-seed-sql.mjs   (oder: npm run seed:sql)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const seed = JSON.parse(readFileSync(join(root, 'data/seed.json'), 'utf8'));
const OLD_TRIP = seed.trips.find((t) => t.archived)?.id ?? 'trip-2025';
const NEW_TRIP = seed.trips.find((t) => !t.archived)?.id ?? 'trip-2027';
const OLD_YEAR = seed.trips.find((t) => t.id === OLD_TRIP)?.start_date?.slice(0, 4) ?? '';

const q = (v) => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return `'${String(v).replace(/'/g, "''")}'`;
};

/** Insert mit ON CONFLICT DO NOTHING – eine bereits geführte Reise wird nie überschrieben */
const insert = (table, rows, columns) => {
  if (!rows.length) return `-- ${table}: keine Daten\n`;
  const values = rows.map((r) => `  (${columns.map((c) => q(r[c])).join(', ')})`);
  return [
    `insert into public.${table} (${columns.join(', ')})`,
    `values`,
    values.join(',\n'),
    `on conflict (id) do nothing;`,
    '',
  ].join('\n');
};

const TRIP_COLS = ['id', 'name', 'destination', 'start_date', 'end_date', 'travelers', 'budget_eur', 'jpy_rate', 'notes', 'archived'];
const PLACE_COLS = [
  'id',
  'trip_id',
  'name',
  'city',
  'district',
  'category',
  'date',
  'time_slot',
  'start_time',
  'duration_min',
  'travel_time',
  'notes',
  'price_eur',
  'price_note',
  'booking_status',
  'booking_url',
  'priority',
  'maps_query',
  'lat',
  'lng',
  'image_url',
  'sort_order',
];
const HOTEL_COLS = [
  'id',
  'trip_id',
  'name',
  'city',
  'check_in',
  'check_out',
  'nights',
  'price_total_eur',
  'price_per_night_eur',
  'address',
  'lat',
  'lng',
  'booking_url',
  'booking_status',
  'notes',
];
const JOURNEY_COLS = [
  'id',
  'trip_id',
  'date',
  'title',
  'from_city',
  'to_city',
  'mode',
  'departure_time',
  'duration_min',
  'price_eur',
  'hotel_name',
  'nights',
  'booking_status',
  'notes',
];
const EXPENSE_COLS = ['id', 'trip_id', 'date', 'category', 'description', 'amount_eur', 'payer'];

const PLACE_BODY = PLACE_COLS.filter((c) => c !== 'id' && c !== 'trip_id');
const HOTEL_BODY = HOTEL_COLS.filter((c) => c !== 'id' && c !== 'trip_id');
const JOURNEY_BODY = JOURNEY_COLS.filter((c) => c !== 'id' && c !== 'trip_id');

/** Zeiten für die `time`-Spalten in Postgres-Form bringen */
const places = seed.places.map((p) => ({ ...p, start_time: p.start_time ? `${p.start_time}:00` : null }));
const journeys = seed.journeys.map((j) => ({ ...j, departure_time: j.departure_time ? `${j.departure_time}:00` : null }));

const shiftExpr = '(neu.start_date - alt.start_date)';

const seedBody = `-- ---------------------------------------------------------------------------
-- Beispieldaten aus der Google-Tabelle (Reise ${OLD_YEAR}) + Übernahme in die
-- neue Reise '${NEW_TRIP}'. Tage: Orte mit Datum werden um den Abstand der
-- Reisestarts verschoben, Orte ohne Datum starten in der Wünscheliste
-- (im UI: "Wünscheliste → ⚡ Automatisch verteilen").
-- ---------------------------------------------------------------------------

${insert('trips', seed.trips, TRIP_COLS)}
${insert('journeys', journeys, JOURNEY_COLS)}
${insert('hotels', seed.hotels, HOTEL_COLS)}
${insert('places', places, PLACE_COLS)}
${insert('expenses', seed.expenses, EXPENSE_COLS)}
insert into public.places (id, trip_id, ${PLACE_BODY.join(', ')})
select 'pl27-' || gen_random_uuid()::text,
       '${NEW_TRIP}',
       p.name, p.city, p.district, p.category,
       case when p.date is null then null
            else (p.date + ${shiftExpr})::date end,
       p.time_slot, p.start_time, p.duration_min, p.travel_time,
       p.notes, p.price_eur, p.price_note,
       'offen', p.booking_url, p.priority, p.maps_query, p.lat, p.lng, p.image_url, p.sort_order
from public.places p
join public.trips alt on alt.id = p.trip_id
join public.trips neu on neu.id = '${NEW_TRIP}'
where p.trip_id = '${OLD_TRIP}'
  and not exists (select 1 from public.places x where x.trip_id = '${NEW_TRIP}');

insert into public.hotels (id, trip_id, ${HOTEL_BODY.join(', ')})
select 'ht27-' || gen_random_uuid()::text,
       '${NEW_TRIP}',
       h.name, h.city,
       (h.check_in + ${shiftExpr})::date,
       (h.check_out + ${shiftExpr})::date,
       h.nights, h.price_total_eur, h.price_per_night_eur, h.address, h.lat, h.lng, h.booking_url,
       'offen',
       'Aus der Vorlage übernommen – Preis und Verfügbarkeit neu prüfen.'
from public.hotels h
join public.trips alt on alt.id = h.trip_id
join public.trips neu on neu.id = '${NEW_TRIP}'
where h.trip_id = '${OLD_TRIP}'
  and not exists (select 1 from public.hotels x where x.trip_id = '${NEW_TRIP}');

insert into public.journeys (id, trip_id, ${JOURNEY_BODY.join(', ')})
select 'jn27-' || gen_random_uuid()::text,
       '${NEW_TRIP}',
       (j.date + ${shiftExpr})::date,
       j.title, j.from_city, j.to_city, j.mode, j.departure_time, j.duration_min, j.price_eur, j.hotel_name, j.nights,
       'offen',
       'Verschobener Reiseverlauf aus der Vorlage – Uhrzeiten und Preise aktualisieren.'
from public.journeys j
join public.trips alt on alt.id = j.trip_id
join public.trips neu on neu.id = '${NEW_TRIP}'
where j.trip_id = '${OLD_TRIP}'
  and j.date is not null
  and not exists (select 1 from public.journeys x where x.trip_id = '${NEW_TRIP}');
`;

const control = `-- Kontrolle (optional):
--   select id, name, places, nights, total_cost from public.v_trip_summary;
--   select * from public.v_day_load where trip_id = '${NEW_TRIP}' order by date;
--
-- Hart zurücksetzen (überschreibt deine Arbeit!):
--   delete from public.trips where id in ('${OLD_TRIP}', '${NEW_TRIP}');   -- kaskadiert
--   ... danach dieses File erneut ausführen.
`;

const banner = (title) => `-- ============================================================================
-- Urlaubsplaner – ${title}
-- Automatisch erzeugt – Quelle: data/seed.json / supabase/schema.sql
-- Neu erzeugen: node scripts/emit-seed-sql.mjs  (npm run seed:sql)
-- Idempotent: bestehende Zeilen werden nie überschrieben,
-- die neue Reise '${NEW_TRIP}' wird nur gefüllt wenn sie noch leer ist.
-- ============================================================================
`;

const schema = readFileSync(join(root, 'supabase/schema.sql'), 'utf8');

writeFileSync(join(root, 'supabase/seed.sql'), banner('Beispieldaten (nur Daten – Schema muss stehen)') + `\nbegin;\n\n${seedBody}\n${control}\ncommit;\n`);

writeFileSync(
  join(root, 'supabase/setup.sql'),
  banner('ERSTES SETUP: Tabellen + Zugriff + Beispieldaten, ein File') +
    `\n-- 1) Schema, Sichten, RLS-Policies\n\n${schema}\n\n-- 2) Beispieldaten\n\nbegin;\n\n${seedBody}\n${control}\ncommit;\n`,
);

const migDir = join(root, 'supabase/migrations');
if (!existsSync(migDir)) mkdirSync(migDir, { recursive: true });
const stamp = '20261020000001';
writeFileSync(
  join(migDir, `${stamp}_urlaubsplaner.sql`),
  `-- Supabase Migration – gespiegelt aus supabase/schema.sql (nicht separat editieren)\n-- Quelle: node scripts/emit-seed-sql.mjs\n\n${schema}`,
);

const counts = `Reisen ${seed.trips.length} · Orte ${seed.places.length} · Unterkünfte ${seed.hotels.length} · Etappen ${seed.journeys.length} · Ausgaben ${seed.expenses.length}`;
console.log(` geschrieben: supabase/setup.sql, supabase/seed.sql, supabase/migrations/${stamp}_urlaubsplaner.sql`);
console.log(` Inhalt:     ${counts}`);
