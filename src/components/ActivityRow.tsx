'use client';

/**
 * Ein Eintrag als Zeile: links, was es ist – rechts Tag, Uhrzeit und Dauer.
 * Alles schreibt sofort in den Datensatz, über dieselbe Regel wie das Ziehen im
 * Tagesplan: ein Punkt steht an genau einem Tag, und eine belegte Zeit rutscht
 * in die nächste freie Lücke.
 */
import React, { useEffect, useMemo, useState } from 'react';
import type { Place } from '../lib/types';
import { useStore } from '../lib/store';
import { useEditor } from './EditorProvider';
import { eachDate, fmtDate, fmtDuration, plural } from '../lib/format';
import { PRIORITY_META, TICKET_META, categoryMeta, mapsUrl, nextTicket } from '../lib/categories';
import { assign, collide, fmtWindow, minToTime, parseLen, plannedMinutes, suggestStart, timeToMin, windowOf } from '../lib/dayplan';
import { Button, Menu, Money, Select, cx } from './ui';
import { DayBar } from './daybar';
import { MapPreview } from './MapPreview';

export function ActivityRow({
  place,
  all,
  dayOptions,
  dense = false,
  tripStart,
  tripEnd,
}: {
  place: Place;
  all: Place[];
  dayOptions: { value: string; label: string }[];
  dense?: boolean;
  tripStart?: string | null;
  tripEnd?: string | null;
}) {
  const store = useStore();
  const { open } = useEditor();
  const meta = categoryMeta(place.category);
  const prio = PRIORITY_META[place.priority] ?? PRIORITY_META.soll;
  const ticket = TICKET_META[(place.ticket_status ?? 'unklar') as keyof typeof TICKET_META] ?? TICKET_META.unklar;
  const asText = place.duration_min ? fmtDuration(place.duration_min) : '';

  const [len, setLen] = useState(asText);
  useEffect(() => setLen(asText), [asText]);
  const [showMap, setShowMap] = useState(false);

  const dayPlaces = useMemo(() => (place.date ? all.filter((p) => p.date === place.date) : []), [all, place.date]);
  const siblings = useMemo(() => dayPlaces.filter((p) => p.id !== place.id), [dayPlaces, place.id]);
  const win = windowOf(place);
  const length = place.duration_min ?? 90;
  const clash = win ? collide(siblings, win.start, length, place.id) : [];
  const nextFree = place.date ? suggestStart(siblings, length, null) : null;

  const placeOn = (date: string | null) => assign(store, all, place, { date });
  const setStart = (value: string | null) => {
    if (!place.date) {
      void store.patch('places', place.id, { start_time: value });
      return;
    }
    assign(store, all, place, { start_time: value });
  };
  const commitLen = () => {
    if (!len.trim()) {
      if (place.duration_min !== null) void store.patch('places', place.id, { duration_min: null });
      return;
    }
    const minutes = parseLen(len);
    if (minutes === null) {
      setLen(asText);
      store.say('Dauer bitte als „2 h“, „90 min“ oder „1:30“ schreiben.');
      return;
    }
    if (minutes === place.duration_min) return;
    void store.patch('places', place.id, { duration_min: minutes });
    const start = timeToMin(place.start_time);
    if (place.date && start !== null) {
      const blocked = collide(siblings, start, minutes, place.id);
      if (blocked.length) store.say(`${fmtWindow(start, start + minutes)} überschneidet sich mit „${blocked[0].name}“ – Zeit ändern oder ⏱ drücken.`);
    }
  };

  const dayLoad = plannedMinutes(dayPlaces);

  /** erster Tag im Reisezeitraum, an dem der Name noch nicht vorkommt und Luft ist */
  const nextFreeDay = () => {
    const dates = eachDate(tripStart ?? null, tripEnd ?? null);
    if (!dates.length) {
      store.say('Noch kein Zeitraum in der Reise – bitte erst Start- und Enddatum eintragen.');
      return;
    }
    const load = new Map<string, number>();
    for (const d of dates) load.set(d, 0);
    for (const p of all) if (p.date && load.has(p.date)) load.set(p.date, (load.get(p.date) ?? 0) + (p.duration_min ?? 90));
    const names = new Set(all.filter((p) => p.date && p.name === place.name).map((p) => p.date));
    const candidates = dates.filter((d) => !names.has(d));
    const sameCityFirst = candidates.filter((d) => p_city(d));
    const target = [...sameCityFirst, ...candidates.filter((d) => !sameCityFirst.includes(d))].sort((a, b) => (load.get(a) ?? 0) - (load.get(b) ?? 0))[0];
    if (!target) {
      store.say('Kein freier Tag im Zeitraum – alles hat schon 1,5 h+ Programm.');
      return;
    }
    assign(store, all, place, { date: target });
  };
  const p_city = (d: string) => all.some((p) => p.date === d && p.city === place.city);

  return (
    <div className={cx('group rounded-lg border bg-white/[0.02] transition hover:border-white/20', place.date ? 'border-white/[0.07]' : 'border-dashed border-amber-400/25')}>
      <div className={cx('flex flex-wrap items-start gap-x-2 gap-y-1.5', dense ? 'px-2 py-1.5' : 'px-2.5 py-2')}>
        <span aria-hidden className="mt-0.5 shrink-0 text-[15px]" title={meta.label}>
          {meta.icon}
        </span>

        <div className="min-w-[190px] flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <button
              onClick={() => open({ kind: 'place', id: place.id })}
              className="max-w-[46ch] truncate text-left text-[13.5px] font-semibold text-white underline-offset-2 hover:underline"
              title="Bearbeiten"
            >
              {place.name}
            </button>
            {place.priority !== 'kann' ? (
              <span className="text-[10.5px] text-shu-300" title={`Priorität: ${prio.label}`}>
                {prio.icon} {prio.label}
              </span>
            ) : null}
            <button
              onClick={() => store.patch('places', place.id, { ticket_status: nextTicket(place.ticket_status) })}
              title={`${ticket.label}${place.ticket_note ? ` – ${place.ticket_note}` : ''} · klicken zum Weiterschalten`}
              className={cx('chip ring-1 transition hover:brightness-125', ticket.chip)}
            >
              <span aria-hidden>{ticket.icon}</span>
              {ticket.short}
            </button>
          </div>

          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[11.5px] text-slate-400">
            <span>{place.city || '—'}</span>
            {place.district ? <span className="text-slate-500">· {place.district}</span> : null}
            {place.travel_time ? <span>· 🚶 {place.travel_time}</span> : null}
            {place.price_eur ? (
              <span className="text-slate-300">
                · <Money value={place.price_eur} />
              </span>
            ) : place.price_note ? (
              <span>· {place.price_note}</span>
            ) : (
              <span className="text-slate-600">· ohne Preis</span>
            )}
            <a href={mapsUrl(place)} target="_blank" rel="noreferrer" className="text-slate-500 underline-offset-2 hover:text-white hover:underline" title="Bei Google Maps öffnen">
              · 📍 Maps
            </a>
          </div>

          {place.date && win ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px]">
              <span className={cx('chip ring-1', clash.length ? 'bg-shu-500/15 text-shu-100 ring-shu-400/30' : 'bg-emerald-500/10 text-emerald-100 ring-emerald-400/25')}>
                {win.fullDay ? 'ganzer Tag' : fmtWindow(win.start, win.end)}
                {!win.explicit && !win.fullDay ? ' · geschätzt' : ''}
              </span>
              {clash.length ? <span className="text-shu-200">überschneidet „{clash[0].name}“</span> : null}
              {!clash.length && !win.explicit && !win.fullDay ? (
                <button className="text-[11px] text-slate-400 underline-offset-2 hover:text-white hover:underline" onClick={() => setStart(minToTime(win.start))} title="Uhrzeit festhalten, dann ist der Abschnitt verplant">
                  als feste Zeit übernehmen
                </button>
              ) : null}
              {nextFree && (!place.start_time || clash.length) ? (
                <button
                  className="text-[11px] text-amber-200/90 underline-offset-2 hover:text-amber-100 hover:underline"
                  onClick={() => setStart(minToTime(nextFree.start))}
                  title="Nächste freie Lücke an diesem Tag"
                >
                  ⏱ {fmtWindow(nextFree.start, nextFree.start + length)}
                </button>
              ) : null}
            </div>
          ) : null}

          {!place.date ? (
            <p className="mt-0.5 text-[11px] text-amber-200/80">
              noch an keinem Tag – rechts einen Tag wählen oder im Tagesplan auf einen Tag ziehen
              {!place.duration_min ? ' · Dauer fehlt noch (für die Zeitrechnung 1,5 h angenommen)' : ''}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-black/20 px-2 py-1.5 ring-1 ring-inset ring-white/[0.06]">
          <label className="flex items-center gap-1 text-[11px] text-slate-500">
            <span aria-hidden>🗓</span>
            <Select
              className="!w-auto !py-1 !text-[12px]"
              allowEmpty
              emptyLabel="kein Tag"
              options={dayOptions}
              value={place.date ?? ''}
              onChange={(e) => placeOn(e.target.value || null)}
            />
          </label>
          <label className="flex items-center gap-1 text-[11px] text-slate-500" title="Ab wann – nur mit Tag darunter sinnvoll">
            ab
            <input type="time" step={300} value={place.start_time ?? ''} onChange={(e) => setStart(e.target.value || null)} className="input !w-[104px] !py-1 !text-[12px] tabular-nums" />
          </label>
          <label className="flex items-center gap-1 text-[11px] text-slate-500" title="Voraussichtliche Dauer: 2 h · 90 min · 1:30">
            <span aria-hidden>⇢</span>
            <input
              value={len}
              onChange={(e) => setLen(e.target.value)}
              onBlur={commitLen}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitLen();
                }
              }}
              placeholder="–"
              className="input !w-[76px] !py-1 !text-[12px]"
            />
          </label>
          <Menu
            align="right"
            variant="quiet"
            icon="⋯"
            title="Mehr"
            items={[
              { icon: '✓', label: place.booking_status === 'erledigt' ? 'Wieder auf offen setzen' : 'Als erledigt markieren', run: () => store.patch('places', place.id, { booking_status: place.booking_status === 'erledigt' ? 'offen' : 'erledigt' }) },
              { icon: '🗺️', label: showMap ? 'Karte ausblenden' : 'Karte hier zeigen', run: () => setShowMap((v) => !v) },
              { icon: '✎', label: 'Alle Felder bearbeiten', run: () => open({ kind: 'place', id: place.id }) },
              { icon: '⧉', label: 'Kopieren (ohne Tag)', run: () => open({ kind: 'place', defaults: { ...place, id: undefined, date: null, name: `${place.name} (Kopie)` } }) },
              place.date
                ? { icon: '⤓', label: 'Vom Tag lösen', hint: 'zurück nach oben in die Liste', run: () => placeOn(null) }
                : { icon: '⏱', label: 'Auf den nächsten freien Tag', run: () => nextFreeDay() },
              { icon: '🗑', label: 'Löschen', danger: true, run: () => window.confirm(`„${place.name}“ löschen?`) && store.remove('places', place.id) },
            ]}
          />
        </div>
      </div>

      {showMap ? (
        <div className="border-t border-white/[0.05] p-2.5">
          <MapPreview
            place={place}
            query={`${place.name} ${place.district ?? ''} ${place.city ?? ''}`.replace(/\s+/g, ' ').trim()}
            height={190}
            zoom={place.lat !== null ? 16 : 13}
            heading={place.name}
          />
        </div>
      ) : null}
    </div>
  );
}

/** Kopf über einem Tagesblock: Datum, Städte, Band des Tages (ziehen = Zeit, Lücke klicken = oberster Wunsch rutscht dorthin) */
export function DayRowHeader({
  date,
  places,
  note,
  onPickSlot,
  onMove,
  onResize,
}: {
  date: string;
  places: Place[];
  note?: React.ReactNode;
  onPickSlot?: (minute: number) => void;
  onMove?: (placeId: string, minute: number) => void;
  onResize?: (placeId: string, minutes: number) => void;
}) {
  const cities = Array.from(new Set(places.map((p) => p.city).filter(Boolean))) as string[];
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-t-xl border-b border-white/[0.06] bg-black/25 px-3 py-2">
      <span className="text-[13px] font-semibold text-white">{fmtDate(date, { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
      {cities.length ? <span className="text-[11.5px] text-slate-400">{cities.join(' / ')}</span> : null}
      {note ? <span className="text-[11px] text-slate-500">{note}</span> : null}
      <span className="ml-auto w-[260px] max-w-[58%]">
        <DayBar places={places} height={12} onPickSlot={onPickSlot} onMove={onMove} onResize={onResize} />
      </span>
    </div>
  );
}
