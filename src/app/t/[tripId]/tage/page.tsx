'use client';

/**
 * Der Tagesplan: eine Karte pro Reisetag, darin die Punkte der Reihe nach.
 * Oben die Liste „Noch ohne Tag“. Ziehen legt einen Punkt auf einen Tag,
 * ▲▼ (oder Ziehen auf eine Zeile) ändert die Reihenfolge. Uhrzeiten gibt es nicht.
 */
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useStore, useTrip } from '../../../../lib/store';
import { useEditor } from '../../../../components/EditorProvider';
import { PendingList } from '../../../../components/PendingList';
import { PlaceCard } from '../../../../components/PlaceCard';
import { MapPreview, RoutePreview } from '../../../../components/MapPreview';
import { dayStops, hotelForDay, routeUrl } from '../../../../lib/maps';
import { assign, dayPlaces, moveToIndex, shiftWithin } from '../../../../lib/dayplan';
import { Button, Card, Empty, Menu, SectionTitle, cx } from '../../../../components/ui';
import { dayPlan, nightCoverage } from '../../../../lib/stats';
import { locusChanges } from '../../../../lib/locus';
import { ChangeStrip } from '../../../../components/Ortswechsel';
import { addDays, today } from '../../../../lib/format';
import { fmtDate, plural } from '../../../../lib/format';
import { tintFor } from '../../../../lib/palette';

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
  const [insertAt, setInsertAt] = useState<string | null>(null);
  const [mapDay, setMapDay] = useState<string | null>(null);

  const days = useMemo(() => (bundle.trip ? dayPlan(bundle) : []), [bundle]);
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
    setInsertAt(null);
    if (!id) return;
    const place = bundle.places.find((p) => p.id === id);
    if (!place) return;
    if (!date) {
      store.patch('places', id, { date: null });
      store.say(`„${place.name}“ zurück in die Aktivitätenliste.`);
      return;
    }
    if (place.date === date) return;
    assign(store, bundle.places, place, { date });
  };

  /** auf eine Zeile ziehen = dort einfügen, der Rest rückt nach */
  const dropOnRow = (date: string, index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const id = e.dataTransfer.getData('text/plain');
    setInsertAt(null);
    setDropTarget(null);
    if (!id) return;
    const place = bundle.places.find((p) => p.id === id);
    if (!place) return;
    if (place.date !== date) {
      assign(store, bundle.places, place, { date, before: dayPlaces(bundle.places, date)[index]?.id ?? null });
      return;
    }
    const list = dayPlaces(bundle.places, date);
    const from = list.findIndex((p) => p.id === id);
    moveToIndex(store, bundle.places, id, date, from < index ? index - 1 : index);
  };

  if (!store.ready) return <Card className="p-8 text-center text-sm text-slate-400">lädt …</Card>;
  if (!bundle.trip) return null;

  return (
    <div className="space-y-4">
      <SectionTitle title="Tagesplan" icon="🗓️" hint="Punkte untereinander = die Reihenfolge des Tages · ziehen legt auf einen Tag, ▲▼ rückt um" />

      <PendingList tripId={tripId} pool={pool} all={bundle.places} days={days.map((d) => ({ date: d.date, cities: d.cities, places: d.places }))} />

      <div className="no-print sticky top-0 z-20 -mx-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-ink-950/85 px-1 py-1 backdrop-blur">
        <div className="flex gap-1">
          {days.map((d) => (
            <a
              key={d.date}
              href={`#${d.date}`}
              className={cx('flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] transition hover:bg-white/[0.07]', d.places.length ? 'text-slate-200' : 'text-slate-500')}
              title={plural(d.places.length, 'Aktivität', 'Aktivitäten')}
            >
              <span className={cx('font-semibold', d.date === now && 'text-amber-200')}>{fmtDate(d.date, { weekday: 'short' })}</span>
              <span className="tabular-nums">{fmtDate(d.date, { day: '2-digit', month: '2-digit' })}</span>
              <span className={cx('rounded px-1 tabular-nums', d.places.length >= 5 ? 'bg-shu-500/25 text-shu-100' : d.places.length ? 'bg-white/[0.07] text-slate-300' : 'text-slate-600')}>{d.places.length}</span>
            </a>
          ))}
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
          const stops = dayStops(d.places);
          const hotel = hotelForDay(bundle.hotels, d.date, d.cities[0] ?? d.places[0]?.city ?? null);
          const origin = hotel ?? stops[0] ?? null;
          const destination = stops.length > 1 ? stops[stops.length - 1] : stops[0] ?? null;
          const via = stops.length > 2 ? stops.slice(1, -1) : [];
          const geordnet = dayPlaces(bundle.places, d.date);
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
              className={cx('print-block scroll-mt-16 p-0 transition', dropTarget === d.date && 'drop-live', d.date === now && 'ring-1 ring-white/20')}
            >
              <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-white/[0.06] px-3 py-2">
                <span className="text-[13.5px] font-semibold text-white">{fmtDate(d.date, { weekday: 'short', day: 'numeric', month: 'long' })}</span>
                {d.cities.length || d.journeys[0]?.to_city ? <span className="text-[12px] text-slate-400">{d.cities.length ? d.cities.join(' / ') : d.journeys[0]?.to_city}</span> : null}
                <span className="ml-auto flex items-center gap-1 text-[11.5px] text-slate-400">
                  <span className={cx('chip', geordnet.length >= 5 ? 'bg-shu-500/20 text-shu-100' : geordnet.length ? 'bg-white/[0.06] text-slate-300' : 'bg-transparent text-slate-500')}>
                    {geordnet.length ? plural(geordnet.length, 'Punkt', 'Punkte') : 'noch frei'}
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
                      ...(stops.length > 1 ? [{ icon: '🧭', label: 'Tag als Route bei Google Maps', hint: `${stops.length} Halte, in der Reihenfolge der Liste`, href: routeUrl({ origin: origin!, destination: destination!, stops: via, mode: 'transit' as const }) }] : []),
                      ...(stops.length ? [{ icon: '🗺️', label: mapDay === d.date ? 'Karte ausblenden' : 'Karte zu diesem Tag zeigen', run: () => setMapDay((cur) => (cur === d.date ? null : d.date)) }] : []),
                      ...(pool.length ? [{ icon: '✨', label: 'Obersten Wunsch hierher legen', hint: pool[0].name, run: () => { const candidate = pool.find((x) => x.city === d.places[0]?.city) ?? pool[0]; if (candidate) assign(store, bundle.places, candidate, { date: d.date }); } }] : []),
                      { icon: '🔀', label: 'Ortswechsel an diesem Tag', hint: 'Stadt, Bett und Fahrt umtragen', run: () => open({ kind: 'move', date: d.date }) },
                      { icon: '🗂️', label: 'Alle Aktivitäten der Reise', href: `/t/${tripId}/aktivitaeten` },
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
                    <p className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-shu-200" title="Diese Nacht ist noch keinem Hotel zugeordnet">
                      <span className="h-2 w-2 rounded-full bg-shu-400" aria-hidden />
                      Nacht ohne Bett
                      <button
                        className="ml-auto rounded-md bg-shu-500/20 px-1.5 py-0.5 text-[11px] text-shu-50 ring-1 ring-inset ring-shu-400/40 transition hover:bg-shu-500/30"
                        onClick={() => open({ kind: 'hotel', defaults: { check_in: d.date, check_out: addDays(d.date, 1), city: d.cities[0] ?? undefined } })}
                      >
                        ＋ Bett eintragen
                      </button>
                    </p>
                  ) : night?.covered ? (
                    <p className="flex items-center gap-1.5 text-[12px] text-slate-400" title={`Nacht in ${night.hotel}`}>
                      <span className="h-2 w-2 rounded-full" style={{ background: tintFor(night.hotelId).edge }} aria-hidden />
                      <span className="truncate">{night.hotel}</span>
                      <button className="ml-auto text-[11px] text-slate-500 underline-offset-2 hover:text-white hover:underline" onClick={() => night.hotelId && open({ kind: 'hotel', id: night.hotelId })}>
                        ✎ Bett
                      </button>
                    </p>
                  ) : null}
                </div>
              )}

              {mapDay === d.date && origin && destination ? (
                <div className="border-b border-white/[0.07] p-2.5">
                  {stops.length > 1 ? (
                    <RoutePreview origin={origin} destination={destination} stops={via} mode="transit" height={230} heading={`${fmtDate(d.date, { weekday: 'short', day: '2-digit', month: '2-digit' })} · ${stops.length} Halte`} />
                  ) : (
                    <MapPreview place={destination} height={190} heading={destination?.name ?? 'Karte'} />
                  )}
                  <p className="mt-1 text-[11px] leading-snug text-slate-500">
                    {hotel ? `Start an der Unterkunft „${hotel.name}“ · ` : 'Erster Punkt ist der Start · '} die Liste unten ist die Reihenfolge der Stationen.
                  </p>
                </div>
              ) : null}

              <div className="space-y-2 p-2.5">
                {geordnet.length ? (
                  geordnet.map((p, i) => (
                    <div
                      key={p.id}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setInsertAt(p.id);
                      }}
                      onDragLeave={() => setInsertAt((cur) => (cur === p.id ? null : cur))}
                      onDrop={dropOnRow(d.date, i)}
                      className={cx('rounded-xl transition', insertAt === p.id && 'ring-1 ring-shu-400/60')}
                    >
                      <PlaceCard
                        place={p}
                        nr={i + 1}
                        onMove={(dir) => moveDay(p.id, d.date, dir)}
                        onUp={i > 0 ? () => shiftWithin(store, bundle.places, p, -1) : undefined}
                        onDown={i < geordnet.length - 1 ? () => shiftWithin(store, bundle.places, p, 1) : undefined}
                      />
                    </div>
                  ))
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
