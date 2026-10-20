'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { TabLink } from './tabs';
import { useStore } from '../../../lib/store';
import { EditorProvider, useBatchGeocode, useEditor } from '../../../components/EditorProvider';
import { Button, Card, cx } from '../../../components/ui';
import { daysBetween, fmtMoney, fmtRange, plural } from '../../../lib/format';
import { download, hotelCsv, journeyCsv, jsonExport, placeCsv } from '../../../lib/export';
import { placesToKml } from '../../../lib/maps';
import { costsOf } from '../../../lib/stats';

const TABS = [
  { href: '', label: 'Übersicht', icon: '🏠' },
  { href: '/tage', label: 'Tage', icon: '🗓️' },
  { href: '/wuenscheliste', label: 'Wünscheliste', icon: '✨' },
  { href: '/tabelle', label: 'Tabelle', icon: '📊' },
  { href: '/karte', label: 'Karte', icon: '🗺️' },
  { href: '/unterkuenfte', label: 'Unterkünfte', icon: '🏨' },
  { href: '/kosten', label: 'Kosten', icon: '💶' },
  { href: '/verlauf', label: 'Reiseverlauf', icon: '🚄' },
];

export default function TripLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ tripId: string }>();
  const tripId = String(params?.tripId ?? '');
  const store = useStore();
  const trip = store.trips.find((t) => t.id === tripId);

  if (store.ready && !trip) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-slate-300">Diese Reise existiert nicht (mehr).</p>
        <Link className="btn-primary mt-3 inline-flex" href="/">
          Zurück zur Reisen-Übersicht
        </Link>
      </Card>
    );
  }

  return (
    <EditorProvider tripId={tripId}>
      <div className="mb-4">
        <TripTopBar tripId={tripId} />
        <nav className="no-print mt-3 flex gap-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-ink-900/50 p-1">
          {TABS.map((tab) => (
            <TabLink key={tab.href} tab={tab} tripId={tripId} />
          ))}
        </nav>
      </div>
      {children}
    </EditorProvider>
  );
}

function TripTopBar({ tripId }: { tripId: string }) {
  const store = useStore();
  const { open } = useEditor();
  const geocodeAll = useBatchGeocode(tripId);
  const [exportOpen, setExportOpen] = useState(false);
  const trip = store.trips.find((t) => t.id === tripId);

  const bundle = useMemo(
    () => ({
      trip: trip ?? { id: tripId, name: '', destination: '', start_date: null, end_date: null, travelers: 1, budget_eur: null, jpy_rate: null, notes: null, archived: false },
      places: store.places.filter((p) => p.trip_id === tripId),
      hotels: store.hotels.filter((h) => h.trip_id === tripId),
      journeys: store.journeys.filter((j) => j.trip_id === tripId),
      expenses: store.expenses.filter((e) => e.trip_id === tripId),
    }),
    [trip, store.places, store.hotels, store.journeys, store.expenses, tripId],
  );

  const costs = costsOf(bundle);
  const missingCoords = bundle.places.filter((p) => p.lat === null || p.lng === null).length;
  const days = trip?.start_date && trip?.end_date ? daysBetween(trip.start_date, trip.end_date) : 0;

  const exports = [
    { label: '📄 Aktivitäten als CSV', run: () => download(`${tripId}-aktivitaeten.csv`, placeCsv(bundle.places, bundle.hotels)) },
    { label: '🏨 Unterkünfte als CSV', run: () => download(`${tripId}-hotels.csv`, hotelCsv(bundle.hotels)) },
    { label: '🚄 Fahrten als CSV', run: () => download(`${tripId}-fahrten.csv`, journeyCsv(bundle.journeys)) },
    { label: '🧭 Google Maps: alle Punkte (KML)', run: () => download(`${tripId}-kml.kml`, placesToKml(bundle.places, trip?.name ?? 'Reise'), 'application/vnd.google-earth.kml+xml') },
    { label: '🧬 Alles als JSON', run: () => download(`${tripId}.json`, jsonExport(bundle), 'application/json') },
    { label: '🖨 Drucken / PDF', run: () => window.print() },
  ];

  return (
    <section className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight text-white">
          {trip?.name ?? 'Reise'}
          {trip?.archived ? <span className="chip bg-white/[0.06] text-slate-300 ring-white/10">Referenz · {trip.name.match(/\d{4}/)?.[0] ?? 'Archiv'}</span> : null}
        </h1>
        <p className="mt-0.5 text-[12.5px] text-slate-400">
          {trip?.destination ? `${trip.destination} · ` : ''}
          {fmtRange(trip?.start_date, trip?.end_date)}
          {days ? ` · ${plural(days, 'Tag', 'Tage')}` : ''} · {plural(bundle.places.length, 'Aktivität', 'Aktivitäten')} · {plural(bundle.hotels.length, 'Unterkunft', 'Unterkünfte')}
        </p>
      </div>

      <div className="no-print flex flex-wrap items-center gap-1.5">
        <Button variant="primary" onClick={() => open({ kind: 'place' })}>
          ＋ Aktivität
        </Button>
        <Button variant="ghost" onClick={() => open({ kind: 'hotel' })}>
          ＋ Unterkunft
        </Button>
        <Button variant="ghost" onClick={() => open({ kind: 'journey' })}>
          ＋ Flug / Zug
        </Button>
        {missingCoords ? (
          <Button variant="ghost" onClick={() => void geocodeAll()} title={`${missingCoords} Einträge ohne Koordinaten – OpenStreetMap fragen (1,1 s Abstand pro Suchanfrage)`}>
            🌍 {missingCoords} geocodieren
          </Button>
        ) : null}
        <div className="relative">
          <Button variant="ghost" onClick={() => setExportOpen((v) => !v)} aria-expanded={exportOpen}>
            ⇩ Export
          </Button>
          {exportOpen ? (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setExportOpen(false)} aria-hidden />
              <Card className="pop-in absolute right-0 z-40 mt-1 w-60 p-1.5 text-left">
                {exports.map((item) => (
                  <button
                    key={item.label}
                    className="block w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] text-slate-200 hover:bg-white/[0.07]"
                    onClick={() => {
                      item.run();
                      setExportOpen(false);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </Card>
            </>
          ) : null}
        </div>
        <Button variant="ghost" onClick={() => open({ kind: 'trip', id: tripId })} title="Reise bearbeiten (Zeitraum, Budget, ¥-Kurs)">
          ⚙
        </Button>
      </div>

      <p className="w-full text-right text-[11.5px] text-slate-500">
        Kosten bisher <span className="tabular-nums text-slate-200">{fmtMoney(costs.total)}</span>
        {trip?.budget_eur ? (
          <>
            {' '}
            · Budget {fmtMoney(trip.budget_eur)} ({Math.round((costs.total / trip.budget_eur) * 100)} %)
          </>
        ) : null}
        {trip?.travelers ? <> · {fmtMoney(costs.perPerson)} pro Person</> : null}
      </p>
    </section>
  );
}
