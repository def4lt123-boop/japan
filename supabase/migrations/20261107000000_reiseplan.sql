-- Reiseplan – Datentabelle für Supabase (oder jedes andere Postgres).
-- Ohne diese Tabellen läuft die App auf dem Gerät; mit ihnen liegt alles online
-- und jede Person, die die Adresse kennt, kann sehen und ändern.

create table if not exists public.reisen (
  id            text primary key,
  name          text not null,
  land          text,
  stationen     text,
  start_date    date,
  end_date      date,
  cover_url     text,
  cover_credit  text,
  beschreibung  text,
  budget        numeric(12, 2),
  waehrung      text not null default 'EUR',
  personen      integer not null default 2,
  archived      boolean not null default false,
  erstellt_am   timestamptz not null default now()
);

create table if not exists public.eintraege (
  id               text primary key,
  reise_id         text not null references public.reisen(id) on delete cascade,
  art              text not null default 'aktivitaet' check (art in ('aktivitaet', 'unterkunft', 'fahrt')),
  kategorie        text,
  titel            text not null,
  date             date,
  zeit             time,
  bis_zeit         time,
  dauer_min        integer,
  bis_date         date,
  ort              text,
  adresse          text,
  lat              double precision,
  lng              double precision,
  karten_stichwort text,
  notiz            text,
  preis           numeric(12, 2),
  buchung_nr       text,
  buchung_url      text,
  foto_url         text,
  foto_nachweis    text,
  sortierung       integer not null default 1,
  erstellt_am      timestamptz not null default now()
);

create index if not exists eintraege_reise_tag_idx on public.eintraege (reise_id, date, sortierung);
create index if not exists eintraege_art_idx on public.eintraege (reise_id, art);

alter table public.reisen enable row level security;
alter table public.eintraege enable row level security;

-- Offen ohne Konto: lesen und schreiben darf, wer die Adresse der App kennt.
create policy "reisen offen lesen" on public.reisen for select using (true);
create policy "reisen offen ändern" on public.reisen for insert with check (true);
create policy "reisen offen schreiben" on public.reisen for update using (true) with check (true);
create policy "reisen offen löschen" on public.reisen for delete using (true);
create policy "eintraege offen lesen" on public.eintraege for select using (true);
create policy "eintraege offen ändern" on public.eintraege for insert with check (true);
create policy "eintraege offen schreiben" on public.eintraege for update using (true) with check (true);
create policy "eintraege offen löschen" on public.eintraege for delete using (true);
