'use client';

import React, { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { applyMove, cityOfDay, stayOn } from '../lib/locus';
import type { Hotel, Journey, Place, Trip } from '../lib/types';
import { fmtDate, today } from '../lib/format';
import { Button, Field, Modal, Pill, Seg, Select, cx } from './ui';
import { DateField } from './dates';
import { JOURNEY_MODES } from '../lib/types';

/**
 * Ortswechsel: der Tag, an dem die Stadt (und damit das Bett) getauscht wird.
 * Der Dialog zeigt vorher, was passiert, und schreibt dann Unterkünfte, Aktivitäten
 * und – auf Wunsch – die Fahrt in einem Schritt um.
 */
export function OrtswechselDialog({
  trip,
  places,
  hotels,
  journeys,
  initialDate,
  onClose,
}: {
  trip?: Trip;
  places: Place[];
  hotels: Hotel[];
  journeys: Journey[];
  initialDate?: string | null;
  onClose: () => void;
}) {
  const store = useStore();
  const start = initialDate ?? trip?.start_date ?? today();
  const [date, setDate] = useState<string | null>(start);
  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const h of hotels) if (h.city) set.add(h.city);
    for (const p of places) if (p.city) set.add(p.city);
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'de'));
  }, [hotels, places]);

  const iso = date ?? start;
  const fromCity = cityOfDay(places, hotels, iso);
  const [toCity, setToCity] = useState(() => cities.find((c) => c !== fromCity) ?? cities[0] ?? '');
  const here = hotels.filter((h) => (h.city ?? '') === toCity);
  const [hotelId, setHotelId] = useState<string>(() => here[0]?.id ?? '');
  const [scope, setScope] = useState<'day' | 'onwards'>('day');
  const [movePlaces, setMovePlaces] = useState(true);
  const [withHotels, setWithHotels] = useState(true);
  const [withJourney, setWithJourney] = useState(true);
  const [mode, setMode] = useState('Shinkansen');

  const moved = useMemo(
    () => (movePlaces ? places.filter((p) => p.date && (scope === 'day' ? p.date === iso : p.date >= iso) && (p.city ?? '') !== toCity) : []),
    [movePlaces, places, scope, iso, toCity],
  );
  const current = stayOn(hotels, iso);
  const target = hotelId ? hotels.find((h) => h.id === hotelId) : here[0];

  const apply = () => {
    applyMove(store, { trip, places, hotels, journeys }, { date: iso, toCity, hotelId: target?.id ?? null, scope, movePlaces, updateHotels: withHotels, addJourney: withJourney, mode });
    onClose();
  };

  return (
    <Modal
      title="Ortswechsel"
      subtitle="Umzug von einer Stadt in die nächste – Unterkünfte, Aktivitäten und Fahrt in einem Schritt"
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" onClick={apply} disabled={!toCity}>
            Wechsel eintragen
          </Button>
        </>
      }
    >
      <div className="space-y-3 px-4 py-3.5">
        <div className="rounded-xl bg-black/25 p-2.5 text-[12.5px] text-slate-300">
          <p>
            <span className="text-slate-500">Am </span>
            <span className="font-medium text-white">{fmtDate(iso, { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
            <span className="text-slate-500"> schläfst du gerade in </span>
            <span className="font-medium text-white">{fromCity ?? '—'}</span>
            {current ? <span className="text-slate-500"> ({current.name})</span> : <span className="text-shu-200"> (Nacht ohne Bett)</span>}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5">
            <span aria-hidden>🔀</span>
            <span className="text-slate-500">neu ab diesem Tag:</span>
            <Pill className="ring-white/10">{toCity || '—'}</Pill>
            {target ? <span className="text-slate-400">{target.name}</span> : <span className="text-amber-200/80">keine Unterkunft in {toCity} hinterlegt</span>}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <DateField
            label="Ab welchem Tag"
            value={date}
            onChange={setDate}
            hint="der Tag, an dem du auscheckst und weiterfährst"
            tripBounds={trip ? [trip.start_date, trip.end_date] : undefined}
          />
          <Field label="Neue Stadt">
            <Select
              options={cities.map((c) => ({ value: c, label: `${c}${c === fromCity ? ' (bisher)' : ''}` }))}
              value={toCity}
              onChange={(e) => {
                const next = e.target.value;
                setToCity(next);
                const first = hotels.find((h) => (h.city ?? '') === next);
                setHotelId(first?.id ?? '');
              }}
            />
          </Field>
        </div>

        <Field label="Unterkunft dort" hint="die Nächte werden so eingeteilt, dass sie genau an diesem Tag anfängt">
          <Select
            allowEmpty
            emptyLabel="keine Unterkunft ändern"
            options={here.map((h) => ({ value: h.id, label: `${h.name} · ${h.nights ?? '?'} Nächte` }))}
            value={hotelId}
            onChange={(e) => setHotelId(e.target.value)}
          />
        </Field>

        <Field label="Was soll mitwandern?">
          <Seg
            value={scope}
            onChange={setScope}
            options={[
              { value: 'day', label: 'nur diesen Tag', title: 'Nur die Punkte an diesem Tag bekommen die neue Stadt' },
              { value: 'onwards', label: 'diesen und alle Tage danach', title: 'Der Rest der Reise gehört ab jetzt zur neuen Stadt' },
            ]}
          />
        </Field>

        <div className="space-y-1.5 rounded-xl border border-white/[0.07] bg-black/20 p-2.5">
          <Check label={`${moved.length} ${moved.length === 1 ? 'Aktivität' : 'Aktivitäten'} auf ${toCity} setzen`} checked={movePlaces} onChange={setMovePlaces} hint={moved.length ? moved.slice(0, 3).map((p) => p.name).join(', ') + (moved.length > 3 ? ' …' : '') : 'alle Punkte hier haben schon die neue Stadt'} />
          <Check label="Unterkünfte neu einteilen (auschecken, einchecken)" checked={withHotels} onChange={setWithHotels} hint={current && target && current.id !== target.id ? `${current.name} → ${target.name}` : 'nur die neue Unterkunft beginnt an diesem Tag'} />
          <Check label="Fahrt eintragen" checked={withJourney} onChange={setWithJourney} hint="eine Zeile im Fahrten-Log, Uhrzeit und Preis trägst du später ein" />
          {withJourney ? (
            <div className={cx('pt-1 transition', !withJourney && 'pointer-events-none opacity-40')}>
              <Select
                className="!w-auto"
                options={JOURNEY_MODES.map((m) => ({ value: m, label: m }))}
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                title="Womit fährst du?"
              />
            </div>
          ) : null}
        </div>

        {moved.length && withHotels ? (
          <p className="text-[11.5px] leading-snug text-slate-500">
            Tipp: Fahrzeit und Preis der Fahrt später im <span className="text-slate-300">🧳 Reise</span>-Reiter nachtragen – dort liegen die Fahrten.{' '}
            {moved.length} Aktivität{moved.length === 1 ? '' : 'en'} verschieben dabei keinen Tag, nur den Ort.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}

function Check({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-[12.5px] text-slate-200">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-shu-500" />
      <span className="min-w-0">
        {label}
        {hint ? <span className="mt-0.5 block text-[11px] text-slate-500">{hint}</span> : null}
      </span>
    </label>
  );
}

/** Der schmale Streifen für Tageskarten: zeigt den Wechsel und öffnet den Dialog */
export function ChangeStrip({ date, from, to, fromHotel, toHotel, onOpen, daysInOld }: { date: string; from: string; to: string; fromHotel?: string | null; toHotel?: string | null; onOpen: () => void; daysInOld?: number }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className="group/change flex w-full items-center gap-2 border-y border-shu-400/25 bg-shu-500/[0.09] px-3 py-1.5 text-left text-[12px] text-shu-100 transition hover:bg-shu-500/[0.16]"
      title="Unterkunft, Aktivitäten und Fahrt an diesem Tag umstellen"
    >
      <span aria-hidden>🔀</span>
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium">Ortswechsel {from} → {to}</span>
        {fromHotel || toHotel ? <span className="text-slate-400"> · 🏨 {fromHotel ?? '—'} → {toHotel ?? '—'}</span> : null}
        {daysInOld ? <span className="text-slate-500"> · {daysInOld} {daysInOld === 1 ? 'Nacht' : 'Nächte'} in {from}</span> : null}
      </span>
      <span className="shrink-0 text-[11px] text-slate-400 underline-offset-2 group-hover/change:underline">eintragen</span>
    </button>
  );
}
