'use client';

/**
 * Filter, die man versteht: eine Reihe Knöpfe, darunter eine Zeile Suche und Stadt.
 * Die Reihe ist walzengerecht – sie steht auf dem Handy in einer Zeile und lässt sich
 * seitlich durchziehen, der Rest der Seite bleibt, wo er ist.
 * (Die Tabellen-Seite kann zusätzlich die feinen Dropdowns einblenden.)
 */
import React, { useMemo } from 'react';
import type { Place } from '../lib/types';
import { STATUS_META, TICKET_META, TICKET_ORDER } from '../lib/categories';
import { Select, TextInput, cx } from './ui';
import { BOOKING_STATUSES } from '../lib/types';

export interface PlaceFilter {
  q: string;
  city: string;
  status: string;
  prio: string;
  ticket: string;
  missing: 'alle' | 'ohne-termin' | 'ohne-koordinaten' | 'ohne-ticket';
}

export const EMPTY_FILTER: PlaceFilter = { q: '', city: '', status: '', prio: '', ticket: '', missing: 'alle' };

/** filtert irgendwo – das steuert den „Alle“-Knopf und den Leerkasten der Liste */
export const filterActive = (f: PlaceFilter) => Boolean(f.q || f.city || f.status || f.prio || f.ticket || f.missing !== 'alle');

export function applyFilter(places: Place[], f: PlaceFilter): Place[] {
  const q = f.q.trim().toLowerCase();
  return places.filter((p) => {
    if (f.city && p.city !== f.city) return false;
    if (f.status && p.booking_status !== f.status) return false;
    if (f.prio && p.priority !== f.prio) return false;
    if (f.ticket && (p.ticket_status ?? 'unklar') !== f.ticket) return false;
    if (f.missing === 'ohne-ticket' && (p.ticket_status === 'gekauft' || p.ticket_status === 'keins')) return false;
    if (f.missing === 'ohne-termin' && p.date) return false;
    if (f.missing === 'ohne-koordinaten' && p.lat !== null && p.lng !== null) return false;
    if (!q) return true;
    const hay = [p.name, p.city, p.category, p.notes, p.price_note].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });
}

export function FilterBar({
  value,
  onChange,
  places,
  right,
  detailed = false,
}: {
  value: PlaceFilter;
  onChange: (f: PlaceFilter) => void;
  places: Place[];
  right?: React.ReactNode;
  /** Extra-Dropdowns (Status, Ticket) – nur für die Tabellen-Ansicht */
  detailed?: boolean;
}) {
  const cities = useMemo(() => Array.from(new Set(places.map((p) => p.city).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'de')), [places]);
  const set = (patch: Partial<PlaceFilter>) => onChange({ ...value, ...patch });
  const aktiv = filterActive(value);

  const count = (fn: (p: Place) => boolean) => places.filter(fn).length;
  const pills: { key: string; label: string; n: number; on: boolean; only: Partial<PlaceFilter> }[] = [
    { key: 'alle', label: 'Alle', n: places.length, on: !aktiv, only: {} },
    { key: 'tag', label: 'Ohne Tag', n: count((p) => !p.date), on: value.missing === 'ohne-termin', only: { missing: 'ohne-termin' } },
    {
      key: 'ticket',
      label: 'Ticket offen',
      n: count((p) => !p.ticket_status || p.ticket_status === 'unklar' || p.ticket_status === 'noetig'),
      on: value.missing === 'ohne-ticket',
      only: { missing: 'ohne-ticket' },
    },
    { key: 'muss', label: 'Muss', n: count((p) => p.priority === 'muss'), on: value.prio === 'muss', only: { prio: 'muss' } },
    { key: 'geo', label: 'Ohne Karte', n: count((p) => p.lat === null || p.lng === null), on: value.missing === 'ohne-koordinaten', only: { missing: 'ohne-koordinaten' } },
  ];

  return (
    <div className="no-print mb-3 space-y-1.5">
      <div className="filter-row -mx-3 flex items-center gap-1.5 overflow-x-auto px-3 pb-0.5 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        {pills.map((pill) => (
          <button
            key={pill.key}
            type="button"
            aria-pressed={pill.on}
            className={cx(
              'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-medium transition',
              pill.on ? 'bg-shu-500/20 text-white ring-1 ring-inset ring-shu-400/40' : 'bg-white/[0.045] text-slate-300 hover:bg-white/[0.08]',
            )}
            onClick={() => onChange(pill.key === 'alle' ? { ...EMPTY_FILTER } : pill.on ? { ...value, missing: 'alle', prio: '' } : { ...value, missing: 'alle', prio: '', ...pill.only })}
          >
            {pill.label}
            <span className="tabular-nums text-slate-400">{pill.n}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <div className="relative min-w-[9rem] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-500">🔎</span>
          <TextInput value={value.q} onChange={(e) => set({ q: e.target.value })} placeholder="Suchen – Name, Stadt, Hinweis, Kategorie …" className="pl-9" />
        </div>
        {cities.length > 1 ? (
          <Select className={cx('!w-auto min-w-0 max-w-[46vw]', value.city && 'border-shu-400/60')} allowEmpty emptyLabel="Alle Städte" options={cities} value={value.city} onChange={(e) => set({ city: e.target.value })} />
        ) : null}
        {right}
        {detailed ? (
          <>
            <Select
              className={cx('!w-auto !py-1 !text-[12px]', value.status && 'border-shu-400/60')}
              allowEmpty
              emptyLabel="Alle Status"
              options={BOOKING_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))}
              value={value.status}
              onChange={(e) => set({ status: e.target.value })}
            />
            <Select
              className={cx('!w-auto !py-1 !text-[12px]', value.ticket && 'border-shu-400/60')}
              allowEmpty
              emptyLabel="Alle Tickets"
              options={TICKET_ORDER.map((t) => ({ value: t, label: `${TICKET_META[t].icon} ${TICKET_META[t].short}` }))}
              value={value.ticket}
              onChange={(e) => set({ ticket: e.target.value })}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
