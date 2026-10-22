'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useStore, useTrip } from '../../../../lib/store';
import { useEditor } from '../../../../components/EditorProvider';
import { PendingList } from '../../../../components/PendingList';
import { PlaceCard } from '../../../../components/PlaceCard';
import { MapPreview, RoutePreview } from '../../../../components/MapPreview';
import { dayStops, hotelForDay, routeUrl } from '../../../../lib/maps';
import { assign, minToTime, setSlot } from '../../../../lib/dayplan';
import { DayBar } from '../../../../components/daybar';
import { Button, Card, Empty, Menu, SectionTitle, cx } from '../../../../components/ui';
import { dayPlan, nightCoverage } from '../../../../lib/stats';
import { locusChanges } from '../../../../lib/locus';
import { sortDays } from '../../../../lib/sortday';
import { ChangeStrip } from '../../../../components/Ortswechsel';
import { today } from '../../../../lib/format';
import { fmtDate, fmtDuration, plural } from '../../../../lib/format';

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

export default function DaysPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = String(params?.tripId ?? '');
  const store = useStore();
  const bundle = useTrip(tripId);
  const { open } = useEditor();
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [mapDay, setMapDay] = useState<string | null>(null);

  const days = bundle.trip ? dayPlan(bundle) : [];
  const pool = bundle.places.filter((p) => !p.date);
  const coverage = new Map(bundle.trip ? nightCoverage(bundle).map((n) => [n.date, n]) : []);
  const dateIndex = new Map(days.map((d, i) => [d.date, i]));
  const changeByDate = new Map(locusChanges(bundle.places, bundle.hotels, days.map((d) => d.date), bundle.journeys).map((c) => [c.date, c]));
  const now = today();

  const moveDay = (placeId: string, from: string | null, dir: -1 | 1) => {
    if (!from) return;
    const idx = dateIndex.get(from);
    if (idx === undefined) return;
    const next = days[idx + dir];
    if (!next) {
      store.patch('places', placeId, { date: null });
      store.say('Zurück in die Aktivitätenliste.');
      return;
    }
    const moving = bundle.places.find((x) => x.id === placeId);
    if (moving) assign(store, bundle.places, moving, { date: next.date });
  };

  const drop = (date: string | null) => (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    setDropTarget(null);
    if (!id) return;
    const place = bundle.places.find((p) => p.id === id);
    if (!place || place.date === date) return;
    if (!date) {
      store.patch('places', id, { date: null });
      store.say(`„${place.name}“ zurück in die Aktivitätenliste.`);
      return;
    }
    assign(store, bundle.places, place, { date });
  };

  if (!store.ready) return <Card className="p-8 text-center text-sm text-slate-400">lädt …</Card>;
  if (!bundle.trip) return null;

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Tagesplan"
        icon="🗓️"
        hint="Ziehen zum Planen · Lücke im Band = freie Zeit · über 8 h gilt ein Tag als voll"
      />

      <PendingList tripId={tripId} pool={pool} all={bundle.places} days={days.map((d) => ({ date: d.date, hours: d.hours, cities: d.cities, places: d.places }))} />

      <div className="no-print sticky top-0 z-20 -mx-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-ink-950/85 px-1 py-1 backdrop-blur">
        <div className="flex gap-1">
          {days.map((d) => (
            <a
              key={d.date}
              href={`#${d.date}`}
              className={cx(
                'flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] transition hover:bg-white/[0.07]',
                d.places.length ? 'text-slate-200' : 'text-slate-500',
              )}
              title={`${plural(d.places.length, 'Aktivität', 'Aktivitäten')} · ${d.hours.toFixed(1)} h`}
            >
              <span className={cx('font-semibold', d.date === now && 'text-amber-200')}>{fmtDate(d.date, { weekday: 'short' })}</span>
              <span className="tabular-nums">{fmtDate(d.date, { day: '2-digit', month: '2-digit' })}</span>
              <span className={cx('rounded px-1 tabular-nums', d.hours > 8 ? 'bg-shu-500/25 text-shu-100' : d.places.length ? 'bg-white/[0.07] text-slate-300' : 'text-slate-600')}>{d.places.length}</span>
            </a>
          ))}
          <a href={`/t/${tripId}/heute`} title="was heute und an den nächsten Tagen dran ist" className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white/[0.05] px-2 py-1 text-[12px] text-slate-200 hover:bg-white/10">☀️ Heute</a>
          {pool.length ? (
            <a href="#pool" className="flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-500/10 px-2 py-1 text-[12px] text-amber-100 ring-1 ring-inset ring-amber-400/25 hover:bg-amber-500/20">
              ✨ ohne Tag <span className="tabular-nums">{pool.length}</span>
            </a>
          ) : null}
        </div>
      </div>

      {!days.length ? (
        <Empty
          title="Für diese Reise ist noch kein Zeitraum gesetzt"
          hint="Oben rechts auf ⋯ → „Reise bearbeiten“ und Start-/Enddatum eintragen. Danach erscheinen hier die Tage zum Befüllen."
          action={
            <Button variant="primary" onClick={() => open({ kind: 'trip', id: tripId })}>
              Reise-Datum setzen
            </Button>
          }
        />
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
        {days.map((d) => {
          const night = coverage.get(d.date);
          const over = d.hours > 8;
          const stops = dayStops(d.places);
          const hotel = hotelForDay(bundle.hotels, d.date, d.cities[0] ?? d.places[0]?.city ?? null);
          const origin = hotel ?? stops[0] ?? null;
          const destination = stops.length > 1 ? stops[stops.length - 1] : stops[0] ?? null;
          const via = stops.length > 2 ? stops.slice(1, -1) : [];
          return (
            <Card
              key={d.date}
              id={d.date}
              onDragOver={(e) => {
                e.preventDefault();
                setDropTarget(d.date);
              }}
              onDragLeave={() => setDropTarget((cur) => (cur === d.date ? null : cur))}
              onDrop={drop(d.date)}
              className={cx('print-block scroll-mt-16 p-0 transition', dropTarget === d.date && 'drop-live', over && 'border-shu-400/30', d.date === now && 'ring-1 ring-white/20')}
            >
              <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-white/[0.06] px-3 py-2">
                <span className="text-[13.5px] font-semibold text-white">{fmtDate(d.date, { weekday: 'short', day: 'numeric', month: 'long' })}</span>
                {d.cities.length || d.journeys[0]?.to_city ? (
                  <span className="text-[12px] text-slate-400">{d.cities.length ? d.cities.join(' / ') : d.journeys[0]?.to_city}</span>
                ) : null}
                <span className="ml-auto flex items-center gap-1 text-[11.5px] text-slate-400">
                  <span className={cx('chip', over ? 'bg-shu-500/20 text-shu-100' : d.places.length ? 'bg-white/[0.06] text-slate-300' : 'bg-transparent text-slate-500')}>
                    {d.places.length ? `${plural(d.places.length, 'Aktivität', 'Aktivitäten')} · ${fmtDuration(d.hours * 60)}` : 'noch frei'}
                  </span>
                  <button className="icon-btn" title="Aktivität an diesem Tag anlegen" onClick={() => open({ kind: 'place', defaults: { date: d.date } })}>
                    ＋
                  </button>
                  <Menu
                    align="right"
                    variant="quiet"
                    icon="⋯"
                    title="Mehr für diesen Tag"
                    items={[
                      ...(stops.length > 1
                        ? [{ icon: '🧭', label: 'Tag als Route bei Google Maps', hint: `${stops.length} Halte, mit Fahrplan`, href: routeUrl({ origin: origin!, destination: destination!, stops: via, mode: 'transit' }) }]
                        : []),
                      ...(stops.length ? [{ icon: '🗺️', label: mapDay === d.date ? 'Karte ausblenden' : 'Karte zu diesem Tag zeigen', run: () => setMapDay((cur) => (cur === d.date ? null : d.date)) }] : []),
                      ...(pool.length
                        ? [
                            {
                              icon: '✨',
                              label: 'Obersten Wunsch hierher legen',
                              hint: pool[0].name,
                              run: () => {
                                const candidate = pool.find((x) => x.city === d.places[0]?.city) ?? pool[0];
                                if (candidate) assign(store, bundle.places, candidate, { date: d.date });
                              },
                            },
                          ]
                        : []),
                      ...(d.places.length > 1
                        ? [{ icon: '⚡', label: 'Tag sortieren', hint: 'der Reihe nach, ohne Überschneidungen', run: () => sortDays(store, [d]) }]
                        : []),
                      { icon: '🔀', label: 'Ortswechsel an diesem Tag', hint: 'Stadt, Bett und Fahrt umtragen', run: () => open({ kind: 'move', date: d.date }) },
                      { icon: '🗓️', label: 'Alle Aktivitäten der Reise', href: `/t/${tripId}/aktivitaeten` },
                    ]}
                  />
                </span>
              </header>

              {changeByDate.get(d.date) ? (
                <ChangeStrip
                  date={d.date}
                  from={changeByDate.get(d.date)!.from ?? '—'}
                  to={changeByDate.get(d.date)!.to}
                  fromHotel={changeByDate.get(d.date)!.fromHotel}
                  toHotel={changeByDate.get(d.date)!.toHotel}
                  daysInOld={changeByDate.get(d.date)!.daysInOld}
                  onOpen={() => open({ kind: 'move', date: d.date })}
                />
              ) : null}

              {(d.journeys.length || night) && (
                <div className="space-y-1 border-b border-white/[0.07] bg-black/20 px-3 py-2">
                  {d.journeys.map((j) => (
                    <button key={j.id} onClick={() => open({ kind: 'journey', id: j.id })} className="flex w-full items-center gap-2 text-left text-[12.5px] text-slate-300 hover:text-white">
                      <span aria-hidden>{MODE_ICON[j.mode ?? ''] ?? '🧳'}</span>
                      <span className="min-w-0 flex-1 truncate">
                        {j.title}
                        {j.from_city && j.to_city ? ` · ${j.from_city} → ${j.to_city}` : ''}
                        {j.departure_time ? ` · ${j.departure_time}` : ''}
                      </span>
                      {j.price_eur ? <span className="tabular-nums text-slate-400">{j.price_eur} €</span> : null}
                    </button>
                  ))}
                  {night && !night.covered ? (
                    <p className="text-[12px] text-shu-200" title="Diese Nacht ist noch keinem Hotel zugeordnet">
                      🏨 Nacht ohne Unterkunft – <Link href={`/t/${tripId}/unterkuenfte`} className="underline-offset-2 hover:underline">Hotel anlegen</Link>
                    </p>
                  ) : night?.covered ? (
                    <p className="text-[12px] text-slate-500">🛏 {night.hotel}</p>
                  ) : null}
                </div>
              )}

              {mapDay === d.date && origin && destination ? (
                <div className="border-b border-white/[0.07] p-2.5">
                  {stops.length > 1 ? (
                    <RoutePreview
                      origin={origin}
                      destination={destination}
                      stops={via}
                      mode="transit"
                      height={230}
                      heading={`${fmtDate(d.date, { weekday: 'short', day: '2-digit', month: '2-digit' })} · ${stops.length} Halte`}
                    />
                  ) : (
                    <MapPreview place={destination} height={190} heading={destination?.name ?? 'Karte'} />
                  )}
                  <p className="mt-1 text-[11px] leading-snug text-slate-500">
                    {hotel ? `Start an der Unterkunft „${hotel.name}“ · ` : 'Erster Punkt ist der Start · '}
                    Reihenfolge wie geplant, „öffnen“ zeigt Fahrpläne und Umstiege.
                  </p>
                </div>
              ) : null}

              {pool.length || d.places.length ? (
                <div className="border-b border-white/[0.05] px-3 pb-1.5 pt-2">
                  <DayBar
                    places={d.places}
                    height={14}
                    onPickSlot={
                      pool.length
                        ? (m) => {
                            const candidate = pool.find((x) => x.city === d.places[0]?.city) ?? pool[0];
                            if (candidate) assign(store, bundle.places, candidate, { date: d.date, start_time: minToTime(m) });
                          }
                        : undefined
                    }
                    onMove={(id, minute) => {
                      const moving = bundle.places.find((x) => x.id === id);
                      if (moving) setSlot(store, bundle.places, moving, { start: minute });
                    }}
                    onResize={(id, minutes) => {
                      const moving = bundle.places.find((x) => x.id === id);
                      if (moving) setSlot(store, bundle.places, moving, { duration: minutes });
                    }}
                  />
                </div>
              ) : null}

              <div className="space-y-2 p-2.5">
                {d.places.length ? (
                  d.places.map((p) => <PlaceCard key={p.id} place={p} onMove={(dir) => moveDay(p.id, d.date, dir)} />)
                ) : (
                  <div className="rounded-xl border border-dashed border-white/[0.12] px-3 py-4 text-center text-[12.5px] text-slate-500">
                    Noch frei – Punkt aus der Leiste hierher ziehen oder{' '}
                    <button className="text-shu-200 underline-offset-2 hover:underline" onClick={() => open({ kind: 'place', defaults: { date: d.date } })}>
                      neue Aktivität anlegen
                    </button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
