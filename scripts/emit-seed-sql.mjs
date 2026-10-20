#!/usr/bin/env node
/**
 * Erzeugt supabase/seed.sql aus data/seed.json (1:1 aus der Google-Tabelle).
 * Aufruf:  node scripts/emit-seed-sql.mjs
 * Neu erzeugen, wenn sich data/seed.json geändert hat.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const seed = JSON.parse(readFileSync(join(root, 'data/seed.json'), 'utf8'));

const q = (v) => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return `'${String(v).replace(/'/g, "''")}'`;
};

const insert = (table, rows, columns) => {
  if (!rows.length) return `-- ${table}: keine Daten\n`;
  const values = rows.map((r) => `  (${columns.map((c) => q(r[c])).join(', ')})`);
  return [
    `insert into public.${table} (${columns.join(', ')})`,
    `values`,
    values.join(',\n'),
    `on conflict (id) do update set ${columns.filter((c) => c !== 'id' && c !== 'trip_id').map((c) => `${c} = excluded.${c}`).join(', ')};`,
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
const HOTEL_COLS = ['id', 'trip_id', 'name', 'city', 'check_in', 'check_out', 'nights', 'price_total_eur', 'price_per_night_eur', 'address', 'lat', 'lng', 'booking_url', 'booking_status', 'notes'];
const JOURNEY_COLS = ['id', 'trip_id', 'date', 'title', 'from_city', 'to_city', 'mode', 'departure_time', 'duration_min', 'price_eur', 'hotel_name', 'nights', 'booking_status', 'notes'];
const EXPENSE_COLS = ['id', 'trip_id', 'date', 'category', 'description', 'amount_eur', 'payer'];

const places = seed.places.map((p) => ({ ...p, start_time: p.start_time ? `${p.start_time}:00` : null }));

const sql = `-- ============================================================================
-- Urlaubsplaner – Beispieldaten (URLAUB ${seed.trips[0].start_date.slice(0, 4)})
-- Automatisch erzeugt aus data/seed.json – nicht von Hand editieren.
-- Nachbau: node scripts/emit-seed-sql.mjs
-- ============================================================================

begin;

${insert('trips', seed.trips, TRIP_COLS)}
${insert('journeys', seed.journeys, JOURNEY_COLS)}
${insert('hotels', seed.hotels, HOTEL_COLS)}
${insert('places', places, PLACE_COLS)}
${insert('expenses', seed.expenses, EXPENSE_COLS)}

-- ---------------------------------------------------------------------------
-- Neue Reise: Inhalte der Vorlage als Planungsbestand übernehmen.
-- Tage werden bewusst leer gelassen – im Web-UI gibt es dafür
-- „Wünscheliste → ⚡ Automatisch verteilen“.
-- ---------------------------------------------------------------------------
delete from public.places   where trip_id = 'trip-2026';
delete from public.hotels   where trip_id = 'trip-2026';
delete from public.journeys where trip_id = 'trip-2026';

insert into public.places (id, trip_id, ${PLACE_COLS.filter((c) => c !== 'id' && c !== 'trip_id').join(', ')})
select 'pl26-' || gen_random_uuid()::text,
       'trip-2026',
       p.name, p.city, p.district, p.category,
       null,                              -- Tag: bewusst offen für die neue Planung
       p.time_slot, p.start_time, p.duration_min, p.travel_time,
       p.notes, p.price_eur, p.price_note,
       'offen',                           -- neu zu buchen
       p.booking_url, p.priority, p.maps_query, p.lat, p.lng, p.image_url, p.sort_order
from public.places p
where p.trip_id = '${seed.trips[0].id}';

insert into public.hotels (id, trip_id, name, city, check_in, check_out, nights, price_total_eur, price_per_night_eur, address, lat, lng, booking_url, booking_status, notes)
select 'ht26-' || gen_random_uuid()::text,
       'trip-2026',
       h.name || ' (2026)',
       h.city,
       (t.start_date + (h.check_in - t2.start_date))::date,
       (t.start_date + (h.check_out - t2.start_date))::date,
       h.nights,
       h.price_total_eur,
       h.price_per_night_eur,
       h.address,
       h.lat, h.lng, h.booking_url,
       'offen',
       'Aus der Vorjahresreise übernommen – Preis und Verfügbarkeit prüfen.'
from public.hotels h
cross join (select start_date from public.trips where id = 'trip-2026') t
cross join (select start_date from public.trips where id = '${seed.trips[0].id}') t2
where h.trip_id = '${seed.trips[0].id}';

insert into public.journeys (id, trip_id, date, title, from_city, to_city, mode, departure_time, duration_min, price_eur, hotel_name, nights, booking_status, notes)
select 'jn26-' || gen_random_uuid()::text,
       'trip-2026',
       (t.start_date + (j.date - t2.start_date))::date,
       j.title, j.from_city, j.to_city, j.mode, j.departure_time, j.duration_min, j.price_eur, j.hotel_name, j.nights,
       'offen',
       'Verschobener Reiseverlauf aus der Vorlage – Uhrzeiten und Preise aktualisieren.'
from public.journeys j
cross join (select start_date from public.trips where id = 'trip-2026') t
cross join (select start_date from public.trips where id = '${seed.trips[0].id}') t2
where j.trip_id = '${seed.trips[0].id}' and j.date is not null;

commit;

-- Kontrolle:
-- select * from public.v_trip_summary;
-- select * from public.v_day_load where trip_id = 'trip-2026' order by date;
`;

writeFileSync(join(root, 'supabase/seed.sql'), sql);
console.log(
  `supabase/seed.sql geschrieben: ${seed.trips.length} Reisen, ${seed.places.length} Orte, ${seed.hotels.length} Unterkünfte, ${seed.journeys.length} Etappen, ${seed.expenses.length} Ausgaben`,
);
