'use client';

import React, { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useStore, useTrip } from '../../../../lib/store';
import { useEditor } from '../../../../components/EditorProvider';
import { Button, Card, Empty, Money, Pill, SectionTitle, Select, Stat, cx } from '../../../../components/ui';
import { STATUS_META } from '../../../../lib/categories';
import { fmtDate, fmtDuration, fmtMoney, plural } from '../../../../lib/format';

const MODE_ICON: Record<string, string> = {
  Flug: '✈️',
  Shinkansen: '🚄',
  Zug: '🚆',
  Bus: '🚌',
  Fähre: '⛴️',
  'U-Bahn': '🚇',
  Auto: '🚗',
  'zu Fuß': '🚶',
};

export default function JourneyPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = String(params?.tripId ?? '');
  const store = useStore();
  const bundle = useTrip(tripId);
  const { open } = useEditor();
  const [mode, setMode] = useState('');

  const journeys = useMemo(() => [...bundle.journeys].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999')), [bundle.journeys]);
  const shown = mode ? journeys.filter((j) => (j.mode ?? '') === mode) : journeys;
  const modes = useMemo(() => Array.from(new Set(journeys.map((j) => j.mode).filter(Boolean) as string[])).sort(), [journeys]);
  const total = journeys.reduce((a, j) => a + (j.price_eur ?? 0), 0);
  const longest = journeys.slice().sort((a, b) => (b.duration_min ?? 0) - (a.duration_min ?? 0))[0];
  const cityStops = useMemo(() => {
    const map = new Map<string, { days: number; first: string | null; last: string | null }>();
    for (const j of journeys) {
      const city = j.to_city ?? j.from_city;
      if (!city || !j.date) continue;
      const cur = map.get(city) ?? { days: 0, first: j.date, last: j.date };
      map.set(city, { days: cur.days + 1, first: cur.first ?? j.date, last: j.date });
    }
    return Array.from(map.entries()).sort((a, b) => (a[1].first ?? '').localeCompare(b[1].first ?? ''));
  }, [journeys]);

  if (!bundle.trip) return null;

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Reiseverlauf"
        icon="🚄"
        hint="Ankunft, Weiterzüge, Rückflug – die Kette mit Preis für jede Fahrt und Hotelwechsel."
        right={
          <>
            {modes.length ? (
              <Select className="!w-auto" allowEmpty emptyLabel="Alle Verkehrsmittel" options={modes} value={mode} onChange={(e) => setMode(e.target.value)} />
            ) : null}
            <Button size="sm" variant="primary" onClick={() => open({ kind: 'journey' })}>
              ＋ Flug / Zug
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label="Fahrten" value={journeys.length} hint={mode ? `${shown.length} gefiltert` : plural(modes.length, 'Verkehrsmittel', 'Verkehrsmittel')} />
        <Stat label="Transportkosten" value={fmtMoney(total)} hint={`${journeys.filter((j) => j.price_eur).length} mit Preis`} />
        <Stat label="Stationen" value={cityStops.length} hint={cityStops.map(([c]) => c).slice(0, 3).join(' · ')} />
        <Stat label="Längste Fahrt" value={longest ? fmtDuration(longest.duration_min) : '—'} hint={longest?.title ?? '—'} />
      </div>

      {!shown.length ? (
        <Empty title="Noch keine Fahrten" hint="Lege Ankunft, Zugfahrten und Rückflug an – das gibt dem Tagesplan seinen Rahmen." action={<Button variant="primary" onClick={() => open({ kind: 'journey' })}>＋ Erste Fahrt</Button>} />
      ) : (
        <Card className="p-0">
          <ol className="divide-y divide-white/[0.06]">
            {shown.map((j) => {
              const meta = STATUS_META[j.booking_status];
              return (
                <li key={j.id} className="group grid grid-cols-[54px_minmax(0,1fr)_auto] items-start gap-3 px-3 py-2.5 transition hover:bg-white/[0.03]">
                  <div className="pt-0.5 text-right">
                    <div className="text-[13px] uppercase text-slate-400">{j.date ? fmtDate(j.date, { weekday: 'narrow' }) : ''}</div>
                    <div className="text-[13px] font-semibold tabular-nums text-slate-200">{j.date ? fmtDate(j.date, { day: '2-digit', month: '2-digit' }) : '—'}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span aria-hidden className="text-[15px]">
                        {MODE_ICON[j.mode ?? ''] ?? '🧳'}
                      </span>
                      <button onClick={() => open({ kind: 'journey', id: j.id })} className="text-[13.5px] font-semibold text-white underline-offset-2 hover:underline">
                        {j.title}
                      </button>
                      {j.from_city && j.to_city ? (
                        <span className="text-[13px] text-slate-400">
                          {j.from_city} <span className="text-shu-300">→</span> {j.to_city}
                        </span>
                      ) : null}
                      {j.mode ? (
                        <Pill className="bg-white/[0.04] text-slate-300 ring-white/10" title={j.mode}>
                          {j.mode}
                        </Pill>
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-slate-400">
                      {j.departure_time ? <span className="tabular-nums">Abflug {j.departure_time}</span> : null}
                      {j.end_date ? (
                        <span className="tabular-nums">
                          · {j.mode === 'Flug' ? 'zurück' : 'an'} {fmtDate(j.end_date, { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </span>
                      ) : null}
                      {j.duration_min ? <span>· {fmtDuration(j.duration_min)}</span> : null}
                      {j.hotel_name ? (
                        <span className="text-slate-300">
                          · 🏨 {j.hotel_name}
                          {j.nights ? ` (${plural(j.nights, 'Nacht', 'Nächte')})` : ''}
                        </span>
                      ) : null}
                      {j.price_eur ? <span className="tabular-nums text-emerald-200/80">· {fmtMoney(j.price_eur)}</span> : null}
                    </div>
                    {j.notes ? <p className="mt-1 whitespace-pre-line text-[13px] leading-snug text-slate-300/85">{j.notes}</p> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className={cx('chip ring-1', meta.color)} title={`Status: ${meta.label}`}>
                      {meta.label}
                    </span>
                    <span className="no-print flex gap-0.5 opacity-60 transition group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                      <button className="btn-quiet !px-1" title="Status: gebucht" onClick={() => store.patch('journeys', j.id, { booking_status: 'gebucht' })}>
                        ✓
                      </button>
                      <button className="btn-quiet !px-1" title="Bearbeiten" onClick={() => open({ kind: 'journey', id: j.id })}>
                        ✎
                      </button>
                      <button className="btn-quiet !px-1 text-red-300/80 hover:!text-red-200" title="Löschen" onClick={() => window.confirm(`Fahrt „${j.title}“ löschen?`) && store.remove('journeys', j.id)}>
                        🗑
                      </button>
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      {cityStops.length ? (
        <Card className="p-4">
          <SectionTitle title="Stationen dieser Reise" icon="📍" hint="Wie lange du wo bleibst – abgeleitet aus den Fahrten." />
          <div className="flex flex-wrap items-center gap-1.5">
            {cityStops.map(([city, info], i) => (
              <React.Fragment key={city}>
                <span className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[13px]">
                  <b className="text-slate-100">{city}</b>
                  <span className="ml-1.5 text-slate-400">
                    {plural(info.days, 'Tag', 'Tage')} · {fmtDate(info.first, { day: '2-digit', month: '2-digit' })}–{fmtDate(info.last, { day: '2-digit', month: '2-digit' })}
                  </span>
                </span>
                {i < cityStops.length - 1 ? <span className="text-shu-400/60">→</span> : null}
              </React.Fragment>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[13px] text-slate-400">
            <span>
              <Money value={total} /> für {journeys.filter((j) => j.price_eur).length} Fahrten mit Preis
            </span>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
