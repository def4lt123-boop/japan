'use client';

/**
 * Ein Eintrag als Zeile: links, was es ist – rechts, an welchem Tag er steht und
 * an welcher Stelle. Ein Punkt liegt an genau einem Tag, und zweimal derselben
 * Name an demselben Tag ist kein Plan, sondern ein Duplikat – das wird abgewiesen.
 *
 * Uhrzeiten gibt es nicht mehr: der Tag ist eine Liste, Reihenfolge entsteht durch
 * ▲▼ oder Ziehen.
 */
import React, { useState } from 'react';
import type { Place } from '../lib/types';
import { useStore } from '../lib/store';
import { useEditor } from './EditorProvider';
import { eachDate, fmtDay, knownCity, plural } from '../lib/format';
import { TICKET_META, categoryMeta, mapsUrl, nextTicket } from '../lib/categories';
import { assign, dayPlaces, shiftWithin } from '../lib/dayplan';
import { Menu, Money, PriorityTag, Select, cx } from './ui';
import { CategoryPicker } from './CategoryPicker';
import { CategoryDot } from './CategoryDot';
import { MapPreview } from './MapPreview';

export function ActivityRow({
  place,
  all,
  dayOptions,
  dense = false,
  tripStart,
  tripEnd,
  nr,
  total,
}: {
  place: Place;
  all: Place[];
  dayOptions: { value: string; label: string }[];
  dense?: boolean;
  tripStart?: string | null;
  tripEnd?: string | null;
  /** Stelle am Tag – ohne Angabe wird sie selbst nachgezählt */
  nr?: number;
  total?: number;
}) {
  const store = useStore();
  const { open } = useEditor();
  const ticket = TICKET_META[(place.ticket_status ?? 'unklar') as keyof typeof TICKET_META] ?? TICKET_META.unklar;
  const [showMap, setShowMap] = useState(false);
  const done = place.booking_status === 'erledigt';

  const tags = place.date ? dayPlaces(all, place.date) : [];
  const stelle = nr ?? (place.date ? tags.findIndex((p) => p.id === place.id) + 1 : 0);
  const gesamt = total ?? tags.length;
  const placeOn = (date: string | null) => assign(store, all, place, { date });

  /** erster Tag im Reisezeitraum, an dem der Name noch fehlt und am wenigsten los ist */
  const nextFreeDay = () => {
    const dates = eachDate(tripStart ?? null, tripEnd ?? null);
    if (!dates.length) {
      store.say('Noch kein Zeitraum in der Reise – bitte erst Start- und Enddatum eintragen.');
      return;
    }
    const names = new Set(all.filter((p) => p.date && p.name === place.name).map((p) => p.date as string));
    const load = new Map(dates.map((d) => [d, all.filter((p) => p.date === d).length]));
    const candidates = dates.filter((d) => !names.has(d));
    const sameCity = candidates.filter((d) => all.some((p) => p.date === d && p.city === place.city));
    const target = [...(sameCity.length ? sameCity : candidates)].sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0))[0];
    if (!target) {
      store.say('Jeder Tag der Reise hat diesen Punkt schon – oder die Liste ist leer.');
      return;
    }
    assign(store, all, place, { date: target });
  };

  return (
    <div className={cx('group rounded-lg border bg-white/[0.02] transition hover:border-white/20', place.date ? 'border-white/[0.07]' : 'border-dashed border-amber-400/25', done && 'opacity-60')}>
      <div className={cx('flex flex-wrap items-start gap-x-2 gap-y-1.5', dense ? 'px-2 py-1.5' : 'px-2.5 py-2')}>
        <span className="flex shrink-0 items-center gap-1.5">
          {stelle ? <span className="w-4 text-right text-[13px] tabular-nums text-slate-400" title={gesamt ? `Stelle ${stelle} von ${gesamt}` : 'Reihenfolge am Tag'}>{stelle}</span> : null}
          <CategoryDot category={place.category} size={dense ? 18 : 21} />
        </span>

        <div className="min-w-0 flex-1 basis-[12rem]">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <button
              onClick={() => open({ kind: 'place', id: place.id })}
              className={cx('max-w-[46ch] truncate text-left text-[13.5px] font-semibold underline-offset-2 hover:underline', done ? 'text-slate-400 line-through' : 'text-white')}
              title="Bearbeiten"
            >
              {place.name}
            </button>
            <PriorityTag priority={place.priority} />
            <button
              onClick={() => store.patch('places', place.id, { ticket_status: nextTicket(place.ticket_status) })}
              title={`${ticket.label}${place.ticket_note ? ` – ${place.ticket_note}` : ''} · klicken zum Weiterschalten`}
              className={cx('chip ring-1 transition hover:brightness-125', ticket.chip)}
            >
              <span aria-hidden>{ticket.icon}</span>
              {ticket.short}
            </button>
          </div>

          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[13px] text-slate-400">
            <span>{knownCity(place.city) ?? '—'}</span>
            {place.date ? <span>· {fmtDay(place.date)}</span> : null}
            {place.price_eur ? (
              <span className="text-slate-300">
                · <Money value={place.price_eur} />
              </span>
            ) : place.price_note ? (
              <span>· {place.price_note}</span>
            ) : (
              <span className="text-slate-400">· ohne Preis</span>
            )}
            <a href={mapsUrl(place)} target="_blank" rel="noreferrer" className="text-slate-400 underline-offset-2 hover:text-white hover:underline" title="Bei Google Maps öffnen">
              · 📍 Maps
            </a>
          </div>

          {place.notes ? <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-slate-400">{place.notes}</p> : null}

          {!place.date ? <p className="mt-0.5 text-[13px] text-amber-200/80">noch an keinem Tag – rechts einen Tag wählen oder in der Tagesliste nach oben ziehen</p> : null}
        </div>

        <div className="flex max-w-full flex-wrap items-center justify-end gap-x-2 gap-y-1 rounded-xl bg-black/20 px-2 py-1.5 ring-1 ring-inset ring-white/[0.06]">
          <label className="flex min-w-0 items-center gap-1 text-[13px] text-slate-400">
            <span aria-hidden>🗓</span>
            <Select
              className="!w-auto min-w-0 max-w-[46vw] !py-1 !text-[13px]"
              allowEmpty
              emptyLabel="kein Tag"
              options={dayOptions}
              value={place.date ?? ''}
              onChange={(e) => placeOn(e.target.value || null)}
            />
          </label>
          <label className="flex items-center gap-1 text-[13px] text-slate-400" title="Kategorie">
            <span aria-hidden>🏷</span>
            <CategoryPicker size="sm" value={place.category} used={all.map((x) => x.category)} onChange={(v) => store.patch('places', place.id, { category: v })} />
          </label>
          {place.date ? (
            <span className="flex shrink-0 items-center gap-0.5">
              <button className="icon-btn !text-[13px]" title="eine Stelle höher" disabled={stelle <= 1} onClick={() => shiftWithin(store, all, place, -1)}>
                ▲
              </button>
              <button className="icon-btn !text-[13px]" title="eine Stelle tiefer" disabled={stelle >= gesamt} onClick={() => shiftWithin(store, all, place, 1)}>
                ▼
              </button>
            </span>
          ) : null}
          <Menu
            align="right"
            variant="quiet"
            icon="⋯"
            title="Mehr"
            items={[
              { icon: '✓', label: done ? 'Wieder auf offen setzen' : 'Als erledigt markieren', run: () => store.patch('places', place.id, { booking_status: done ? 'offen' : 'erledigt' }) },
              { icon: '🗺️', label: showMap ? 'Karte ausblenden' : 'Karte hier zeigen', run: () => setShowMap((v) => !v) },
              { icon: '✎', label: 'Bearbeiten', run: () => open({ kind: 'place', id: place.id }) },
              { icon: '⧉', label: 'Kopieren (ohne Tag)', run: () => open({ kind: 'place', defaults: { ...place, id: undefined, date: null, name: `${place.name} (Kopie)` } }) },
              place.date
                ? { icon: '⤓', label: 'Vom Tag lösen', hint: 'zurück nach oben in die Liste', run: () => placeOn(null) }
                : { icon: '✨', label: 'Auf den freiesten Tag', hint: 'der Tag mit den wenigsten Punkten', run: () => nextFreeDay() },
              { icon: '🗑', label: 'Löschen', danger: true, run: () => window.confirm(`„${place.name}“ löschen?`) && store.remove('places', place.id) },
            ]}
          />
        </div>
      </div>

      {showMap ? (
        <div className="border-t border-white/[0.05] p-2.5">
          <MapPreview
            place={place}
            query={`${place.name} ${place.city ?? ''}`.replace(/\s+/g, ' ').trim()}
            height={190}
            zoom={place.lat !== null ? 16 : 13}
            heading={place.name}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Kopf über einem Tagesblock: Datum, Städte, wie viel dort steht */
export function DayRowHeader({
  date,
  places,
  note,
  right,
}: {
  date: string;
  places: Place[];
  note?: React.ReactNode;
  right?: React.ReactNode;
}) {
  const cities = Array.from(new Set(places.map((p) => p.city).filter(Boolean))) as string[];
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-t-xl border-b border-white/[0.06] bg-black/25 px-3 py-2">
      <span className="text-[13px] font-semibold text-white">{fmtDay(date)}</span>
      {cities.length ? <span className="text-[13px] text-slate-400">{cities.join(' / ')}</span> : null}
      <span className="text-[13px] text-slate-400">{plural(places.length, 'Punkt', 'Punkte')}</span>
      {note ? <span className="text-[13px] text-slate-400">{note}</span> : null}
      {right ? <span className="ml-auto flex items-center gap-1">{right}</span> : null}
    </div>
  );
}
