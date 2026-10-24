'use client';

/**
 * Der Tagesplan: ein Block pro Reisetag. Ein Tag mit Punkten ist eine Karte, ein leerer
 * Tag eine Zeile – bei vier Wochen Plan wäre sonst alles nur Scrollen. Ziehen (oder das
 * ＋ und die Ideen-Liste darunter) legt einen Punkt auf einen Tag, ▲▼ (oder Ziehen auf
 * eine Zeile) ändert die Reihenfolge. Uhrzeiten gibt es nicht.
 *
 * Die Unterkunft steht nicht mehr als Zeile an jedem Tag: ihre Farbe läuft links am
 * Kartenrand mit, genannt wird sie am Check-in, am Wechseltag und da, wo ein Bett fehlt.
 */
import React, { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useStore, useTrip } from '../../../../lib/store';
import { useEditor } from '../../../../components/EditorProvider';
import { PendingList } from '../../../../components/PendingList';
import { PlaceCard } from '../../../../components/PlaceCard';
import { DayPickerSheet } from '../../../../components/DayPickerSheet';
import { MapPreview, RoutePreview } from '../../../../components/MapPreview';
import { dayStops, hotelForDay, routeUrl } from '../../../../lib/maps';
import { assign, dayPlaces, moveToIndex, shiftWithin } from '../../../../lib/dayplan';
import { Button, Card, Empty, Menu, SectionTitle, cx } from '../../../../components/ui';
import { dayPlan, nightCoverage } from '../../../../lib/stats';
import { locusChanges } from '../../../../lib/locus';
import { ChangeStrip } from '../../../../components/ChangeStrip';
import { addDays, fmtDay, fmtDayLong, knownCity, plural, today } from '../../../../lib/format';
import { tintFor } from '../../../../lib/palette';
import { TouchDragProvider, type DropZone } from '../../../../components/TouchDrag';
import type { Place } from '../../../../lib/types';

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

/** links an der Karte läuft die Farbe der Unterkunft mit – das ersetzt die Hotelzeile */
function randFarbe(night?: { covered: boolean; hotelId: string | null } | null): React.CSSProperties {
  if (!night?.covered) return { boxShadow: 'inset 4px 0 0 rgba(240, 78, 35, 0.5)' };
  return { boxShadow: `inset 4px 0 0 ${tintFor(night.hotelId).edge}` };
}

export default function DaysPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = String(params?.tripId ?? '');
  const store = useStore();
  const bundle = useTrip(tripId);
  const { open } = useEditor();
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [insertAt, setInsertAt] = useState<string | null>(null);
  const [mapDay, setMapDay] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null>(null);

  const days = useMemo(() => (bundle.trip ? dayPlan(bundle) : []), [bundle]);
  const pool = bundle.places.filter((p) => !p.date);
  const coverage = new Map(bundle.trip ? nightCoverage(bundle).map((n) => [n.date, n]) : []);
  const dateIndex = new Map(days.map((d, i) => [d.date, i]));
  const changeByDate = new Map(locusChanges(bundle.hotels, days.map((d) => d.date), bundle.journeys).map((c) => [c.date, c]));
  const checkIn = new Set(bundle.hotels.map((h) => h.check_in).filter(Boolean) as string[]);
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

  /**
   * wohin mit dem Punkt – dieselbe Rechnung für Maus (dataTransfer) und Finger (Pointer):
   * Zone = Tag oder „pool“ (vom Tag lösen), Zeile = Stelle, sonst ans Ende des Tages.
   */
  const applyDrop = (id: string, zone: DropZone) => {
    const place = bundle.places.find((p) => p.id === id);
    if (!place) return;
    const date = zone.date;
    if (!date) {
      if (!place.date) return; // nur kurz aufs Griff getippt – nichts zu lösen
      store.patch('places', id, { date: null });
      store.say(`„${place.name}“ zurück in die Aktivitätenliste.`);
      return;
    }
    if (zone.index === null) {
      if (place.date === date) return;
      assign(store, bundle.places, place, { date });
      return;
    }
    if (place.date !== date) {
      assign(store, bundle.places, place, { date, before: dayPlaces(bundle.places, date)[zone.index]?.id ?? null });
      return;
    }
    const list = dayPlaces(bundle.places, date);
    const from = list.findIndex((p) => p.id === id);
    moveToIndex(store, bundle.places, id, date, from < zone.index ? zone.index - 1 : zone.index);
  };

  const drop = (date: string | null) => (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    setDropTarget(null);
    setInsertAt(null);
    if (id) applyDrop(id, { date, index: null });
  };

  /** auf eine Zeile ziehen = dort einfügen, der Rest rückt nach */
  const dropOnRow = (date: string, index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const id = e.dataTransfer.getData('text/plain');
    setInsertAt(null);
    setDropTarget(null);
    if (id) applyDrop(id, { date, index });
  };

  const zettel = (date: string) => fmtDayLong(date);

  const bettEintragen = (date: string, city?: string | null) => (e: React.MouseEvent) => {
    e.stopPropagation();
    open({ kind: 'hotel', defaults: { check_in: date, check_out: addDays(date, 1), city: city ?? undefined } });
  };

  if (!store.ready) return <Card className="p-8 text-center text-sm text-slate-400">lädt …</Card>;
  if (!bundle.trip) return null;

  return (
    <TouchDragProvider onDrop={applyDrop}>
      <div className="space-y-4">
        <SectionTitle title="Tagesplan" icon="🗓️" hint="Punkte untereinander = die Reihenfolge des Tages · ziehen legt auf einen Tag (Handy: am ⠿ halten), ▲▼ rückt um, ＋ zeigt die Ideen ohne Tag" />

        <PendingList tripId={tripId} pool={pool} all={bundle.places} days={days.map((d) => ({ date: d.date, cities: d.cities, places: d.places }))} />

        <div className="day-nav no-print sticky top-0 z-20 -mx-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-ink-950/85 px-1 py-1 backdrop-blur">
          <div className="flex gap-1">
            {days.map((d) => (
              <a
                key={d.date}
                href={`#${d.date}`}
                className={cx('flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] transition hover:bg-white/[0.07]', d.places.length ? 'text-slate-200' : 'text-slate-400')}
                title={plural(d.places.length, 'Aktivität', 'Aktivitäten')}
              >
                <span className={cx('font-semibold tabular-nums', d.date === now && 'text-amber-200')}>{fmtDay(d.date)}</span>
                <span className={cx('rounded px-1 tabular-nums', d.places.length >= 5 ? 'bg-shu-500/25 text-shu-100' : d.places.length ? 'bg-white/[0.07] text-slate-300' : 'text-slate-400')}>{d.places.length}</span>
              </a>
            ))}
            {pool.length ? (
              <a href="#pool" className="flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-500/10 px-2 py-1 text-[13px] text-amber-100 ring-1 ring-inset ring-amber-400/25 hover:bg-amber-500/20">
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

        <div className="grid grid-cols-1 gap-1.5 md:grid-cols-2 md:gap-2 xl:grid-cols-2 2xl:grid-cols-3">
          {days.map((d) => {
            const night = coverage.get(d.date);
            const stops = dayStops(d.places);
            const hotel = hotelForDay(bundle.hotels, d.date, d.cities[0] ?? d.places[0]?.city ?? null);
            const origin = hotel ?? stops[0] ?? null;
            const destination = stops.length > 1 ? stops[stops.length - 1] : stops[0] ?? null;
            const via = stops.length > 2 ? stops.slice(1, -1) : [];
            const geordnet = dayPlaces(bundle.places, d.date);
            const wechsel = changeByDate.get(d.date);
            const stadt = knownCity(d.cities[0] ?? hotel?.city ?? null);
            const ohneBett = !night?.covered;
            const Zone = {
              id: d.date,
              'data-dropzone': d.date,
              onDragOver: (e: React.DragEvent) => {
                e.preventDefault();
                setDropTarget(d.date);
              },
              onDragLeave: () => setDropTarget((cur) => (cur === d.date ? null : cur)),
              onDrop: drop(d.date),
            };

            // ── der leere Tag: eine Zeile, keine Karte ──────────────────────
            if (!geordnet.length) {
              return (
                <div
                  key={d.date}
                  {...Zone}
                  style={randFarbe(night)}
                  className={cx(
                    'day-line flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-0.5 transition hover:bg-white/[0.05]',
                    dropTarget === d.date && 'drop-live',
                    d.date === now && 'ring-1 ring-white/20',
                  )}
                  data-leer={d.date}
                >
                  <button className="flex min-w-0 flex-1 items-center gap-x-1.5 text-left" onClick={() => setPick(d.date)} title={`${zettel(d.date)} – Ideen zeigen`} aria-label={`Ideen für ${zettel(d.date)}`}>
                    <span className={cx('shrink-0 text-[13.5px] font-semibold tabular-nums', d.date === now ? 'text-amber-200' : 'text-slate-200')}>{fmtDay(d.date)}</span>
                    {stadt ? <span aria-hidden className="shrink-0 text-slate-400">·</span> : null}
                    {stadt ? <span className="min-w-0 truncate text-[13px] text-slate-400">{stadt}</span> : null}
                    {d.journeys.length ? (
                      <span className="inline-flex min-w-0 items-center gap-1 text-[13px] text-slate-400">
                        <span aria-hidden>{MODE_ICON[d.journeys[0]?.mode ?? ''] ?? '🧳'}</span>
                        <span className="min-w-0 truncate">{d.journeys[0]?.title ?? 'Fahrt'}</span>
                      </span>
                    ) : null}
                    {wechsel ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-shu-500/15 px-1.5 text-[13px] text-shu-100" title="Ortswechsel">
                        <span aria-hidden>🔀</span> {wechsel.to}
                      </span>
                    ) : null}
                    <span className="shrink-0 text-[13px] text-slate-400">frei</span>
                  </button>
                  {ohneBett ? (
                    <button className="day-warn shrink-0" onClick={bettEintragen(d.date, stadt)}>
                      Kein Bett eingetragen
                    </button>
                  ) : null}
                  <button className="icon-btn shrink-0" onClick={() => setPick(d.date)} title={`Was soll an diesem Tag? ${pool.length} Ideen sind noch ohne Tag`}>
                    ＋
                  </button>
                </div>
              );
            }

            // ── der gefüllte Tag: die normale Karte ─────────────────────────
            const bettZeige = checkIn.has(d.date) || Boolean(wechsel) || ohneBett;
            return (
              <Card
                key={d.date}
                {...Zone}
                style={randFarbe(night)}
                className={cx('print-block min-w-0 scroll-mt-16 rounded-xl p-0 transition', dropTarget === d.date && 'drop-live', d.date === now && 'ring-1 ring-white/20')}
              >
                <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-white/[0.06] px-3 py-2">
                  <span className="text-[13.5px] font-semibold text-white">{zettel(d.date)}</span>
                  {stadt || d.journeys[0]?.to_city ? <span className="text-[13px] text-slate-400">{stadt ? d.cities.join(' / ') : d.journeys[0]?.to_city}</span> : null}
                  <span className="ml-auto flex items-center gap-1 text-[13px] text-slate-400">
                    <span className={cx('chip', geordnet.length >= 5 ? 'bg-shu-500/20 text-shu-100' : 'bg-white/[0.06] text-slate-300')}>{plural(geordnet.length, 'Punkt', 'Punkte')}</span>
                    <button className="icon-btn" title="Ideen für diesen Tag zeigen" onClick={() => setPick(d.date)}>
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
                        { icon: '✨', label: 'Ideen dieses Tags zeigen', hint: pool.length ? `${plural(pool.length, 'Punkt', 'Punkte')} noch ohne Tag` : 'alle Punkte haben schon einen Tag', run: () => setPick(d.date) },
                        { icon: '🗂️', label: 'Alle Aktivitäten der Reise', href: `/t/${tripId}/aktivitaeten` },
                      ]}
                    />
                  </span>
                </header>

                {wechsel ? (
                  <ChangeStrip
                    date={d.date}
                    from={wechsel.from ?? '—'}
                    to={wechsel.to}
                    fromHotel={wechsel.fromHotel}
                    toHotel={wechsel.toHotel}
                    nightsInOld={wechsel.nightsInOld}
                    journey={wechsel.journey?.title ?? null}
                  />
                ) : null}

                {d.journeys.length || bettZeige ? (
                  <div className="space-y-1 border-b border-white/[0.07] bg-black/20 px-3 py-1.5">
                    {d.journeys.map((j) => (
                      <button key={j.id} onClick={() => open({ kind: 'journey', id: j.id })} className="flex w-full items-center gap-2 text-left text-[13px] text-slate-300 hover:text-white">
                        <span aria-hidden>{MODE_ICON[j.mode ?? ''] ?? '🧳'}</span>
                        <span className="min-w-0 flex-1 truncate">
                          {j.title}
                          {j.from_city && j.to_city ? ` · ${j.from_city} → ${j.to_city}` : ''}
                          {j.departure_time ? ` · ${j.departure_time}` : ''}
                        </span>
                        {j.price_eur ? <span className="tabular-nums text-slate-400">{j.price_eur} €</span> : null}
                      </button>
                    ))}
                    {ohneBett ? (
                      <p className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-shu-200">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-shu-400" aria-hidden />
                        Kein Bett eingetragen
                        <button className="day-warn ml-auto" onClick={bettEintragen(d.date, stadt)}>
                          ＋ eintragen
                        </button>
                      </p>
                    ) : bettZeige ? (
                      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] text-slate-400" title={`Nacht in ${night?.hotel}`}>
                        <span aria-hidden>{checkIn.has(d.date) ? '🛏' : '🛏️'}</span>
                        <span className="min-w-0 flex-1 truncate">
                          {checkIn.has(d.date) ? 'Ankunft im ' : ''}
                          {night?.hotel}
                          {checkIn.has(d.date) && night?.stays ? ` · ${plural(night.stays, 'Nacht', 'Nächten')}` : ''}
                        </span>
                        <button className="ml-auto text-[13px] text-slate-400 underline-offset-2 hover:text-white hover:underline" onClick={() => night?.hotelId && open({ kind: 'hotel', id: night.hotelId })}>
                          ✎ Bett
                        </button>
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {mapDay === d.date && origin && destination ? (
                  <div className="border-b border-white/[0.07] p-2.5">
                    {stops.length > 1 ? (
                      <RoutePreview origin={origin} destination={destination} stops={via} mode="transit" height={230} heading={`${fmtDay(d.date)} · ${stops.length} Halte`} />
                    ) : (
                      <MapPreview place={destination} height={190} heading={destination?.name ?? 'Karte'} />
                    )}
                    <p className="mt-1 text-[13px] leading-snug text-slate-400">
                      {hotel ? `Start an der Unterkunft „${hotel.name}“ · ` : 'Erster Punkt ist der Start · '} die Liste unten ist die Reihenfolge der Stationen.
                    </p>
                  </div>
                ) : null}

                <div className="space-y-2 pt-1 pb-2.5">
                  {geordnet.map((p, i) => (
                    <div
                      key={p.id}
                      data-dropindex={i}
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
                  ))}
                </div>
              </Card>
            );
          })}
        </div>

        {pick
          ? (() => {
              const tag = pick;
              const stadt = knownCity(days.find((d) => d.date === tag)?.cities[0] ?? null);
              return (
                <DayPickerSheet
                  date={tag}
                  label={zettel(tag)}
                  city={stadt}
                  pool={pool}
                  onPick={(p: Place) => assign(store, bundle.places, p, { date: tag })}
                  onNew={() => {
                    setPick(null);
                    open({ kind: 'place', defaults: { date: tag, city: stadt ?? undefined } });
                  }}
                  onClose={() => setPick(null)}
                />
              );
            })()
          : null}
      </div>
    </TouchDragProvider>
  );
}
