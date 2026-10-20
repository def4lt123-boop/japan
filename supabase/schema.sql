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
