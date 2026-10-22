-- Migration 20261022000003 – zwei Zustände statt einem:
--   ▶️ Reise starten  = unterwegs (Tagesseite mit Ort, Route, Hinweisen)
--   ✕ Reise beenden   = wieder planen (auf Wunsch mit dem alten Zeitraum)
-- Idempotent: sicher mehrfach ausführbar.

begin;

alter table public.trips add column if not exists started       boolean not null default false;
alter table public.trips add column if not exists started_at    date;
alter table public.trips add column if not exists planned_start date;
alter table public.trips add column if not exists planned_end   date;

comment on column public.trips.started       is 'true = Unterwegs-Modus: die ☀️-Seite zeigt den Tag, nicht die Planung';
comment on column public.trips.started_at    is 'seit welchem Tag die Reise läuft';
comment on column public.trips.planned_start is 'Planungsstart vor dem Losfahren – „Start zurücknehmen" stellt ihn wieder her';
comment on column public.trips.planned_end   is 'Planungsende vor dem Losfahren';

create index if not exists trips_started_idx on public.trips (started, start_date);

commit;
