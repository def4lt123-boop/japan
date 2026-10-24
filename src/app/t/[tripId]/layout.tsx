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
import { endTrip, startHint, startIsNear, startTrip, tripMode } from '../../../lib/mode';
import { today } from '../../../lib/format';
import { needsCategory } from '../../../lib/categories';
import { checkTrip } from '../../../lib/checks';
import { applyCategories } from '../../../lib/categorize';

/**
 * Fünf Reiter, fünf Aufgaben – im Unterwegs-Modus kommt 🚶 dazu. Vorn liegt nur, was man
 * wirklich gerade tut: ein Gedanke anlegen (＋ Idee) und der Rest im ⋯.
 */
const TABS = [
  { href: '/tage', label: 'Tage', short: 'Tage', icon: '🗓️' },
  { href: '/aktivitaeten', label: 'Aktivitäten', short: 'Punkte', icon: '🗂️' },
  { href: '/karte', label: 'Karte', short: 'Karte', icon: '🗺️' },
  { href: '/reise', label: 'Reise', short: 'Reise', icon: '🧳' },
  { href: '/uebersicht', label: 'Übersicht', short: 'Übersicht', icon: '📊' },
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
  const tabs = live ? [{ href: '/heute', label: 'Unterwegs', short: 'Heute', icon: '🚶' }, ...TABS] : TABS;

  return (
    <EditorProvider tripId={tripId}>
      <div className="mb-4">
        <TripTopBar tripId={tripId} />
        {/* oben auf dem Desktop, unten als Leiste auf dem Handy */}
        <nav className="tabbar no-print md:mt-3" data-tabbar={tabs.length} aria-label="Bereiche dieser Reise">
          {tabs.map((tab) => (
            <TabLink key={tab.href} tab={tab} tripId={tripId} />
          ))}
        </nav>
      </div>
      <div className="pb-tabbar">{children}</div>
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
  const days = trip?.start_date && trip?.end_date ? daysBetween(trip.start_date, trip.end_date) : 0;
  const live = tripMode(bundle.trip) === 'live';
  const offenHeute = bundle.places.filter((p) => p.date === today() && p.booking_status !== 'erledigt').length;
  // der Prüfrundgang hängt an den Daten – die Zahl im Menü ist deshalb immer aktuell
  const check = useMemo(() => checkTrip(bundle, tripId).filter((f) => f.tone !== 'info'), [bundle, tripId]);

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
              { icon: '🚶', label: 'Zum Tag', hint: 'Ort, Route, Hinweise, Abhaken', href: `/t/${tripId}/heute` },
              { icon: '🗺️', label: 'Karte', hint: 'Punkte und Betten der Stadt', href: `/t/${tripId}/karte` },
              ...(bundle.trip.planned_start
                ? [{ icon: '↩', label: 'Start zurücknehmen', hint: `Zeitraum ${fmtRange(bundle.trip.planned_start, bundle.trip.planned_end)} wieder herstellen`, run: () => endTrip(store, bundle, true) }]
                : []),
              { icon: '✕', label: 'Reise beenden', hint: 'zurück in die Planung – Abgehaktes bleibt', run: () => endTrip(store, bundle, false) },
            ]}
          />
        ) : startIsNear(trip) ? (
          <Button variant="ghost" className="!border-emerald-400/40 !bg-emerald-400/[0.08] !text-emerald-100" onClick={() => startTrip(store, bundle)} title={`Was der Start tut: ${startHint({ ...bundle })}`}>
            ▶️ starten
          </Button>
        ) : null}
        <Button variant={live ? 'ghost' : 'primary'} onClick={() => open({ kind: 'place' })} title={openPool ? `neuer Punkt · ${openPool} warten noch auf einen Tag` : 'neuer Punkt – Tag, Ort und Kategorie kommen später'}>
          ＋ Idee
        </Button>
        <Menu
          variant="ghost"
          icon="⋯"
          title="Mehr"
          align="right"
          items={[
            { icon: '🏨', label: 'Unterkunft anlegen', hint: 'Nächte, Preis, Adresse', run: () => open({ kind: 'hotel' }) },
            { icon: '🚄', label: 'Flug & Zug anlegen', hint: 'Ankunft, Weiterreise, Rückflug', run: () => open({ kind: 'journey' }) },
            { icon: '💶', label: 'Ausgabe anlegen', hint: 'Geld, das sonst geflossen ist', run: () => open({ kind: 'expense' }) },
            { icon: '⚙', label: 'Reise bearbeiten', hint: 'Zeitraum, Budget, Personen, ¥-Kurs', run: () => open({ kind: 'trip', id: tripId }) },
            { icon: '↻', label: 'Daten neu laden', hint: 'den Stand aller Geräte hierher holen', run: () => void store.refresh() },
            ...(store.mode !== 'supabase'
              ? [{ icon: '⟲', label: 'Vorlage wiederherstellen', hint: 'diesen Browser auf die Beispiel-Reise zurücksetzen', run: () => void store.resetLocalData() }]
              : []),
            ...(trip && !trip.archived && !live
              ? [{ icon: '▶️', label: 'Reise starten', hint: startHint({ ...bundle }) || 'die Unterwegs-Seite öffnet sich', run: () => startTrip(store, bundle) }]
              : []),
            ...(live ? [{ icon: '🚶', label: 'Heutiger Tag', hint: offenHeute ? `${plural(offenHeute, 'Punkt', 'Punkte')} heute noch offen` : 'alles erledigt', href: `/t/${tripId}/heute` }] : []),
            ...(missingCoords
              ? [{ icon: '🌍', label: `${missingCoords} Punkte ohne Ort`, hint: 'die Kartensuche setzt den Punkt', run: () => void geocodeAll() }]
              : []),
            ...(needsCat
              ? [{ icon: '🏷️', label: `${needsCat} eine Kategorie geben`, hint: 'aus Name und Notiz abgeleitet', run: () => applyCategories(store, bundle.places) }]
              : []),
            { icon: '🗂️', label: 'Alles als Tabelle', hint: 'jedes Feld in einer Zeile', href: `/t/${tripId}/tabelle` },
            { icon: '🖨️', label: 'Tages-Ausdruck', hint: 'ein Tag pro Seite – zum Drucken oder als PDF', href: `/t/${tripId}/druck` },
            { icon: '🧯', label: 'Reise prüfen', hint: check.length ? `${plural(check.length, 'Ding', 'Dinge')} gefunden` : 'Zeiträume, Betten, Tage – nichts gefunden', href: `/t/${tripId}/pruefen` },
            { icon: '⇩', label: 'Dateien & Export', hint: 'CSV, Google-Maps-KML, JSON', href: `/t/${tripId}/reise#export` },
          ]}
        />
      </div>
    </section>
  );
}

