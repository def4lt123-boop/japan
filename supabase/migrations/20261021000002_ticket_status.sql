-- Migration 20261021000002 – Fragen, die die Tabelle noch nicht kannte:
--   1) Brauche ich dort ein Ticket – und ist es schon gekauft?
--   2) Einträge, die über mehrere Tage gehen (Hin-/Rückflug, Mehrtages-Ausflug)
-- Idempotent: sicher mehrfach ausführbar.

begin;

-- ------------------------------------------------------------ 1) Ticket-Status pro Ort
alter table public.places add column if not exists ticket_status text not null default 'unklar';
alter table public.places add column if not exists ticket_note   text;

do $$
begin
  alter table public.places drop constraint if exists places_ticket_status_check;
  alter table public.places add constraint places_ticket_status_check
    check (ticket_status in ('unklar', 'noetig', 'gekauft', 'keins'));
exception
  when duplicate_object then null;
end $$;

comment on column public.places.ticket_status is 'unklar | noetig = Ticket nötig | gekauft | keins = braucht man kein Ticket';
comment on column public.places.ticket_note   is 'was genau: Tagespass, Reservierung, Eintritt, Zeitfenster …';

create index if not exists places_trip_ticket_idx on public.places (trip_id, ticket_status);

-- ------------------------------------------------------------ 2) Mehrtages-Einträge (von / bis)
alter table public.places   add column if not exists end_date date;
alter table public.journeys add column if not exists end_date date;

do $$
begin
  alter table public.places drop constraint if exists places_date_order;
  alter table public.places add constraint places_date_order
    check (end_date is null or date is null or end_date >= date);
exception
  when duplicate_object then null;
end $$;

comment on column public.places.end_date   is 'bis – Mehrtages-Ausflug; leer = nur ein Tag';
comment on column public.journeys.end_date is 'Ankunft / Rückflug';

create index if not exists places_trip_span_idx on public.places (trip_id, date, end_date);

commit;

-- Nach dem Push einmal neu laden, damit die neuen Spalten im Tool sichtbar sind.
