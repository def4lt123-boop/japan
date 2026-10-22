'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { TabLink } from './tabs';
import { useStore } from '../../../lib/store';
import { EditorProvider, useBatchGeocode, useEditor } from '../../../components/EditorProvider';
import { Card, Menu, cx } from '../../../components/ui';
import { daysBetween, fmtMoney, fmtRange, plural } from '../../../lib/format';
import { costsOf } from '../../../lib/stats';
import { needsCategory } from '../../../lib/categories';
import { applyCategories } from '../../../lib/categorize';

/**
 * Fünf Reiter, fünf Aufgaben. Alles Weitere lebt in den beiden Knöpfen rechts
 * („Anlegen“ und „⋯“) bzw. auf der Reise-Seite.
 */
const TABS = [
  { href: '/tage', label: 'Tage', icon: '🗓️' },
  { href: '/aktivitaeten', label: 'Aktivitäten', icon: '🗂️' },
  { href: '/karte', label: 'Karte', icon: '🗺️' },
  { href: '/reise', label: 'Reise', icon: '🧳' },
  { href: '/uebersicht', label: 'Übersicht', icon: '📊' },
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
        <nav className="no-print mt-3 flex gap-1 overflow-x-auto rounded-2xl border border-white/[0.06] bg-white/[0.03] p-1">
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
  const [archiv] = useState(false);
  const trip = store.trips.find((t) => t.id === tripId);

  const bundle = useMemo(
    () => ({
      trip: trip ?? { id: tripId, name: '', destination: '', start_date: null, end_date: null, travelers: 1, budget_eur: null, jpy_rate: null, notes: null, archived: archiv },
      places: store.places.filter((p) => p.trip_id === tripId),
      hotels: store.hotels.filter((h) => h.trip_id === tripId),
      journeys: store.journeys.filter((j) => j.trip_id === tripId),
      expenses: store.expenses.filter((e) => e.trip_id === tripId),
    }),
    [trip, store.places, store.hotels, store.journeys, store.expenses, tripId, archiv],
  );

  const costs = costsOf(bundle);
  const missingCoords = bundle.places.filter((p) => p.lat === null || p.lng === null).length;
  const needsCat = bundle.places.filter((p) => needsCategory(p)).length;
  const openPool = bundle.places.filter((p) => !p.date).length;
  const days = trip?.start_date && trip?.end_date ? daysBetween(trip.start_date, trip.end_date) : 0;

  return (
    <section className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="flex flex-wrap items-center gap-2 text-[22px] font-semibold leading-tight tracking-tight text-white">
          {trip?.name ?? 'Reise'}
          {trip?.archived ? <span className="chip text-slate-300">Referenz · {trip.name.match(/\d{4}/)?.[0] ?? 'Archiv'}</span> : null}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-slate-400">
          {trip?.destination ? <span className="text-slate-300">{trip.destination}</span> : null}
          <span>{fmtRange(trip?.start_date, trip?.end_date)}</span>
          <span className="text-slate-600">·</span>
          <span className="tabular-nums">{days ? `${plural(days, 'Tag', 'Tage')} · ${plural(bundle.places.length, 'Aktivität', 'Aktivitäten')}` : 'noch kein Zeitraum'}</span>
          {costs.total ? (
            <>
              <span className="text-slate-600">·</span>
              <span className={cx('tabular-nums', trip?.budget_eur && costs.total > trip.budget_eur ? 'text-shu-300' : 'text-emerald-200/80')}>
                {fmtMoney(costs.total)}
                {trip?.budget_eur ? ` / ${fmtMoney(trip.budget_eur)}` : ''}
              </span>
            </>
          ) : null}
        </p>
      </div>

      <div className="no-print flex flex-wrap items-center gap-1.5">
        <Menu
          variant="primary"
          label="Anlegen"
          icon="＋"
          title="Was brauchst du gerade?"
          align="right"
          items={[
            { icon: '🗺️', label: 'Aktivität', hint: openPool ? `${openPool} warten noch auf einen Tag` : 'Ort, Essen, Ausflug – Tag später', run: () => open({ kind: 'place' }) },
            { icon: '🏨', label: 'Unterkunft', hint: 'Nächte, Preis, Adresse', run: () => open({ kind: 'hotel' }) },
            { icon: '🚄', label: 'Flug & Zug', hint: 'Ankunft, Weiterreise, Rückflug', run: () => open({ kind: 'journey' }) },
            { icon: '💶', label: 'Ausgabe', hint: 'Geld, das sonst geflossen ist', run: () => open({ kind: 'expense' }) },
          ]}
        />
        <Menu
          variant="ghost"
          icon="⋯"
          title="Mehr"
          align="right"
          items={[
            { icon: '⚙', label: 'Reise bearbeiten', hint: 'Zeitraum, Budget, Personen, ¥-Kurs', run: () => open({ kind: 'trip', id: tripId }) },
            ...(missingCoords
              ? [{ icon: '🌍', label: `${missingCoords} Kartenpunkte nachziehen`, hint: 'OpenStreetMap fragt die Koordinaten ab', run: () => void geocodeAll() }]
              : []),
            ...(needsCat
              ? [{ icon: '🏷️', label: `${needsCat} eine Kategorie geben`, hint: 'aus Name und Notiz abgeleitet', run: () => applyCategories(store, bundle.places) }]
              : []),
            { icon: '🗂️', label: 'Alles als Tabelle', hint: 'jedes Feld in einer Zeile', href: `/t/${tripId}/tabelle` },
            { icon: '⇩', label: 'Dateien & Export', hint: 'CSV, Google-Maps-KML, JSON', href: `/t/${tripId}/reise#export` },
            { icon: '🖨', label: 'Drucken / PDF', hint: 'Tagesplan inklusive', run: () => window.print() },
          ]}
        />
      </div>
    </section>
  );
}
