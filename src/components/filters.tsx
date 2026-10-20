'use client';

import React, { useMemo } from 'react';
import type { Place } from '../lib/types';
import { STATUS_META, categoryMeta } from '../lib/categories';
import { Select, TextInput, cx } from './ui';
import { BOOKING_STATUSES } from '../lib/types';

export interface PlaceFilter {
  q: string;
  city: string;
  status: string;
  prio: string;
  missing: 'alle' | 'ohne-termin' | 'ohne-koordinaten';
}

export const EMPTY_FILTER: PlaceFilter = { q: '', city: '', status: '', prio: '', missing: 'alle' };

export function applyFilter(places: Place[], f: PlaceFilter): Place[] {
  const q = f.q.trim().toLowerCase();
  return places.filter((p) => {
    if (f.city && p.city !== f.city) return false;
    if (f.status && p.booking_status !== f.status) return false;
    if (f.prio && p.priority !== f.prio) return false;
    if (f.missing === 'ohne-termin' && p.date) return false;
    if (f.missing === 'ohne-koordinaten' && p.lat !== null && p.lng !== null) return false;
    if (!q) return true;
    const hay = [p.name, p.city, p.district, p.category, p.notes, p.price_note, p.time_slot, p.travel_time, p.maps_query].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });
}

export function FilterBar({
  value,
  onChange,
  places,
  right,
}: {
  value: PlaceFilter;
  onChange: (f: PlaceFilter) => void;
  places: Place[];
  right?: React.ReactNode;
}) {
  const cities = useMemo(() => Array.from(new Set(places.map((p) => p.city).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'de')), [places]);
  const set = (patch: Partial<PlaceFilter>) => onChange({ ...value, ...patch });
  const active = value.q || value.city || value.status || value.prio || value.missing !== 'alle';

  return (
    <div className="no-print mb-3 flex flex-wrap items-center gap-1.5">
      <div className="relative min-w-[190px] flex-1">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-slate-500">🔎</span>
        <TextInput
          value={value.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Suchen: Ort, Hinweis, Kategorie, Preis …"
          className="pl-8"
        />
      </div>
      <Select
        className={cx('!w-auto', value.city && 'border-shu-400/60')}
        allowEmpty
        emptyLabel="Alle Städte"
        options={cities}
        value={value.city}
        onChange={(e) => set({ city: e.target.value })}
      />
      <Select
        className={cx('!w-auto', value.status && 'border-shu-400/60')}
        allowEmpty
        emptyLabel="Alle Status"
        options={BOOKING_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))}
        value={value.status}
        onChange={(e) => set({ status: e.target.value })}
      />
      <Select
        className={cx('!w-auto', value.prio && 'border-shu-400/60')}
        allowEmpty
        emptyLabel="Alle Prios"
        options={[
          { value: 'muss', label: '★ Muss' },
          { value: 'soll', label: '☆ Soll' },
          { value: 'kann', label: '· Kann' },
        ]}
        value={value.prio}
        onChange={(e) => set({ prio: e.target.value })}
      />
      <Select
        className={cx('!w-auto', value.missing !== 'alle' && 'border-shu-400/60')}
        options={[
          { value: 'alle', label: 'Alle Einträge' },
          { value: 'ohne-termin', label: 'Ohne Tag (Pool)' },
          { value: 'ohne-koordinaten', label: 'Ohne Koordinaten' },
        ]}
        value={value.missing}
        onChange={(e) => set({ missing: e.target.value as PlaceFilter['missing'] })}
      />
      {active ? (
        <button className="btn-quiet" onClick={() => onChange({ ...EMPTY_FILTER, q: '' })} title="Filter zurücksetzen">
          ✕ zurücksetzen
        </button>
      ) : null}
      {right}
      <span className="ml-auto text-[12px] text-slate-500">
        {places.length} Einträge · {places.filter((p) => p.lat === null || p.lng === null).length} ohne Koordinaten
      </span>
      <span className="hidden lg:block text-[11px] text-slate-600">
        {[...new Set(places.map((p) => categoryMeta(p.category).label))].slice(0, 6).join(' · ')}
      </span>
    </div>
  );
}
