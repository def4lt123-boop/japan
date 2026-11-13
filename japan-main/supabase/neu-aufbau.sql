-- Reiseplan – der Speicher in Supabase von Grund auf neu
--
-- Wozu: ein halblauter Stand ist die häufigste Fehlerquelle – eine Spalte fehlt,
-- eine Richtlinie (RLS) steht nicht, der Zwischenspeicher von PostgREST kennt
-- die neue Tabelle noch nicht. Dieser Durchgang macht aus allem einen Anfang.
--
-- ⚠  Er löscht ALLES im Schema public: jede Tabelle, jede Sicht, jede Sequenz
--    und jede dort eigen angelegte Zählung. Für ein Projekt, das nur die zwei
--    Blätter dieser App kennt, ist das der Sinn. An einem gemeinsamen Projekt
--    vorher die Zeilen sichern: in der App unter Profil → „als Datei sichern“.
--
-- Ausführen:
--   Supabase → Projekt → SQL Editor → Neue Abfrage → dieser Text → Run
--   am Rechner: psql "$SUPABASE_DB_URL" -f supabase/neu-aufbau.sql
--
-- Der Neuanfang ist erst fertig, wenn unten „reisen 0 / eintraege 0“ steht. Der
-- Stand auf dem einzelnen Gerät wird beim nächsten Öffnen vom leeren Online-Stand
-- ersetzt – wer ihn behalten will, sichert ihn vorher als Datei und lädt sie
-- nach dem Neuaufbau wieder hoch (Profil → „Datei laden“).

begin;

-- ── 1 · aufräumen ───────────────────────────────────────────────────────────
-- erst die beiden Blätter dieser App, dann alles, was sonst noch in public steht
drop table if exists public.eintraege cascade;
drop table if exists public.reisen cascade;

do $$
declare
  ding record;
begin
  for ding in select tablename as name from pg_tables where schemaname = 'public' loop
    raise notice 'Tabelle public.% wird fallengelassen', ding.name;
    execute format('drop table if exists public.%I cascade', ding.name);
  end loop;
  for ding in select viewname as name from pg_views where schemaname = 'public' loop
    raise notice 'Sicht public.% wird fallengelassen', ding.name;
    execute format('drop view if exists public.%I cascade', ding.name);
  end loop;
  for ding in select matviewname as name from pg_matviews where schemaname = 'public' loop
    execute format('drop materialized view if exists public.%I cascade', ding.name);
  end loop;
  for ding in select sequence_name as name from information_schema.sequences where sequence_schema = 'public' loop
    execute format('drop sequence if exists public.%I cascade', ding.name);
  end loop;
  for ding in select t.typname as name
    from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typtype in ('e', 'd') loop
    execute format('drop type if exists public.%I cascade', ding.name);
  end loop;
end $$;

-- ── 2 · anlegen ─────────────────────────────────────────────────────────────
-- genau das Blatt aus supabase/schema.sql – von Hand übernommen, nicht nacherzählt

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
  preis            numeric(12, 2),
  waehrung         text,
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

-- ── 3 · rechte ──────────────────────────────────────────────────────────────
-- Ohne Konto, aber mit Adresse: die Rollen von Supabase dürfen die Blätter sehen
-- und ändern. Auf anderem Postgres heißen die Rollen anders – dann sind diese
-- beiden Zeilen einfach unnütz und dürfen bleiben.
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete, references, trigger on all tables in schema public to anon, authenticated;

-- ── 4 · nachprüfen – lieber hier laut als später still ──────────────────────
-- Steht das Blatt anders als die App schreibt, bricht dieser Durchgang ab und
-- der Neuanfang bleibt ganz aus (ein Schritt, keine halbe Arbeit).
do $$
declare
  n integer;
begin
  select count(*) into n from information_schema.columns
    where table_schema = 'public' and table_name = 'reisen';
  if n <> 14 then raise exception 'reisen hat % Spalten – die App schreibt 14', n; end if;

  select count(*) into n from information_schema.columns
    where table_schema = 'public' and table_name = 'eintraege';
  if n <> 24 then raise exception 'eintraege hat % Spalten – die App schreibt 24', n; end if;

  if not exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'eintraege' and column_name = 'waehrung') then
    raise exception 'eintraege.waehrung fehlt – ein Preis ohne Währung ist geraten';
  end if;
  if not exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'eintraege' and column_name = 'bis_date') then
    raise exception 'eintraege.bis_date fehlt – ohne Ende tagt ein Bett nur in einer Nacht';
  end if;
  if not exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'reisen' and column_name = 'cover_credit') then
    raise exception 'reisen.cover_credit fehlt – der Bildnachweis hätte keinen Ort';
  end if;

  if not exists (select 1 from pg_constraint
    where conrelid = 'public.eintraege'::regclass and contype = 'f' and confdeltype = 'c') then
    raise exception 'die Kaskade von eintraege.reise_id fehlt – eine gelöschte Reise ließe ihre Einträge zurück';
  end if;

  if not exists (select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'eintraege' and indexname = 'eintraege_reise_tag_idx') then
    raise exception 'der Index über Reise und Tag fehlt – der Kalender liest die ganze Liste';
  end if;

  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'reisen';
  if n <> 4 then raise exception 'reisen hat % Richtlinien – gebraucht werden vier, sonst schreibt die App ins Leere', n; end if;
  select count(*) into n from pg_policies where schemaname = 'public' and tablename = 'eintraege';
  if n <> 4 then raise exception 'eintraege hat % Richtlinien – gebraucht werden vier', n; end if;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    if not has_table_privilege('anon', 'public.reisen', 'insert') then
      raise exception 'anon darf in reisen nicht schreiben – die Rechte sind nicht gestellt';
    end if;
    if not has_table_privilege('anon', 'public.eintraege', 'select') then
      raise exception 'anon darf eintraege nicht lesen – die App bleibt leer, obwohl Daten da sind';
    end if;
  end if;

  raise notice 'Blätter prüfen: 14 und 24 Spalten, je vier Richtlinien, Rechte gesetzt';
end $$;

commit;

-- ── 5 · bericht ─────────────────────────────────────────────────────────────
select 'reisen' as blatt, (select count(*) from public.reisen) as zeilen
union all
select 'eintraege', (select count(*) from public.eintraege);

-- ── 6 · PostgREST den alten Zwischenspeicher vergessen lassen ───────────────
-- Nach einer Tabellenänderung kann die Antwort „Could not find the table …“ sein,
-- bis der Dienst neu hinschaut. Auf anderem Postgres gibt es den Kanal nicht.
do $$
begin
  execute 'notify pgrst, ''reload schema''';
exception
  when others then raise notice 'kein PostgREST-Kanal – Hilfreich wäre: Projekt → Settings → API → Restart';
end $$;
