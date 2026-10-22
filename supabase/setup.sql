-- ============================================================================
-- Urlaubsplaner – ERSTES SETUP: Tabellen + Zugriff + Beispieldaten, ein File
-- Automatisch erzeugt – Quelle: data/seed.json / supabase/schema.sql
-- Neu erzeugen: node scripts/emit-seed-sql.mjs  (npm run seed:sql)
-- Idempotent: bestehende Zeilen werden nie überschrieben,
-- die neue Reise 'trip-2027' wird nur gefüllt wenn sie noch leer ist.
-- ============================================================================

-- 1) Schema, Sichten, RLS-Policies

-- ============================================================================
-- Urlaubsplaner – Schema für Supabase (Postgres)
-- Ausführen im Supabase Dashboard → SQL Editor (oder: supabase db reset)
-- afterwards optional: supabase/seed.sql einspielen (Beispieldaten des Vorjahres)
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Reisen
-- ---------------------------------------------------------------------------
create table if not exists public.trips (
  id           text primary key,
  name         text not null,
  destination  text,
  start_date   date,
  end_date     date,
  travelers    integer not null default 2 check (travelers > 0),
  budget_eur   numeric(12, 2),
  jpy_rate     numeric(10, 2),          -- 1 EUR = x JPY
  notes        text,
  archived     boolean not null default false,
  started      boolean not null default false,  -- ▶️ Unterwegs-Modus: Tagesseite statt Planung
  started_at   date,                            -- seit wann
  planned_start date,                           -- Zeitraum vor dem Start (für „Start zurücknehmen")
  planned_end   date,
  created_at   timestamptz not null default now(),
  constraint trips_date_order check (end_date is null or start_date is null or end_date >= start_date)
);

-- ---------------------------------------------------------------------------
-- Orte / Programmpunkte – eine Zeile = ein Punkt (date null = Wünscheliste, end_date = Mehrtagespunkt)
-- ---------------------------------------------------------------------------
create table if not exists public.places (
  id            text primary key,
  trip_id       text not null references public.trips (id) on delete cascade,
  name          text not null,
  city          text not null default '',
  district      text,
  category      text,
  date          date,                                  -- NULL = Wünscheliste/Pool
  end_date      date,                                  -- optional: Ende eines Mehrtages-Punkts
  time_slot     text,                                  -- Vormittag, Abend, …
  start_time    time,
  duration_min  integer check (duration_min is null or duration_min >= 0),
  travel_time   text,                                  -- Fahrzeit vom Hotel
  notes         text,
  price_eur     numeric(12, 2),
  price_note    text,
  booking_status text not null default 'offen' check (booking_status in ('offen','reserviert','gebucht','erledigt')),
  booking_url   text,
  priority      text not null default 'soll' check (priority in ('muss','soll','kann')),
  ticket_status text not null default 'unklar' check (ticket_status in ('unklar','noetig','gekauft','keins')),
  ticket_note     text,                                  -- z. B. „Timed Entry 10:00, 2 Personen"
  maps_query    text,                                  -- Suchbegriff, falls ohne Koordinaten
  lat           double precision,
  lng           double precision,
  image_url     text,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  constraint places_coords_range check (
    (lat is null or (lat between -90 and 90)) and (lng is null or (lng between -180 and 180))
  ),
  constraint places_date_order check (end_date is null or date is null or end_date >= date)
);

-- ---------------------------------------------------------------------------
-- Unterkünfte inkl. Preis
-- ---------------------------------------------------------------------------
create table if not exists public.hotels (
  id                  text primary key,
  trip_id             text not null references public.trips (id) on delete cascade,
  name                text not null,
  city                text not null default '',
  check_in            date,
  check_out           date,
  nights              integer check (nights is null or nights >= 0),
  price_total_eur     numeric(12, 2),
  price_per_night_eur numeric(12, 2),
  address             text,
  lat                 double precision,
  lng                 double precision,
  booking_url         text,
  booking_status      text not null default 'offen' check (booking_status in ('offen','reserviert','gebucht','erledigt')),
  notes               text,
  created_at          timestamptz not null default now(),
  constraint hotels_date_order check (check_out is null or check_in is null or check_out >= check_in)
);

-- ---------------------------------------------------------------------------
-- Reiseverlauf / Etappen (Flüge, Shinkansen, Hotelwechsel)
-- ---------------------------------------------------------------------------
create table if not exists public.journeys (
  id             text primary key,
  trip_id        text not null references public.trips (id) on delete cascade,
  date           date,
  end_date       date,                                  -- Ankunft / Rückflug
  title          text not null,
  from_city      text,
  to_city        text,
  mode           text,
  departure_time time,
  duration_min   integer,
  price_eur      numeric(12, 2),
  hotel_name     text,
  nights         integer,
  booking_status text not null default 'offen' check (booking_status in ('offen','reserviert','gebucht','erledigt')),
  notes          text,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Zusätzliche Ausgaben (Essen, Shopping, Wäsche, …)
-- ---------------------------------------------------------------------------
create table if not exists public.expenses (
  id          text primary key,
  trip_id     text not null references public.trips (id) on delete cascade,
  date        date,
  category    text not null default 'Sonstiges',
  description text,
  amount_eur  numeric(12, 2) not null default 0,
  payer       text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indizes
-- ---------------------------------------------------------------------------
create index if not exists places_trip_date_idx  on public.places (trip_id, date nulls last, sort_order);
create index if not exists places_trip_city_idx  on public.places (trip_id, city);
create index if not exists hotels_trip_idx       on public.hotels (trip_id, check_in);
create index if not exists journeys_trip_idx     on public.journeys (trip_id, date);
create index if not exists expenses_trip_idx     on public.expenses (trip_id, date);

-- ---------------------------------------------------------------------------
-- Sichten für Übersichten / Auswertungen
-- ---------------------------------------------------------------------------
create or replace view public.v_trip_summary as
select
  t.id,
  t.name,
  t.start_date,
  t.end_date,
  greatest(1, (t.end_date - t.start_date) + 1)                                   as days,
  (select count(*) from public.places p where p.trip_id = t.id)                   as places,
  (select count(*) from public.places p where p.trip_id = t.id and p.date is null) as places_unplanned,
  (select count(*) from public.places p where p.trip_id = t.id and p.lat is null)  as places_without_coords,
  (select coalesce(sum(p.duration_min), 0) / 60.0 from public.places p where p.trip_id = t.id) as program_hours,
  (select count(*) from public.hotels h where h.trip_id = t.id)                    as hotels,
  (select coalesce(sum(h.nights), 0) from public.hotels h where h.trip_id = t.id)  as nights,
  (select coalesce(sum(h.price_total_eur), 0) from public.hotels h where h.trip_id = t.id) as hotel_cost,
  (select coalesce(sum(j.price_eur), 0) from public.journeys j where j.trip_id = t.id)     as transport_cost,
  (select coalesce(sum(p.price_eur), 0) from public.places p where p.trip_id = t.id)       as ticket_cost,
  (select coalesce(sum(e.amount_eur), 0) from public.expenses e where e.trip_id = t.id)     as expense_cost,
  (select coalesce(sum(h.price_total_eur), 0) from public.hotels h where h.trip_id = t.id)
  + (select coalesce(sum(j.price_eur), 0) from public.journeys j where j.trip_id = t.id)
  + (select coalesce(sum(p.price_eur), 0) from public.places p where p.trip_id = t.id)
  + (select coalesce(sum(e.amount_eur), 0) from public.expenses e where e.trip_id = t.id)  as total_cost
from public.trips t;

-- Tage mit Auslastung – praktisch für Reports / SQL-Studio
create or replace view public.v_day_load as
select
  p.trip_id,
  p.date,
  count(*)                                              as places,
  coalesce(sum(p.duration_min), 0)                      as minutes,
  coalesce(sum(p.price_eur), 0)                         as cost_eur,
  array_agg(p.name order by p.start_time nulls last, p.sort_order) as names
from public.places p
where p.date is not null
group by p.trip_id, p.date;

-- ---------------------------------------------------------------------------
-- Zugriff: persönliche App ohne Auth → anonyme Lese-/Schreibrechte.
-- Wer es privater mag: Supabase Auth aktivieren und `to authenticated` ändern
-- sowie die anon-Policies löschen.
-- ---------------------------------------------------------------------------
alter table public.trips    enable row level security;
alter table public.places   enable row level security;
alter table public.hotels   enable row level security;
alter table public.journeys enable row level security;
alter table public.expenses enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['trips','places','hotels','journeys','expenses'] loop
    execute format('drop policy if exists "urlaubsplaner anon select" on public.%I', t);
    execute format('create policy "urlaubsplaner anon select" on public.%I for select using (true)', t);
    execute format('drop policy if exists "urlaubsplaner anon insert" on public.%I', t);
    execute format('create policy "urlaubsplaner anon insert" on public.%I for insert with check (true)', t);
    execute format('drop policy if exists "urlaubsplaner anon update" on public.%I', t);
    execute format('create policy "urlaubsplaner anon update" on public.%I for update using (true) with check (true)', t);
    execute format('drop policy if exists "urlaubsplaner anon delete" on public.%I', t);
    execute format('create policy "urlaubsplaner anon delete" on public.%I for delete using (true)', t);
  end loop;
end $$;

-- Realtime (optional): Live-Sync zwischen Handy und Laptop
do $$
begin
  execute 'alter publication supabase_realtime add table public.places';
exception when others then null; -- keine Publication vorhanden → einfach überspringen
end $$;
do $$
begin
  execute 'alter publication supabase_realtime add table public.hotels';
exception when others then null;
end $$;


-- 2) Beispieldaten

begin;

-- ---------------------------------------------------------------------------
-- Beispieldaten (Reise 2025) + Übernahme in die
-- neue Reise 'trip-2027'. Tage: Orte mit Datum werden um den Abstand der
-- Reisestarts verschoben, Orte ohne Datum starten in der Wünscheliste
-- (im UI: "Wünscheliste → ⚡ Automatisch verteilen").
-- ---------------------------------------------------------------------------

insert into public.trips (id, name, destination, start_date, end_date, travelers, budget_eur, jpy_rate, notes, archived)
values
  ('trip-2025', 'Japan 2025', 'Japan', '2025-03-01', '2025-04-09', 2, 3500, 168, 'Referenz-Reise 2025, so wie geplant – zum Anschauen und Duplizieren. Hier nichts ändern, außer du willst die Vorlage nachziehen.', true),
  ('trip-2027', 'Japan 2027', 'Japan', '2027-03-06', '2027-04-14', 2, 4200, 175, 'Neue Reise: Wünsche, Hotels und Route aus 2025 übernommen und um 105 Wochen verschoben (Start Sa 06.03.2027, gleicher Wochentag wie letztes Jahr). Tage kannst du im Reiter „Wünscheliste“ mit ⚡ Automatisch verteilen neu setzen oder per Drag & Drop.', false)
on conflict (id) do nothing;

insert into public.journeys (id, trip_id, date, end_date, title, from_city, to_city, mode, departure_time, duration_min, price_eur, hotel_name, nights, booking_status, notes)
values
  ('jn-01', 'trip-2025', '2025-03-01', null, 'Ankunft Tokio', 'Frankfurt/München', 'Tokio', 'Flug', null, null, null, 'Hotel Tokio', 7, 'erledigt', 'Suica Card am Haneda Terminal 3 kaufen – gibt es nur am Flughafen.'),
  ('jn-02', 'trip-2025', '2025-03-02', null, 'Tokio', null, 'Tokio', null, null, null, null, null, null, 'erledigt', null),
  ('jn-03', 'trip-2025', '2025-03-03', null, 'Tokio', null, 'Tokio', null, null, null, null, null, null, 'erledigt', null),
  ('jn-04', 'trip-2025', '2025-03-04', null, 'Tokio', null, 'Tokio', null, null, null, 218, null, null, 'erledigt', 'Die 218,00 € / 7 Nächte beim 04.03. gehören zum Hotel Tokio.'),
  ('jn-05', 'trip-2025', '2025-03-05', null, 'Tokio', null, 'Tokio', null, null, null, null, null, null, 'erledigt', null),
  ('jn-06', 'trip-2025', '2025-03-06', null, 'Tokio', null, 'Tokio', null, null, null, null, null, null, 'erledigt', null),
  ('jn-07', 'trip-2025', '2025-03-07', null, 'Tokio', null, 'Tokio', null, null, null, null, null, null, 'erledigt', '7 Tage Tokio gesamt.'),
  ('jn-08', 'trip-2025', '2025-03-08', null, 'Abreise Tokio nach Hakodate', 'Tokio', 'Hakodate', 'Flug', null, 95, null, 'Hotel Hakodate', 2, 'erledigt', null),
  ('jn-09', 'trip-2025', '2025-03-09', null, 'Hakodate', null, 'Hakodate', null, null, null, null, null, null, 'erledigt', '2 Nächte, 72,00 €.'),
  ('jn-10', 'trip-2025', '2025-03-10', null, 'Von Hakodate nach Osaka', 'Hakodate', 'Osaka', 'Zug', null, 300, null, 'Hotel Osaka', 15, 'erledigt', 'Shinkansen mit JR Pass – über Nagoya/Shin-Osaka.'),
  ('jn-11', 'trip-2025', '2025-03-11', null, 'Shiga', null, 'Shiga', 'Zug', null, 45, null, null, null, 'erledigt', '2 Tage Shiga (Burg Hikone, Biwa-See).'),
  ('jn-12', 'trip-2025', '2025-03-12', null, 'Shiga', null, 'Shiga', null, null, null, null, null, null, 'erledigt', null),
  ('jn-13', 'trip-2025', '2025-03-13', null, 'Kyoto', 'Osaka', 'Kyoto', 'Zug', null, 30, null, null, null, 'erledigt', '4 Tage Kyoto – gemerkt im Hotel Osaka.'),
  ('jn-14', 'trip-2025', '2025-03-14', null, 'Kyoto', null, 'Kyoto', null, null, null, null, null, null, 'erledigt', null),
  ('jn-15', 'trip-2025', '2025-03-15', null, 'Kyoto', null, 'Kyoto', null, null, null, null, null, null, 'erledigt', null),
  ('jn-16', 'trip-2025', '2025-03-16', null, 'Kyoto', null, 'Kyoto', null, null, null, null, null, null, 'erledigt', 'Amanohashidate als weitherzer Tagesausflug.'),
  ('jn-17', 'trip-2025', '2025-03-17', null, 'Osaka', null, 'Osaka', null, null, null, null, null, null, 'erledigt', null),
  ('jn-18', 'trip-2025', '2025-03-18', null, 'Osaka – Universal Studios', null, 'Osaka', null, null, null, null, null, null, 'erledigt', '15 Nächte Osaka, 601,00 € – ab hier sind die Preise notiert.'),
  ('jn-19', 'trip-2025', '2025-03-19', null, 'Osaka', null, 'Osaka', null, null, null, null, null, null, 'erledigt', null),
  ('jn-20', 'trip-2025', '2025-03-20', null, 'Osaka', null, 'Osaka', null, null, null, null, null, null, 'erledigt', null),
  ('jn-21', 'trip-2025', '2025-03-21', null, 'Osaka', null, 'Osaka', null, null, null, null, null, null, 'erledigt', '6 Tage Osaka gesamt.'),
  ('jn-22', 'trip-2025', '2025-03-22', null, 'Osaka', null, 'Osaka', null, null, null, null, null, null, 'erledigt', null),
  ('jn-23', 'trip-2025', '2025-03-23', null, 'Kobe', 'Osaka', 'Kobe', 'Zug', null, 30, null, null, null, 'erledigt', '2 Tage Kobe.'),
  ('jn-24', 'trip-2025', '2025-03-24', null, 'Kobe / Tottori', null, 'Kobe', null, null, null, null, null, null, 'offen', 'Tottori (Conan Town + Dünen) war ohne Datum überliefert – 2 Tage eingeplant, taucht im Reiseverlauf nicht auf.'),
  ('jn-25', 'trip-2025', '2025-03-25', null, 'Fahrt nach Hiroshima', 'Osaka', 'Hiroshima', 'Shinkansen', null, 100, null, 'Hotel Hiroshima', 3, 'erledigt', null),
  ('jn-26', 'trip-2025', '2025-03-26', null, 'Hiroshima', null, 'Hiroshima', null, null, null, null, null, null, 'erledigt', 'Ōkunoshima (Kanincheninsel) einplanen: 45 Min bis zur Fähre + 15 Min Fähre.'),
  ('jn-27', 'trip-2025', '2025-03-27', null, 'Hiroshima', null, 'Hiroshima', null, null, null, null, null, null, 'erledigt', '3 Nächte Hiroshima, 153,00 €.'),
  ('jn-28', 'trip-2025', '2025-03-28', null, 'Fahrt nach Tokio', 'Hiroshima', 'Tokio', 'Shinkansen', null, 240, null, null, null, 'erledigt', null),
  ('jn-29', 'trip-2025', '2025-03-29', null, 'Flug nach Okinawa', 'Tokio', 'Okinawa', 'Flug', null, 150, 55, 'Hotel Okinawa', 1, 'erledigt', '1 Nacht / 55,00 € beim 29.03., der Okinawa-Block sagt 27.03.–03.04. (7 Tage) – bitte prüfen.'),
  ('jn-30', 'trip-2025', '2025-03-30', null, 'Okinawa', null, 'Okinawa', null, null, null, null, null, null, 'erledigt', null),
  ('jn-31', 'trip-2025', '2025-03-31', null, 'Okinawa', null, 'Okinawa', null, null, null, null, null, null, 'erledigt', null),
  ('jn-32', 'trip-2025', '2025-04-01', null, 'Okinawa', null, 'Okinawa', null, null, null, null, null, null, 'erledigt', null),
  ('jn-33', 'trip-2025', '2025-04-02', null, 'Okinawa', null, 'Okinawa', null, null, null, null, null, null, 'erledigt', '1.050,00 € beim 02.04. – Zweck unklar, vermutlich Unterkunft oder Flüge.'),
  ('jn-34', 'trip-2025', '2025-04-03', null, 'Okinawa', null, 'Okinawa', null, null, null, null, null, null, 'erledigt', 'Okinawa-Block: 27.03. bis 03.04., 7 Tage.'),
  ('jn-35', 'trip-2025', '2025-04-04', null, 'Okinawa → Tokio', 'Okinawa', 'Tokio', 'Flug', null, 150, null, 'Hotel Tokio', 5, 'erledigt', null),
  ('jn-36', 'trip-2025', '2025-04-05', null, 'Tokio', null, 'Tokio', null, null, null, null, null, null, 'erledigt', null),
  ('jn-37', 'trip-2025', '2025-04-06', null, 'Tokio', null, 'Tokio', null, null, null, null, null, null, 'erledigt', null),
  ('jn-38', 'trip-2025', '2025-04-07', null, 'Tokio', null, 'Tokio', null, null, null, null, null, null, 'erledigt', '5 Nächte, 368,00 €.'),
  ('jn-39', 'trip-2025', '2025-04-08', null, 'Tokio', null, 'Tokio', null, null, null, null, null, null, 'erledigt', '6 Tage Tokio am Ende.'),
  ('jn-40', 'trip-2025', '2025-04-09', null, 'Rückflug', 'Tokio', 'Zuhause', 'Flug', null, null, null, null, null, 'erledigt', null)
on conflict (id) do nothing;

insert into public.hotels (id, trip_id, name, city, check_in, check_out, nights, price_total_eur, price_per_night_eur, address, lat, lng, booking_url, booking_status, notes)
values
  ('ht-tokio-1', 'trip-2025', 'Hotel Tokio (1. Block)', 'Tokio', '2025-03-01', '2025-03-08', 7, 218, 31.14, null, null, null, null, 'erledigt', 'Preis vom 04.03. überliefert, der Name des Hotels ist nicht notiert.'),
  ('ht-hakodate', 'trip-2025', 'Hotel Hakodate', 'Hakodate', '2025-03-08', '2025-03-10', 2, 72, 36, null, 41.7687, 140.7287, null, 'erledigt', '„Hakkodate“ – 72,00 € beim 09.03.'),
  ('ht-osaka', 'trip-2025', 'Hotel Osaka', 'Osaka', '2025-03-10', '2025-03-25', 15, 601, 40.07, null, null, null, null, 'erledigt', 'Basis für Kyoto, Kobe, Shiga, Tottori – deshalb 15 Nächte.'),
  ('ht-usj', 'trip-2025', 'The Park Front Hotel at Universal Studios Japan', 'Osaka', '2025-03-18', '2025-03-19', 1, null, null, '2 Chome-1-112 Sakurajima, Konohana Ward, Osaka', 34.6662, 135.4326, 'https://www.parkfront-hotel.com/', 'erledigt', '18.03., ganzer Tag, Super Nintendo World. Ist der Preis in den 601 € für Osaka enthalten? Unklar – nicht doppelt zählen.'),
  ('ht-hiroshima', 'trip-2025', 'Hotel Hiroshima', 'Hiroshima', '2025-03-25', '2025-03-28', 3, 153, 51, null, null, null, null, 'erledigt', null),
  ('ht-okinawa', 'trip-2025', 'Hotel Okinawa', 'Okinawa', '2025-03-29', '2025-03-30', 1, 55, 55, null, 26.2124, 127.6809, null, 'erledigt', '1 Nacht / 55 €. Der Okinawa-Block sagt aber 27.03.–03.04. (7 Tage) – und 1.050 € beim 02.04. Offener Punkt.'),
  ('ht-tokio-2', 'trip-2025', 'Hotel Tokio (2. Block)', 'Tokio', '2025-04-04', '2025-04-09', 5, 368, 73.6, null, null, null, null, 'erledigt', null)
on conflict (id) do nothing;

insert into public.places (id, trip_id, name, city, district, category, date, end_date, time_slot, start_time, duration_min, travel_time, notes, price_eur, price_note, booking_status, booking_url, priority, ticket_status, maps_query, lat, lng, image_url, sort_order)
values
  ('pl-001', 'trip-2025', 'Suica Card am Flughafen holen', 'Tokio', 'Haneda Terminal 3', 'Organisation', '2025-03-01', null, 'Vormittag', null, 30, null, 'Gibt es nur am Flughafen – Suica direkt am Haneda Terminal 3 holen.', 20, 'Kaution 500 ¥', 'erledigt', null, 'muss', 'unklar', 'Haneda Airport Terminal 3', 35.5499, 139.7787, null, 1),
  ('pl-002', 'trip-2025', 'Tokyo DisneySea', 'Tokio', 'Urayasu', 'Freizeitpark', '2025-03-05', null, 'Vormittag bis Abend', null, 480, 'Ca 1:15h', 'Tickets buchen! Ganzen Tag einplanen.', null, 'Richtwert 7.900–10.900 ¥ / Person', 'offen', 'https://www.tokyodisneyresort.jp/en/', 'muss', 'unklar', 'Tokyo DisneySea', 35.6312, 139.8776, null, 1),
  ('pl-003', 'trip-2025', 'Shinjuku Gyoen Park', 'Tokio', 'Shinjuku', 'Stadtpark', null, null, 'Tag oder Abend', null, 120, 'Ca 30 Min', 'Zusammen mit Omoide Yokocho („Piss Alley“). Kirschblüte ab Ende März.', 5, '500 ¥ Eintritt', 'offen', null, 'soll', 'unklar', 'Shinjuku Gyoen National Garden', 35.6876, 139.7104, null, 2),
  ('pl-004', 'trip-2025', 'Kabukichō', 'Tokio', 'Shinjuku', 'Stadtteil / Nachtleben', null, null, 'Bei Nacht', null, 120, 'Ca 30 Min', 'Zum Durchlaufen und Stöbern.', null, null, 'offen', null, 'kann', 'unklar', 'Kabukicho Shinjuku', 35.6958, 139.7045, null, 3),
  ('pl-005', 'trip-2025', 'Golden Gai (1-chōme-2 Nishishinjuku)', 'Tokio', 'Shinjuku', 'Traditionelle Gassen / Essen', null, null, 'Tag oder Abend', null, 60, 'Ca 30 Min', 'Zusammen mit Shinjuku Gyoen. Kleine Bars, teils Foto-Verbot.', null, null, 'offen', null, 'soll', 'unklar', 'Golden Gai Shinjuku', 35.6945, 139.7047, null, 4),
  ('pl-006', 'trip-2025', 'Ramen Tatsunoya Shinjuku', 'Tokio', 'Shinjuku', 'Ramen Restaurant', null, null, 'Abend', null, 60, 'Ca 30 Min', null, 8, '≈ 1.000–1.300 ¥', 'offen', null, 'soll', 'unklar', 'Ramen Tatsunoya Shinjuku', null, null, 'https://lh3.googleusercontent.com/p/AF1QipPKCSFjGthLq0hiFM4J9619ERebcqlb697fn8tU=s680-w680-h510', 5),
  ('pl-007', 'trip-2025', 'Disney Store Shinjuku (Takashimaya)', 'Tokio', 'Shinjuku', 'Disney Store', null, null, 'Nachmittag', null, 45, null, 'Souvenirs, wenn der Park zu voll ist.', null, null, 'offen', null, 'kann', 'unklar', 'Disney Store Shinjuku Takashimaya', null, null, null, 6),
  ('pl-008', 'trip-2025', 'Shinjuku Loft', 'Tokio', 'Shinjuku', 'Gemischtwarenladen', null, null, 'Nachmittag', null, 60, null, 'Kram, Kreativbedarf, Mitbringsel.', null, null, 'offen', null, 'kann', 'unklar', 'Shinjuku Loft', 35.6955, 139.7027, null, 7),
  ('pl-009', 'trip-2025', 'Sunshine 60 Observatory', 'Tokio', 'Ikebukuro', 'Hochhaus / Aussicht', null, null, 'Bei Nacht', null, 60, null, '„Hochhaus zum runterschauen“, über Shinjuku.', 10, '2.000–3.000 ¥ (Abend-Ticket günstiger)', 'offen', null, 'kann', 'unklar', 'Sunshine 60 Koshien Ikebukuro', 35.7296, 139.7189, null, 8),
  ('pl-010', 'trip-2025', 'Hōrin-ji', 'Tokio', 'Shinjuku', 'Tempel', null, null, 'Vormittag', null, 45, null, '„a Tempel halt mein Gott“ 😄', null, null, 'offen', null, 'kann', 'unklar', 'Horinji temple Tokyo', null, null, null, 9),
  ('pl-011', 'trip-2025', 'Akihabara', 'Tokio', 'Akihabara', 'Anime / Elektronik-Stadtteil', null, null, 'Nachmittag', null, 180, 'Ca 25 Min', 'Shoppen und Anime-Sachen kaufen.', null, null, 'offen', null, 'muss', 'unklar', 'Akihabara Electric Town', 35.7023, 139.771, null, 10),
  ('pl-012', 'trip-2025', 'Seconds Harajuku', 'Tokio', 'Harajuku', 'Anime Figuren Shop', null, null, 'Nachmittag', null, 45, null, 'Seconds Street – günstige Figuren und Kleinkram.', null, null, 'offen', null, 'kann', 'unklar', 'Seconds Harajuku', 35.6708, 139.7017, null, 11),
  ('pl-013', 'trip-2025', 'Iriya Plus Café Custom Warehouse', 'Tokio', 'Iriya', 'Café', null, null, 'Nachmittag', null, 60, null, 'Café mit tollen Süßigkeiten – uiiii.', 12, null, 'offen', null, 'kann', 'unklar', 'Iriya Plus Custom Warehouse cafe', null, null, null, 12),
  ('pl-014', 'trip-2025', 'Asakusa Shrine + Sensō-ji', 'Tokio', 'Asakusa', 'Sehenswürdigkeit', null, null, 'Bei Tageslicht', null, 120, 'Ca 30 Min', 'Kaiserpalast? / gut essen in der Nähe. Früh da sein.', 0, null, 'offen', null, 'soll', 'unklar', 'Asakusa Shrine', 35.7148, 139.7967, null, 13),
  ('pl-015', 'trip-2025', 'Tokyo Solamachi', 'Tokio', 'Sumida (am Skytree)', 'Einkaufszentrum', null, null, 'Nachmittag', null, 120, null, 'Kirby Café, Pokémon Center, Tokyo Skytree direkt daneben.', null, null, 'offen', null, 'kann', 'unklar', 'Tokyo Solamachi Skytree', 35.7126, 139.8103, null, 14),
  ('pl-016', 'trip-2025', 'Future Rose Tattoo', 'Tokio', 'Shibuya', 'Tattoo Studio', '2025-03-04', null, 'Nachmittag', '13:00:00', 60, 'Ca 45 Min', 'Termin: 2 Tattoos. Im Voraus abklären, ob Walk-ins gehen.', null, 'Nach Angebot an der Wand', 'gebucht', null, 'muss', 'unklar', 'Future Rose Tattoo Shibuya Tokyo', null, null, null, 15),
  ('pl-017', 'trip-2025', 'MEGA Don Quijote Shibuya', 'Tokio', 'Shibuya', 'Einkaufszentrum (ein Laden)', null, null, 'Nachmittag / Abend', null, 120, 'Ca 45 Min', 'Nach dem Tattoo-Termin, 24h geöffnet.', null, null, 'offen', null, 'kann', 'unklar', 'Meg Don Quijote Shibuya', null, null, null, 16),
  ('pl-018', 'trip-2025', 'Shibuya Scramble Crossing', 'Tokio', 'Shibuya', 'Kreuzung', null, null, 'Abend', null, 10, null, 'Meist genutzte Kreuzung – viele Leute. Bester Blick vom Starbucks/Magic Hours Lounge.', 0, null, 'offen', null, 'soll', 'unklar', 'Shibuya Scramble Crossing', 35.6597, 139.7007, null, 17),
  ('pl-019', 'trip-2025', 'Meiji-jingū Schrein', 'Tokio', 'Shibuya', 'Shinto Schrein', null, null, 'Tag', null, 90, null, 'Bekanntester Schrein Tokios, toller Waldweg.', 0, null, 'offen', null, 'soll', 'unklar', 'Meiji Jingu Shrine', 35.6764, 139.6993, null, 18),
  ('pl-020', 'trip-2025', 'Daiso Shibuya Center Street', 'Tokio', 'Shibuya', '100-Shop (für Locals)', null, null, 'Nachmittag', null, 40, null, 'Mitbringsel günstig.', null, null, 'offen', null, 'kann', 'unklar', 'Daiso Shibuya Center Street', null, null, null, 21),
  ('pl-021', 'trip-2025', 'Ichiran Ramen', 'Tokio', 'Shibuya (oder Shinjuku)', 'Ramen Restaurant', null, null, 'Abend', null, 60, null, 'Einzelkabinen, Tonkotsu. Auch in Shinjuku.', 11, null, 'offen', null, 'kann', 'unklar', 'Ichiran Ramen Shibuya', null, null, null, 22),
  ('pl-022', 'trip-2025', 'Gōtokuji (Katzentempel)', 'Tokio', 'Setagaya / Kawasaki', 'Tempel', null, null, 'Tag', null, 60, null, 'Maneki-neko Legende. Ticket für die kleine Ausstellung mitnehmen.', null, null, 'offen', null, 'soll', 'unklar', 'Gotokuji cat temple', null, null, null, 23),
  ('pl-023', 'trip-2025', 'FamilyMart Harajuku-Takeshita Exit', 'Tokio', 'Shibuya', 'Konbini – Essen & Schauen', null, null, 'Tag oder Abend', null, 30, null, 'Konbini-Klassiker: Egg Sandwich, Onigiri, Coffee.', 6, null, 'offen', null, 'kann', 'unklar', 'Takeshita Street Harajuku', 35.6705, 139.7015, null, 24),
  ('pl-024', 'trip-2025', 'Hands Shibuya Scramble Square', 'Tokio', 'Shibuya', 'Store für alles irgendwie', null, null, 'Nachmittag', null, 60, null, '„keine ahnung diggah“ 😅 – DIY, Beauty, Reisekram.', null, null, 'offen', null, 'kann', 'unklar', 'Hands Shibuya Scramble Square', null, null, null, 25),
  ('pl-025', 'trip-2025', 'Micasadeco & Cafe Jingumae', 'Tokio', 'Shibuya', 'Fluffy Pancakes', null, null, 'Tag oder Abend', null, 75, null, 'Soufflé-Pancakes + Deko-Laden. Vorher reservieren.', 20, null, 'offen', null, 'soll', 'unklar', 'Micasadeco Cafe Jingumae', null, null, null, 26),
  ('pl-026', 'trip-2025', 'Tagesausflug Kamakura', 'Kamakura', 'Kamakura', 'Ausflug', null, null, 'Tagesausflug', null, 420, '1–2 h', 'Schöner Ort am Meer / Sicht auf Mt. Fuji vom Enoden-Zug aus.', null, null, 'offen', null, 'soll', 'unklar', 'Kamakura Station', 35.319, 139.5468, null, 27),
  ('pl-027', 'trip-2025', 'Hokoku-ji (Bambushain)', 'Kamakura', 'Kamakura', 'Schrein / Tempel', null, null, 'Tagesausflug', null, 60, '1–2 h', 'Zu Kamakura dazu.', null, null, 'offen', null, 'kann', 'unklar', 'Hokokuji Kamakura bamboo', 35.3077, 139.5466, null, 28),
  ('pl-028', 'trip-2025', 'Tsurugaoka Hachimangū', 'Kamakura', 'Kamakura', 'Schrein / Tempel', null, null, 'Tagesausflug', null, 75, null, 'Haupt-Schrein von Kamakura, große Treppe.', 0, null, 'offen', null, 'soll', 'unklar', 'Tsurugaoka Hachimangu Kamakura', 35.314, 139.5525, null, 29),
  ('pl-029', 'trip-2025', 'Tsukiji Outer Market', 'Tokio', 'Chūō (unter Akihabara)', 'Fischmarkt', null, null, 'Vormittag', '08:00:00', 90, 'Ca 45 Min', 'Früh hin – viele Staden machen mittags zu.', 15, null, 'offen', null, 'muss', 'unklar', 'Tsukiji Outer Market', 35.6657, 139.7703, null, 30),
  ('pl-030', 'trip-2025', 'Arashiyama-Bambuswald (Tokio-Block?)', 'Tokio', null, 'Bambuswald', null, null, null, null, 90, null, 'Achtung: der berühmte Bambuswald liegt in Arashiyama (Nordwest-Kyoto), nicht außerhalb von Tokio. Tag und Stadt noch klären.', null, null, 'offen', null, 'kann', 'unklar', 'Arashiyama Bamboo Grove Kyoto', null, null, null, 31),
  ('pl-031', 'trip-2025', 'Shibakōen', 'Tokio', 'Minato', 'Großer Park', null, null, 'Nachmittag', null, 60, null, 'Blick auf Tokyo Tower vom Park.', 0, null, 'offen', null, 'kann', 'unklar', 'Shiba Park Tokyo', 35.6529, 139.7486, null, 32),
  ('pl-032', 'trip-2025', 'Kōishikawa Kōrakuen Garden', 'Tokio', 'Bunkyō', 'Garten', null, null, 'Nachmittag', null, 75, null, 'Klassischer Teichgarten, ruhiger als Shinjuku Gyoen.', 3, '300 ¥', 'offen', null, 'kann', 'unklar', 'Koishikawa Korakuen Garden', 35.7126, 139.7555, null, 33),
  ('pl-033', 'trip-2025', 'Burg Hikone', 'Shiga', 'Hikone', 'Japanische Burg', null, null, 'Vormittag', null, 120, null, 'Original-Burg, Nationaler Schatz. 15 Min Fußweg vom Bahnhof.', 6, '800 ¥ Burg + Garten', 'offen', null, 'soll', 'unklar', 'Hikone Castle', 35.3153, 136.2726, null, 1),
  ('pl-034', 'trip-2025', 'Hōsen-in', 'Shiga', 'Ohara', 'Tempel', null, null, 'Vormittag', null, 45, null, 'Liegt in Ohara (Nord-Kyoto), nicht in Shiga. Jikkō-in und Sanzen-in sind gleich daneben.', 4, null, 'offen', null, 'kann', 'unklar', 'Hosen-in Ohara Kyoto', null, null, null, 2),
  ('pl-035', 'trip-2025', 'Biwa-See', 'Shiga', 'Ōmi', 'Orientierungspunkt (See)', null, null, 'Tag', null, null, null, '„Müss ma noch schauen was genau“ – Uferpromenade in Ōtsu oder Chikubushima.', null, null, 'offen', null, 'kann', 'unklar', 'Lake Biwa', null, null, null, 3),
  ('pl-036', 'trip-2025', 'Shirahige-Schrein (Torii im Wasser)', 'Shiga', 'Takashima', 'Shinto Torii im Wasser', null, null, 'Nachmittag', null, 60, null, '„Japanisches Mont-Saint-Michel“-Gefühl bei hohem Wasserstand.', 0, null, 'offen', null, 'soll', 'unklar', 'Shirahige Shrine Takashima Biwa torii', 35.3313, 136.0505, null, 4),
  ('pl-037', 'trip-2025', 'Hachiman-bori Kanal (Nagahama)', 'Shiga', 'Nagahama', 'Wasserkanäle im Altstadtdorf', null, null, 'Nachmittag', null, 60, null, 'Rundboot-Fahrt auf dem Kanal. Nagahama ist bekannt für Tayaki (gegrillter Brassen) und Kirschblüte am Wasser.', null, null, 'offen', null, 'kann', 'unklar', 'Hachiman-bori Nagahama canal', 35.4747, 136.2803, null, 5),
  ('pl-038', 'trip-2025', 'Fushimi Inari-Taisha', 'Kyoto', 'Fushimi', '10.000 Torii + Schrein am Gipfel', null, null, 'Vormittag', '07:30:00', 180, null, 'Früh hin oder abends – oben kaum Leute, aber dunkel. Ganzer Berg: 2–3 h.', 0, null, 'offen', null, 'muss', 'unklar', 'Fushimi Inari Taisha', 34.9671, 135.7727, null, 1),
  ('pl-039', 'trip-2025', 'Kumonocha Café', 'Kyoto', 'Uji / Fushimi', 'Matcha-Café', null, null, 'Nachmittag', null, 60, null, 'Kaffee mit Matcha und Kuchi.', 7, null, 'offen', null, 'kann', 'unklar', 'Kumochacha Uji matcha cafe', null, null, null, 2),
  ('pl-040', 'trip-2025', 'Arashiyama Genrokuzanchō (Bambuswald)', 'Kyoto', 'Arashiyama', 'Bambuswald', null, null, 'Vormittag', '07:00:00', 120, null, 'Früh am Morgen wegen der vielen Leute. Tenryū-ji + Togetsukyō-Brücke dazu.', 0, null, 'offen', null, 'muss', 'unklar', 'Arashiyama Genroku-yama Bamboo Grove', 35.017, 135.6716, null, 3),
  ('pl-041', 'trip-2025', 'Kyoto International Manga Museum', 'Kyoto', 'Nakagyō', 'Museum', null, null, 'Regen-Backup', null, 120, null, '„Uns zeichnen lassen“ – Comic-Regale zum Durchstöbern.', 6, '1.000 ¥', 'offen', null, 'soll', 'unklar', 'Kyoto International Manga Museum', 35.0106, 135.7465, null, 4),
  ('pl-042', 'trip-2025', '(THISIS)SHIZEN', 'Kyoto', 'Shimogyō', 'Restaurant / Concept Store', null, null, 'Abend', null, 90, null, '„Essen ganz eigen, mit Pflanzen oder so“ – Kaiseki-Restaurant mit Garten, mittags auch Café.', 40, null, 'offen', null, 'kann', 'unklar', 'THISIS SHIZEN Kyoto', null, null, null, 5),
  ('pl-043', 'trip-2025', 'Amanohashidate View Land', 'Kyoto', 'Miyazu (Nord-Kyoto)', 'Aussichtspunkt / Sessellift', null, null, 'Tagesausflug', null, 300, 'Ca 2 h', 'Sandbank – eine der „drei schönsten Ansichten Japans“. Between-the-legs-Blick von oben.', null, 'Sessellift ≈ 1.500 ¥', 'offen', null, 'soll', 'unklar', 'Amanohashidate View Land', 35.5405, 135.21, null, 6),
  ('pl-044', 'trip-2025', 'Kifune-Schrein', 'Kyoto', 'Kibune (außerhalb)', 'Schrein', null, null, 'Nachmittag', null, 120, null, 'Im Sommer sind die Treppen mit Kerzen beleuchtet (Kibune-Kawaguchi-Bootsfahrt als Rückweg).', null, null, 'offen', null, 'soll', 'unklar', 'Kifune Shrine Kibune Kyoto', 35.1103, 135.7599, null, 7),
  ('pl-045', 'trip-2025', 'Ninenzaka & Sannenzaka', 'Kyoto', 'Higashiyama', 'Altjapanische Gasse', null, null, 'Nachmittag / Abend', null, 90, null, 'Higashiyama-ähnlich – Shops, Matcha-Eis, Kiyomizu-dera am Ende.', null, null, 'offen', null, 'soll', 'unklar', 'Ninenzaka Sannenzaka Higashiyama Kyoto', 34.9959, 135.778, null, 8),
  ('pl-046', 'trip-2025', 'Kōmyō-in Tempel', 'Kyoto', 'Higashiyama', 'Tempel', null, null, 'Nachmittag', null, 45, null, 'Kreisfenster im Kōdai-ji-Komplex – Moos + Ahorn.', 4, null, 'offen', null, 'kann', 'unklar', 'Komyoin temple Kodaiji Kyoto', null, null, null, 9),
  ('pl-047', 'trip-2025', 'Rurikō-in Tempel', 'Kyoto', 'Kita (bei Kinkaku-ji)', 'Tempel', null, null, 'Vormittag', null, 45, null, 'Kleiner, feiner Moostempel in der Kinkaku-ji-Gegend – kaum was los.', 4, null, 'offen', null, 'kann', 'unklar', 'Rurikoin temple Kyoto', null, null, null, 10),
  ('pl-048', 'trip-2025', 'Gionmachi Minamigawa / Gion-Viertel', 'Kyoto', 'Gion / Higashiyama', 'Altjapanisches Viertel + Yasaka-Schrein', null, null, 'Abend', null, 90, null, 'Geisha-Viertel. Fotografieren verboten – an die Schilder halten!', 0, null, 'offen', null, 'soll', 'unklar', 'Gionmachi Minamigawa Hanamikoji Kyoto', 35.0037, 135.7753, null, 11),
  ('pl-049', 'trip-2025', 'glänta Kyoto Ninenzaka (Custom Ring Shop)', 'Kyoto', 'Higashiyama', 'Ringe selber machen', null, null, 'Nachmittag', null, 90, null, 'Workshop – Termin online buchen.', 60, 'je nach Ring/Person', 'offen', 'https://glanta-kyoto.com/', 'muss', 'unklar', 'glanta Kyoto Ninenzaka ring shop', null, null, null, 12),
  ('pl-050', 'trip-2025', 'Nanzen-ji', 'Kyoto', 'Sakyō', 'Tempel', null, null, 'Tag', null, 90, null, 'Neben dem Gion-/Yasaka-Viertel – riesiges Sanmon-Tor + Aquädukt.', 3, null, 'offen', null, 'soll', 'unklar', 'Nanzenji Temple Kyoto', 35.0114, 135.7938, null, 13),
  ('pl-051', 'trip-2025', 'The Park Front Hotel at USJ', 'Osaka', 'Konohana-ku', 'Super Nintendo World / Universal Studios', '2025-03-18', null, 'Ganzer Tag', '08:00:00', 600, null, 'Ganzer Tag einplanen. Early Entry nutzen, Power-Up-Band vorab buchen.', 95, '1-Day-Park-Ticket ≈ 10.900 ¥', 'gebucht', 'https://www.usj.co.jp/', 'muss', 'unklar', 'Universal Studios Japan', 34.6654, 135.4323, null, 1),
  ('pl-052', 'trip-2025', 'Hatoya', 'Osaka', null, 'Matcha-Eis Laden', null, null, 'Nachmittag', null, 45, null, null, 5, null, 'offen', null, 'kann', 'unklar', 'Hatoya matcha ice cream', null, null, null, 2),
  ('pl-053', 'trip-2025', 'Osaka Castle', 'Osaka', 'Chūō-ku', 'Burg', null, null, 'Vormittag', null, 150, null, '„Der Park drum herum, nicht in die Burg hinein“ – Park + Nishinomaru reichen.', 0, 'Park frei, Burg 1.200 ¥', 'offen', null, 'soll', 'unklar', 'Osaka Castle Park', 34.6873, 135.5262, null, 3),
  ('pl-054', 'trip-2025', 'Osaka Aquarium Kaiyukan', 'Osaka', 'Minato-ku', 'Aquarium', null, null, 'Nachmittag', null, 180, null, 'Walhaie. Kombiticket mit Sky Garden lohnt oft.', 16, '2.700 ¥ (online günstiger)', 'offen', null, 'soll', 'unklar', 'Osaka Aquarium Kaiyukan', 34.6587, 135.4233, null, 4),
  ('pl-055', 'trip-2025', 'Dōtonbori Bridge', 'Osaka', 'Namba', 'Food-Meile', null, null, 'Abend', null, 120, null, 'Rundherum gutes Essen: Okonomiyaki, Takoyaki (Kukuru Dotonbori). Glico-Schild Foto.', 25, null, 'offen', null, 'muss', 'unklar', 'Dotonbori Bridge', 34.6692, 135.5018, null, 5),
  ('pl-056', 'trip-2025', 'Kajitsu no Hana Shinsaibashi', 'Osaka', 'Shinsaibashi', 'Moji Fruits (obst-Café)', null, null, 'Nachmittag', null, 60, null, 'Mojitos? – „Moji Fruits": Fruchtsandwiches und Parfaits.', 12, null, 'offen', null, 'kann', 'unklar', 'Kajitsu no hana Shinsaibashi fruit', null, null, null, 6),
  ('pl-057', 'trip-2025', 'Namba Yasaka-Schrein', 'Osaka', 'Namba', 'Fotospot (Riesen-Löwenkopf)', null, null, 'Nachmittag', null, 45, null, 'Bühne in Form eines riesigen Löwenkopfs – Glück & Theater. Kurzer, cooler Fotospot.', 0, null, 'offen', null, 'kann', 'unklar', 'Namba Yasaka Shrine', 34.6616, 135.5002, null, 7),
  ('pl-058', 'trip-2025', 'Shinsekai', 'Osaka', 'Nishinari', 'Old Town', null, null, 'Abend', null, 120, null, 'Kushikatsu-Essen, Tsūtenkaku-Turm, Retro-Atmosphäre.', 15, null, 'offen', null, 'soll', 'unklar', 'Shinsekai Osaka', 34.654, 135.5057, null, 8),
  ('pl-059', 'trip-2025', 'Katsuō-ji (Stempel-Tempel)', 'Osaka', 'Tenma', 'Tempel', null, null, 'Vormittag', null, 45, null, 'Riesiger Incense-Topf + Stempel-Schildkröten.', 0, null, 'offen', null, 'kann', 'unklar', 'Katsuoji temple Osaka', null, null, null, 9),
  ('pl-060', 'trip-2025', 'Shinsaibashisūji', 'Osaka', 'Chūō-ku', 'Einkaufsstraße', null, null, 'Nachmittag / Abend', null, 120, null, 'Dotonbori Street (auch Einkaufsmeile) – überdacht, gutes Regen-Backup.', null, null, 'offen', null, 'soll', 'unklar', 'Shinsaibashi-suji Shopping Street', 34.6718, 135.5013, null, 10),
  ('pl-061', 'trip-2025', 'Daimaru Shinsaibashi', 'Osaka', 'Shinsaibashi', 'Anime / Figuren Shopping', null, null, 'Nachmittag', null, 90, null, 'Figuren usw. – Dachgeschoss = Food Court.', null, null, 'offen', null, 'kann', 'unklar', 'Daimaru Shinsaibashi', 34.6712, 135.5006, null, 11),
  ('pl-062', 'trip-2025', 'Tagesausflug Nara', 'Nara', 'Nara', 'Tagesausflug', null, null, 'Tagesausflug', null, 420, 'Ca 45 Min ab Osaka', 'Nara-Park, Tōdai-ji, Kasuga-Schrein. Der Kifune-Schrein gehört nicht hierher – der liegt in Kyoto.', 0, 'Hirsch-Cracker 200 ¥', 'offen', null, 'muss', 'unklar', 'Nara Park', 34.6851, 135.843, null, 12),
  ('pl-063', 'trip-2025', 'Tagesausflug Wakayama', 'Wakayama', 'Wakayama', 'Tagesausflug', null, null, 'Tagesausflug', null, 420, null, '„müssen no schauen“ – Optionen: Fish Market um 6 Uhr, Wakayama Castle.', null, null, 'offen', null, 'kann', 'unklar', 'Wakayama Castle', 34.231, 135.171, null, 13),
  ('pl-064', 'trip-2025', 'Naruto x Boruto Park – Nijigen no Mori', 'Kobe', 'Awaji (Mugil Bay)', 'Freizeitpark', null, null, 'Tagesausflug', null, 360, null, 'Liegt auf Awaji-Insel (Mugil Bay Park), nicht direkt in Kobe. Seilbahn + Riesenrad dort.', 30, 'Tageskarte variiert stark', 'offen', null, 'soll', 'unklar', 'Nijigen no Mori Awaji Ninja Village', null, null, null, 1),
  ('pl-065', 'trip-2025', 'Mount Rokkō', 'Kobe', 'Rokko', 'Berg + Umgebung', null, null, 'Nachmittag bis Abend', null, 240, null, '„müssen no schauen“. 10-Million-Dollar-Night-View, Alpina-Rokko (Sesselbahn).', 10, 'Parkgebühr 600 ¥ + Seilbahn', 'offen', null, 'soll', 'unklar', 'Mount Rokko Kobi View Platform', 34.7603, 135.2247, null, 2),
  ('pl-066', 'trip-2025', 'Arima Onsen – Ryokan Hanamusubi', 'Kobe', 'Kita-ku', 'Onsen / Ryokan', null, null, 'Tagesausflug', null, 480, null, 'Einer der ältesten Onsen-Orte Japans. Tagesbad möglich ohne Übernachtung.', 35, 'Tagesbetrieb ~ 2.000–4.000 ¥, Übernachtung deutlich mehr', 'offen', null, 'kann', 'unklar', 'Arima Onsen Kobe', 34.797, 135.284, null, 3),
  ('pl-067', 'trip-2025', 'Goshō Aoyama Manga Factory', 'Tottori', 'Hokuei', 'Conan Town / Museum', null, null, 'Vormittag', null, 90, null, 'Detektiv-Conan-Dorf mit statues an der Bahnlinie.', 6, '700 ¥', 'offen', null, 'kann', 'unklar', 'Gosho Aoyama Manga Factory', null, null, null, 1),
  ('pl-068', 'trip-2025', 'Tottori-Sanddünen', 'Tottori', 'Tottori', 'Wüste / Dünen', null, null, 'Nachmittag', null, 150, null, 'Camel Ride, Sand Museum daneben. Sonnenuntergang ist das beste Licht.', 8, 'Dünen frei, Kamel extra', 'offen', null, 'soll', 'unklar', 'Tottori Sand Dunes', 35.5533, 134.2278, null, 2),
  ('pl-069', 'trip-2025', 'Hiroshima Castle', 'Hiroshima', 'Naka-ku', 'Burg + Umgebung', null, null, 'Vormittag', null, 90, null, null, 4, '400 ¥', 'offen', null, 'soll', 'unklar', 'Hiroshima Castle', 34.4045, 132.4587, null, 1),
  ('pl-070', 'trip-2025', 'Shukkeien-Garten', 'Hiroshima', 'Naka-ku', 'Garten in der Stadt', null, null, 'Nachmittag', null, 60, null, 'Nur 10 Min von der Burg.', 3, '260 ¥', 'offen', null, 'kann', 'unklar', 'Shukkeien Garden Hiroshima', 34.3943, 132.4521, null, 2),
  ('pl-071', 'trip-2025', 'Hondōri Shopping Street', 'Hiroshima', 'Naka-ku', 'Einkaufsstraße', null, null, 'Abend', null, 90, null, 'Okonomimura (Essen-Haus) daneben – Muss für Hiroshima-Style Okonomiyaki.', 12, null, 'offen', null, 'soll', 'unklar', 'Hondori Shopping Arcade Hiroshima', 34.3955, 132.4595, null, 3),
  ('pl-072', 'trip-2025', 'Daishō-in (Miyajima)', 'Hiroshima', 'Miyajima', 'Schrein/Tempel auf der Insel', null, null, 'Vormittag', '08:00:00', 120, '45 Min + 15 Min Fähre', '1.000 steinerne Laternen am Hang + Aussicht über die Bucht. Fähre ab Miyajimaguchi (15 Min).', 15, 'Fähre ≈ 200 ¥ one-way', 'offen', null, 'muss', 'unklar', 'Daishoin temple Miyajima', null, null, null, 4),
  ('pl-073', 'trip-2025', 'Ōkunoshima (Kaninchen-Insel)', 'Hiroshima', 'Takeshima', 'Rabbit Island', null, null, 'Tagesausflug', '09:00:00', 300, '45 Min bis Fähre + 15 Min Fähre', 'Fütterung mit Karotten KAUFEN (vor Ort teurer), keine Essensreste wegwerfen. Giftgas-Museum mitgehen.', 25, 'Fähre + Museum', 'offen', null, 'muss', 'unklar', 'Okunoshima rabbit island', 34.3389, 132.3636, null, 5),
  ('pl-074', 'trip-2025', 'Okinawa (Strand & Inseltour)', 'Okinawa', 'Inselgruppe', 'Urlaub / Strand', '2025-03-27', null, 'Ganzer Tag', null, null, null, '27.03.–03.04., 7 Tage, ohne Programm. Nachholen für 2027: Shuri-Jō, Manmo Beach, Manzamo, Ryukyu Mura, Churaumi-Aquarium.', null, null, 'offen', null, 'soll', 'unklar', 'Okinawa main island', 26.3345, 127.8051, null, 1),
  ('pl-075', 'trip-2025', 'Berg Yōmei & Panorama', 'Hakodate', 'Hakodate', 'Aussichtspunkt', null, null, 'Bei Nacht', null, 120, null, 'Neu für 2027 dazugenommen: Seilbahn rauf, einer der besten Night Views Japans.', 12, 'Seilbahn ~ 1.280 ¥ retour', 'offen', null, 'soll', 'unklar', 'Mount Hakodate ropeway', 41.758, 140.734, null, 1),
  ('pl-076', 'trip-2025', 'Morgenmarkt Hakodate', 'Hakodate', 'Hakodate', 'Markt / Frühstück', null, null, 'Vormittag', '07:00:00', 90, null, 'Neu für 2027 dazugenommen: Fisch-Restaurant-Straße, danach Yunokawa Onsen (Meerwasser-Bäder).', 12, null, 'offen', null, 'kann', 'unklar', 'Hakodate Morning Market', 41.8106, 140.7451, null, 2)
on conflict (id) do nothing;

insert into public.expenses (id, trip_id, date, category, description, amount_eur, payer)
values
  ('ex-01', 'trip-2025', '2025-03-01', 'Transport', 'JR Pass 14 Tage (2 Personen)', 0, null),
  ('ex-02', 'trip-2025', '2025-03-01', 'Organisation', 'Suica Cards am Haneda T3', 40, null),
  ('ex-03', 'trip-2025', '2025-04-02', 'Sonstiges', '1.050,00 € beim Okinawa-Block (02.04.) – Zweck klären', 1050, null)
on conflict (id) do nothing;

insert into public.places (id, trip_id, name, city, district, category, date, end_date, time_slot, start_time, duration_min, travel_time, notes, price_eur, price_note, booking_status, booking_url, priority, ticket_status, maps_query, lat, lng, image_url, sort_order)
select 'pl27-' || gen_random_uuid()::text,
       'trip-2027',
       p.name, p.city, p.district, p.category,
       case when p.date is null then null
            else (p.date + (neu.start_date - alt.start_date))::date end,
       case when p.end_date is null then null
            else (p.end_date + (neu.start_date - alt.start_date))::date end,
       p.time_slot, p.start_time, p.duration_min, p.travel_time,
       p.notes, p.price_eur, p.price_note,
       'offen', p.booking_url, p.priority, 'unklar', p.maps_query, p.lat, p.lng, p.image_url, p.sort_order
from public.places p
join public.trips alt on alt.id = p.trip_id
join public.trips neu on neu.id = 'trip-2027'
where p.trip_id = 'trip-2025'
  and not exists (select 1 from public.places x where x.trip_id = 'trip-2027');

insert into public.hotels (id, trip_id, name, city, check_in, check_out, nights, price_total_eur, price_per_night_eur, address, lat, lng, booking_url, booking_status, notes)
select 'ht27-' || gen_random_uuid()::text,
       'trip-2027',
       h.name, h.city,
       (h.check_in + (neu.start_date - alt.start_date))::date,
       (h.check_out + (neu.start_date - alt.start_date))::date,
       h.nights, h.price_total_eur, h.price_per_night_eur, h.address, h.lat, h.lng, h.booking_url,
       'offen',
       'Aus der Vorlage übernommen – Preis und Verfügbarkeit neu prüfen.'
from public.hotels h
join public.trips alt on alt.id = h.trip_id
join public.trips neu on neu.id = 'trip-2027'
where h.trip_id = 'trip-2025'
  and not exists (select 1 from public.hotels x where x.trip_id = 'trip-2027');

insert into public.journeys (id, trip_id, date, end_date, title, from_city, to_city, mode, departure_time, duration_min, price_eur, hotel_name, nights, booking_status, notes)
select 'jn27-' || gen_random_uuid()::text,
       'trip-2027',
       (j.date + (neu.start_date - alt.start_date))::date,
       case when j.end_date is null then null else (j.end_date + (neu.start_date - alt.start_date))::date end,
       j.title, j.from_city, j.to_city, j.mode, j.departure_time, j.duration_min, j.price_eur, j.hotel_name, j.nights,
       'offen',
       'Verschobener Reiseverlauf aus der Vorlage – Uhrzeiten und Preise aktualisieren.'
from public.journeys j
join public.trips alt on alt.id = j.trip_id
join public.trips neu on neu.id = 'trip-2027'
where j.trip_id = 'trip-2025'
  and j.date is not null
  and not exists (select 1 from public.journeys x where x.trip_id = 'trip-2027');

-- Kontrolle (optional):
--   select id, name, places, nights, total_cost from public.v_trip_summary;
--   select * from public.v_day_load where trip_id = 'trip-2027' order by date;
--
-- Hart zurücksetzen (überschreibt deine Arbeit!):
--   delete from public.trips where id in ('trip-2025', 'trip-2027');   -- kaskadiert
--   ... danach dieses File erneut ausführen.

commit;
