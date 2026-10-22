'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { TabLink } from './tabs';
import { useStore } from '../../../lib/store';
import { EditorProvider, useBatchGeocode, useEditor } from '../../../components/EditorProvider';
import { Button, Card, Menu, cx } from '../../../components/ui';
import { daysBetween, fmtMoney, fmtRange, plural } from '../../../lib/format';
import { costsOf, dayPlan } from '../../../lib/stats';
import { endTrip, startHint, startTrip, tripMode } from '../../../lib/mode';
import { sortDays } from '../../../lib/sortday';
import { locusChanges } from '../../../lib/locus';
import { today } from '../../../lib/format';
import { needsCategory } from '../../../lib/categories';
import { applyCategories } from '../../../lib/categorize';

/**
 * Sechs Reiter, sechs Aufgaben. Alles Weitere lebt in den beiden Knöpfen rechts
 * („Anlegen“ und „⋯“) bzw. auf der Reise-Seite.
 */
const TABS = [
  { href: '/heute', label: 'Heute', icon: '☀️' },
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

  const live = tripMode(trip) === 'live';
  const tabs = live ? TABS.map((t) => (t.href === '/heute' ? { ...t, label: 'Unterwegs', icon: '🚶' } : t)) : TABS;

  return (
    <EditorProvider tripId={tripId}>
      <div className="mb-4">
        <TripTopBar tripId={tripId} />
        <nav className="no-print mt-3 flex gap-1 overflow-x-auto rounded-2xl border border-white/[0.06] bg-white/[0.03] p-1">
          {tabs.map((tab) => (
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
      trip: trip ?? { id: tripId, name: '', destination: '', start_date: null, end_date: null, travelers: 1, budget_eur: null, jpy_rate: null, notes: null, archived: archiv, started: false, started_at: null, planned_start: null, planned_end: null },
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
  const planDays = bundle.trip ? dayPlan(bundle) : [];
  const sortierbar = planDays.filter((d) => d.places.length > 1).length;
  const changeCount = locusChanges(bundle.places, bundle.hotels, planDays.map((d) => d.date), bundle.journeys).length;
  const days = trip?.start_date && trip?.end_date ? daysBetween(trip.start_date, trip.end_date) : 0;
  const live = tripMode(bundle.trip) === 'live';
  const offenHeute = bundle.places.filter((p) => p.date === today() && p.booking_status !== 'erledigt').length;

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
        <span className={live ? 'chip bg-emerald-500/15 text-emerald-100' : 'chip text-slate-400'} title={live ? 'die Reise läuft – Tagesseite ist die Hauptseite' : 'nichts läuft – alles wird geplant'}>
          {live ? `🚶 unterwegs${offenHeute ? ` · ${offenHeute} offen` : ''}` : '🗓️ Planung'}
        </span>
        {live ? (
          <Menu
            variant="primary"
            icon="🚶"
            title="Was braucht es unterwegs?"
            align="right"
            items={[
              { icon: '☀️', label: 'Zum heutigen Tag', hint: 'Ort, Route, Hinweise, Abhaken', href: `/t/${tripId}/heute` },
              { icon: '🗺️', label: 'Karte', hint: 'Punkte und Betten der Stadt', href: `/t/${tripId}/karte` },
              ...(bundle.trip.planned_start
                ? [{ icon: '↩', label: 'Start zurücknehmen', hint: `Zeitraum ${fmtRange(bundle.trip.planned_start, bundle.trip.planned_end)} wieder herstellen`, run: () => endTrip(store, bundle, true) }]
                : []),
              { icon: '✕', label: 'Reise beenden', hint: 'zurück in die Planung – Abgehaktes bleibt', run: () => endTrip(store, bundle, false) },
            ]}
          />
        ) : trip?.archived ? null : (
          <Button variant="primary" onClick={() => startTrip(store, bundle)} title={startHint({ ...bundle })}>
            ▶️ Reise starten
          </Button>
        )}
        <Menu
          variant={live ? 'ghost' : 'primary'}
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
            ...(trip && !trip.archived && !live
              ? [{ icon: '▶️', label: 'Reise starten', hint: startHint({ ...bundle }) || 'die Unterwegs-Seite öffnet sich', run: () => startTrip(store, bundle) }]
              : []),
            ...(live ? [{ icon: '☀️', label: 'Heutiger Tag', hint: offenHeute ? `${plural(offenHeute, 'Punkt', 'Punkte')} heute noch offen` : 'alles erledigt', href: `/t/${tripId}/heute` }] : []),
            ...(sortierbar
              ? [{ icon: '⚡', label: 'Alle Tage sortieren', hint: 'der Reihe nach, ohne Überschneidungen', run: () => sortDays(store, planDays) }]
              : []),
            { icon: '🔀', label: 'Ortswechsel eintragen', hint: changeCount ? `${plural(changeCount, 'Wechsel', 'Wechsel')} erkannt` : 'Stadt und Bett an einem Tag tauschen', run: () => open({ kind: 'move' }) },
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

