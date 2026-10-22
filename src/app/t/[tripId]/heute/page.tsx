'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useStore, useTrip } from '../../../../lib/store';
import { useEditor } from '../../../../components/EditorProvider';
import { Button, Card, Empty, Menu, Pill, ProgressBar, SectionTitle, cx } from '../../../../components/ui';
import { dayContext, DAY_SLOTS, dayBuckets, slotIcon, slotLabel, upcoming } from '../../../../lib/today';
import { liveDay, nextUp, nowMinutes, startHint, startTrip, endTrip, tripMode } from '../../../../lib/mode';
import { assign, minToTime, plannedMinutes, windowsOf } from '../../../../lib/dayplan';
import { locusChanges, stayOn } from '../../../../lib/locus';
import { ChangeStrip } from '../../../../components/Ortswechsel';
import { dayPlan } from '../../../../lib/stats';
import { categoryMeta, mapsUrl, TICKET_META } from '../../../../lib/categories';
import { CategoryDot } from '../../../../components/CategoryDot';
import { addDays, fmtDate, fmtDuration, plural } from '../../../../lib/format';
import { routeUrl } from '../../../../lib/maps';
import { dayStops } from '../../../../lib/maps';
import type { Place } from '../../../../lib/types';

/**
 * Die Tagesseite. Zwei Zustände, ein Ziel:
 · unterwegs (▶️) = groß, fingerfreundlich, Ort + Route + Hinweise + abhaken
 · Planung (🗓️)  = derselbe Tag zum Bauen, plus der Startknopf
 */
export default function TodayPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = String(params?.tripId ?? '');
  const store = useStore();
  const bundle = useTrip(tripId);
  const { open } = useEditor();
  const live = tripMode(bundle.trip) === 'live';

  const planIso = today0();
  const ctx = dayContext(bundle.trip, planIso);
  const liveInfo = liveDay(bundle.trip, planIso);
  const iso = live ? liveInfo?.iso ?? planIso : planIso;

  const days = useMemo(() => (bundle.trip ? dayPlan(bundle) : []), [bundle]);
  const day = days.find((d) => d.date === iso) ?? null;
  const changes = useMemo(() => locusChanges(bundle.places, bundle.hotels, days.map((d) => d.date), bundle.journeys), [bundle, days]);

  if (!store.ready) return <Card className="p-8 text-center text-sm text-slate-400">lädt …</Card>;
  if (!bundle.trip) return null;

  const shared = { bundle, day, iso, days, changes, open, store, tripId, ctx };

  return live ? <Unterwegs {...shared} info={liveInfo} /> : <PlanungsTag {...shared} />;
}

/** heute – bewusst lokal, damit die Seite den Tag der Uhr nimmt */
function today0() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type Shared = {
  bundle: ReturnType<typeof useTrip>;
  day: ReturnType<typeof dayPlan>[number] | null;
  iso: string;
  days: ReturnType<typeof dayPlan>;
  changes: ReturnType<typeof locusChanges>;
  open: ReturnType<typeof useEditor>['open'];
  store: ReturnType<typeof useStore>;
  tripId: string;
  ctx: ReturnType<typeof dayContext>;
};

/* ════════════════════════════ UNTERWEGS (live) ════════════════════════════ */

function Unterwegs({ bundle, day, iso, days, changes, open, store, tripId, info }: Shared & { info: ReturnType<typeof liveDay> }) {
  const [offen, setOffen] = useState<string | null>(null);
  const trip = bundle.trip!;
  const buckets = dayBuckets(day?.places ?? []);
  const list = day?.places ?? [];
  const done = list.filter((p) => p.booking_status === 'erledigt').length;
  const stay = stayOn(bundle.hotels, iso);
  const change = changes.find((c) => c.date === iso) ?? null;
  const naechsteChange = changes.find((c) => c.date > iso) ?? null;
  const next = nextUp(list, nowMinutes());
  const naeheTage = days.filter((d) => d.date > iso).slice(0, 3);
  const morgen = naeheTage[0] ?? null;
  const planAusblick = naeheTage;
  const stops = dayStops(list);
  const routeOrigin = stay ?? stops[0] ?? null;
  const routeDestination = stops.length > 1 ? stops[stops.length - 1] : stops[0] ?? null;
  const via = stops.length > 2 ? stops.slice(1, -1) : [];

  const toggle = (p: Place) => store.patch('places', p.id, { booking_status: p.booking_status === 'erledigt' ? 'offen' : 'erledigt' });

  return (
    <div className="mx-auto w-full max-w-xl space-y-3 pb-24">
      <Card className="border-emerald-300/20 bg-ink-800 p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] uppercase tracking-wide text-emerald-200/80">
              <span aria-hidden>🚶</span> unterwegs
              {info?.klemmt ? <span className="normal-case tracking-normal text-amber-200/80">{info.klemmt === 'vorher' ? 'der Plan beginnt erst – Tag 1 wird gezeigt' : 'der Plan ist vorbei – letzter Tag wird gezeigt'}</span> : null}
            </p>
            <h1 className="mt-0.5 text-[20px] font-semibold leading-tight text-white">{fmtDate(iso, { weekday: 'long', day: 'numeric', month: 'long' })}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-slate-300">
              <span className="text-slate-400">
                Tag {info?.tagIndex ?? '–'} von {info?.total || '?'}
              </span>
              <span className="text-slate-600">·</span>
              <span aria-hidden>📍</span>
              <span className="font-medium">{day?.cities.join(' / ') || stay?.city || 'ohne Ort'}</span>
              {list.length ? (
                <>
                  <span className="text-slate-600">·</span>
                  <span className={cx('tabular-nums', done === list.length ? 'text-emerald-200' : 'text-slate-400')}>
                    {done}/{list.length} erledigt
                  </span>
                </>
              ) : null}
            </p>
          </div>
          <Menu
            align="right"
            variant="quiet"
            icon="⋯"
            title="Unterwegs"
            items={[
              { icon: '🗓️', label: 'Alles planen', hint: 'Tage, Aktivitäten, Karte', href: `/t/${tripId}/tage` },
              { icon: '🗺️', label: 'Karte der Stadt', hint: 'Punkte und Unterkünfte', href: `/t/${tripId}/karte` },
              ...(stops.length > 1
                ? [{ icon: '🧭', label: 'Tagesroute bei Google Maps', hint: `${stops.length} Halte`, href: routeUrl({ origin: routeOrigin!, destination: routeDestination!, stops: via, mode: 'transit' as const }) }]
                : []),
              ...(trip.planned_start
                ? [{ icon: '↩', label: 'Start zurücknehmen', hint: 'Planungszeitraum wieder herstellen', run: () => endTrip(store, bundle, true) }]
                : []),
              { icon: '✕', label: 'Reise beenden', hint: 'zurück in die Planung', run: () => endTrip(store, bundle, false) },
            ]}
          />
        </div>
        {list.length ? (
          <div className="mt-2">
            <ProgressBar value={done} max={list.length} tone="matcha" />
          </div>
        ) : null}
        {stay ? (
          <a href={mapsUrl({ name: stay.name, city: stay.city, lat: stay.lat, lng: stay.lng, maps_query: null })} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 rounded-xl bg-black/25 px-2.5 py-1.5 text-[12.5px] text-slate-300 active:bg-black/40">
            <span aria-hidden>🏨</span>
            <span className="min-w-0 flex-1 truncate">{stay.name}</span>
            {stay.address ? <span className="shrink-0 text-[11.5px] text-slate-500">{stay.address}</span> : null}
            <span className="shrink-0 text-[11.5px] text-sky-200/80">🗺️</span>
          </a>
        ) : (
          <p className="mt-2 rounded-xl bg-amber-500/10 px-2.5 py-1.5 text-[12.5px] text-amber-100">
            🏨 Diese Nacht hat noch keine Unterkunft – <Link href={`/t/${tripId}/unterkuenfte`} className="underline underline-offset-2">eine wählen</Link>
          </p>
        )}
      </Card>

      {change ? (
        <Card className="overflow-hidden p-0">
          <ChangeStrip date={change.date} from={change.from ?? '—'} to={change.to} fromHotel={change.fromHotel} toHotel={change.toHotel} daysInOld={change.daysInOld} onOpen={() => open({ kind: 'move', date: change.date })} />
        </Card>
      ) : null}

      {next && !next.laeuft ? (
        <Card className="border-emerald-300/25 bg-emerald-400/[0.07] p-3">
          <p className="text-[11.5px] uppercase tracking-wide text-emerald-200/80">als nächstes</p>
          <div className="mt-1 flex items-start gap-2.5">
            <CategoryDot category={next.place.category} size={26} />
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-semibold leading-snug text-white">{next.place.name}</p>
              <p className="mt-0.5 text-[12.5px] text-slate-300">
                {next.place.start_time ?? 'ohne Uhrzeit'}
                {next.inMin > 0 ? ` · in ${fmtDuration(next.inMin)}` : next.inMin < -60 ? ` · vor ${fmtDuration(-next.inMin)}` : ' · jetzt'}
                {next.place.travel_time ? ` · 🚶 ${next.place.travel_time}` : ''}
                {next.place.district ? ` · ${next.place.district}` : ''}
              </p>
              {next.place.ticket_status === 'noetig' ? (
                <p className="mt-1 text-[12px] text-amber-100">
                  🎫 {TICKET_META.noetig.label}
                  {next.place.ticket_note ? ` – ${next.place.ticket_note}` : ''}
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <a href={mapsUrl(next.place)} target="_blank" rel="noreferrer" className="btn-primary !px-3 !py-1.5 !text-[13px]">
              🗺️ Hinfinden
            </a>
            <Button size="sm" variant="ghost" onClick={() => toggle(next.place)}>
              ✓ erledigt
            </Button>
            {next.place.notes ? (
              <Button size="sm" variant="quiet" onClick={() => setOffen(offen === next.place.id ? null : next.place.id)}>
                {offen === next.place.id ? 'Hinweise zu' : 'Hinweise'}
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      {!list.length ? (
        <Card className="p-5 text-center">
          <p className="text-[15px] font-medium text-white">Heute ist nichts eingetragen</p>
          <p className="mx-auto mt-1 max-w-[28rem] text-[12.5px] leading-relaxed text-slate-400">
            {bundle.places.filter((p) => !p.date).length ? 'In der Liste warten Punkte auf einen Tag – auf der Planungsseite lässt sich der Tag in zwei Klicks füllen.' : 'Nichts zu holen: der Tag ist leer.'}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            <Link href={`/t/${tripId}/tage#${iso}`} className="btn-ghost !px-3 !py-1.5 !text-[13px]">
              🗓️ Tag planen
            </Link>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                const candidate = bundle.places.find((p) => !p.date);
                if (candidate) assign(store, bundle.places, candidate, { date: iso });
                else open({ kind: 'place', defaults: { date: iso } });
              }}
            >
              ＋ Punkt hierher
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {DAY_SLOTS.filter((key) => buckets[key].length > 0).map((key) => (
            <section key={key}>
              <h2 className="mb-1 flex items-center gap-1.5 text-[12px] uppercase tracking-wide text-slate-500">
                <span aria-hidden>{slotIcon[key]}</span> {slotLabel[key]}
                <span className="text-slate-600">· {buckets[key].length}</span>
              </h2>
              <Card className="divide-y divide-white/[0.05] p-0">
                {buckets[key].map((p) => (
                  <LiveRow
                    key={p.id}
                    place={p}
                    expanded={offen === p.id}
                    onExpand={() => setOffen(offen === p.id ? null : p.id)}
                    onToggle={() => toggle(p)}
                    onEdit={() => open({ kind: 'place', id: p.id })}
                  />
                ))}
              </Card>
            </section>
          ))}
        </div>
      )}

      {list.length && done === list.length ? (
        <Card className="border-emerald-300/30 bg-emerald-400/[0.08] p-3.5">
          <p className="text-[14.5px] font-semibold text-white">🎉 Tag {info?.tagIndex ?? ''} geschafft – {plural(done, 'Punkt', 'Punkte')} erledigt</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-slate-300">
            {morgen ? `Morgen${morgen.places.length ? `: ${plural(morgen.places.length, 'Punkt', 'Punkte')}` : ' ist nichts eingetragen'} in ${morgen.places[0]?.city ?? stayOn(bundle.hotels, morgen.date)?.city ?? '—'}.` : 'Das war der letzte eingetragene Tag.'}{' '}
            {naechsteChange && morgen && naechsteChange.date === morgen.date ? <span className="text-shu-200">🔀 {naechsteChange.from} → {naechsteChange.to}</span> : null}
          </p>
        </Card>
      ) : null}

      {planAusblick.length ? (
        <Card className="p-3">
          <div className="flex items-baseline gap-2">
            <h3 className="text-[13px] font-semibold text-white">Reiseplan</h3>
            <span className="text-[11.5px] text-slate-500">die nächsten {plural(planAusblick.length, 'Tag', 'Tage')}</span>
            <Link href={`/t/${tripId}/tage`} className="ml-auto text-[11.5px] text-slate-400 underline-offset-2 hover:text-white hover:underline">
              ganzer Plan →
            </Link>
          </div>
          <ul className="mt-1.5 space-y-2.5">
            {planAusblick.map((d, i) => {
              const night = stayOn(bundle.hotels, d.date);
              const change = changes.find((c) => c.date === d.date);
              return (
                <li key={d.date}>
                  <Link href={`/t/${tripId}/tage#${d.date}`} className="block">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[12.5px] font-semibold text-white">{i === 0 ? 'Morgen' : fmtDate(d.date, { weekday: 'long' })}</span>
                      <span className="text-[11px] text-slate-500">{fmtDate(d.date, { day: '2-digit', month: '2-digit' })}</span>
                      <span className="ml-auto text-[11px] text-slate-500">{d.places.length ? `${plural(d.places.length, 'Punkt', 'Punkte')} · ${d.hours.toFixed(1)} h` : 'frei'}</span>
                    </div>
                    {d.places.length ? (
                      <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-slate-300">{d.places.slice(0, 4).map((x) => `${x.start_time ? `${x.start_time} ` : ''}${x.name}`).join(' · ')}</p>
                    ) : null}
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-slate-500">
                      <span aria-hidden>📍</span>
                      <span>{d.cities.join(' / ') || night?.city || 'ohne Ort'}</span>
                      {change ? <span className="text-shu-200">🔀 {change.from} → {change.to}</span> : null}
                      {!night ? <span className="text-amber-200/70">🏨 Nacht ohne Bett</span> : null}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {/* Fußzeile: der nächste Griff, ohne zu scrollen */}
      {next ? (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-xl px-3 pb-3">
          <Card className="flex items-center gap-2.5 bg-ink-800/95 p-2.5 shadow-[0_-8px_30px_rgba(0,0,0,0.5)] backdrop-blur">
            <CategoryDot category={next.place.category} size={22} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-white">
                {next.laeuft ? 'läuft gerade · ' : ''}
                {next.place.name}
              </p>
              <p className="truncate text-[11.5px] text-slate-400">
                {next.place.start_time ?? 'ohne Zeit'} · {next.place.city}
                {next.place.travel_time ? ` · 🚶 ${next.place.travel_time}` : ''}
              </p>
            </div>
            <a href={mapsUrl(next.place)} target="_blank" rel="noreferrer" className="btn-ghost !px-2 !py-1 !text-[12px]">
              🗺️
            </a>
            <button className="btn-primary !px-2.5 !py-1 !text-[12px]" onClick={() => toggle(next.place)} title="erledigt abhaken">
              ✓
            </button>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function LiveRow({ place, expanded, onExpand, onToggle, onEdit }: { place: Place; expanded: boolean; onExpand: () => void; onToggle: () => void; onEdit: () => void }) {
  const done = place.booking_status === 'erledigt';
  const meta = categoryMeta(place.category);
  const ticket = place.ticket_status && place.ticket_status !== 'unklar' && place.ticket_status !== 'keins' ? TICKET_META[place.ticket_status] : null;
  const win = windowsOf([place])[0]?.win;
  return (
    <li className={cx('px-2.5 py-2.5 transition', done && 'bg-emerald-400/[0.05]')}>
      <div className="flex items-start gap-2.5">
        <button
          onClick={onToggle}
          className={cx(
            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[14px] transition',
            done ? 'border-emerald-400/50 bg-emerald-400/20 text-emerald-200' : 'border-white/20 text-transparent hover:border-white/40 hover:text-white/40 active:text-white/60',
          )}
          title={done ? 'wieder offen' : 'erledigt'}
          aria-label={done ? 'wieder offen' : 'erledigt'}
        >
          ✓
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className={cx('text-[13.5px] font-semibold tabular-nums', done ? 'text-slate-500' : 'text-white')}>
              {place.start_time ?? (place.time_slot ? 'ca.' : '—')}
              {win && place.start_time ? <span className="ml-1 text-[11.5px] font-normal text-slate-500">–{minToTime(win.end)}</span> : null}
            </span>
            <span className={cx('min-w-0 flex-1 text-[15px] font-medium leading-snug', done ? 'text-slate-500 line-through' : 'text-white')}>{place.name}</span>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-slate-400">
            <CategoryDot category={place.category} size={17} />
            <span>{meta.label}</span>
            {place.duration_min ? <span>· ⏱ {fmtDuration(place.duration_min)}</span> : null}
            {place.travel_time ? <span>· 🚶 {place.travel_time}</span> : null}
            {place.district ? <span>· {place.district}</span> : null}
            {ticket ? (
              <span className={cx('chip', place.ticket_status === 'gekauft' ? 'bg-emerald-500/15 text-emerald-100' : 'bg-amber-500/15 text-amber-100')}>{ticket.short}</span>
            ) : null}
          </p>
          {expanded && (place.notes || place.price_note || place.ticket_note) ? (
            <div className="mt-1.5 space-y-1 rounded-xl bg-black/25 p-2.5 text-[12.5px] leading-relaxed text-slate-300">
              {place.notes ? <p>{place.notes}</p> : null}
              {place.ticket_note ? <p>🎫 {place.ticket_note}</p> : null}
              {place.price_note || place.price_eur ? <p className="text-slate-400">💶 {place.price_eur ? `${place.price_eur} €` : place.price_note}</p> : null}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <a href={mapsUrl(place)} target="_blank" rel="noreferrer" className="btn-ghost !px-2 !py-1 !text-[12px]" title="In Google Maps öffnen (Route, Fahrplan, Umgebung)">
            🗺️
          </a>
          {place.notes ? (
            <button className="btn-quiet !px-2 !py-0.5 !text-[11px] normal-case tracking-normal" onClick={onExpand} title="Hinweise und Preis">
              {expanded ? 'zu' : `${(place.notes ?? '').split(/\s+/).slice(0, 2).join(' ')}…`}
            </button>
          ) : null}
          <button className="icon-btn !text-[11.5px] text-slate-500" onClick={onEdit} title="Bearbeiten (Planungsseite)">
            ✎
          </button>
        </div>
      </div>
    </li>
  );
}

/* ════════════════════════════ PLANUNG (nicht gestartet) ═══════════════════ */

function PlanungsTag({ bundle, day, iso, days, changes, open, store, tripId, ctx }: Shared) {
  const trip = bundle.trip!;
  const buckets = dayBuckets(day?.places ?? []);
  const nextDays = upcoming(days, iso, 6);
  const stay = stayOn(bundle.hotels, iso);
  const changeToday = changes.find((c) => c.date === iso) ?? null;
  const upcomingChanges = changes.filter((c) => c.date > iso).slice(0, 3);
  const pool = bundle.places.filter((p) => !p.date);
  const state = ctx?.state ?? 'vorher';
  const isLiveDay = state === 'live' && day;
  const done = (day?.places ?? []).filter((p) => p.booking_status === 'erledigt').length;
  const minutes = day ? plannedMinutes(day.places) : 0;
  const ohneZeit = (day?.places ?? []).filter((p) => !p.start_time);
  const toggle = (p: Place) => store.patch('places', p.id, { booking_status: p.booking_status === 'erledigt' ? 'offen' : 'erledigt' });

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Heute"
        icon="☀️"
        hint={
          isLiveDay
            ? `Tag ${ctx?.dayIndex} von ${ctx?.totalDays}${day?.cities.length ? ` · ${day.cities.join(' / ')}` : ''}${stay ? ` · 🏨 ${stay.name}` : ' · 🏨 Nacht ohne Bett'}`
            : state === 'nachher'
              ? 'die Reise liegt hinter dir'
              : ctx?.daysToStart
                ? `Start in ${plural(ctx.daysToStart, 'Tag', 'Tagen')}`
                : 'noch kein Reisezeitraum'
        }
        right={
          <Button variant="primary" size="sm" onClick={() => startTrip(store, bundle)} title={startHint({ ...bundle })}>
            ▶️ Reise starten
          </Button>
        }
      />

      {state !== 'live' ? (
        <Card className="p-4">
          <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
            <div className="min-w-[15rem] flex-1">
              <h3 className="text-[14px] font-semibold text-white">{state === 'nachher' ? 'Vorbei' : 'Noch nicht gestartet'}</h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-slate-400">
                {state === 'nachher' ? (
                  <>
                    Der letzte Tag war {fmtDate(trip.end_date, { day: '2-digit', month: 'long', year: 'numeric' })}. Nachlesen und nachrechnen lässt sich alles in der{' '}
                    <Link className="underline underline-offset-2 hover:text-white" href={`/t/${tripId}/uebersicht`}>
                      Übersicht
                    </Link>
                    .
                  </>
                ) : trip.start_date ? (
                  <>
                    Diese Reise ist für {fmtDate(trip.start_date, { day: '2-digit', month: 'long', year: 'numeric' })} geplant.{' '}
                    <span className="text-slate-200">▶️ Reise starten</span> {startHint({ ...bundle })} – der Unterwegs-Bildschirm zeigt dann Tag für Tag Ort, Route, Hinweise und zum Abhaken.
                  </>
                ) : (
                  <>Für diese Reise steht noch kein Zeitraum. Mit Start- und Enddatum erscheinen hier der heutige Tag und die Tage danach.</>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {state === 'vorher' && trip.start_date ? (
                <Link href={`/t/${tripId}/tage#${trip.start_date}`} className="btn-ghost !px-2 !py-1 !text-[12px]">
                  Tag 1 ansehen
                </Link>
              ) : null}
              {state === 'vorher' && !trip.start_date ? (
                <Button variant="quiet" size="sm" onClick={() => open({ kind: 'trip', id: tripId })}>
                  ✎ Zeitraum setzen
                </Button>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      {isLiveDay || state === 'nachher' ? null : (
        <Card className="p-3">
          <p className="text-[12.5px] text-slate-400">
            Vorschau auf den heutigen Tag – {day?.places.length ? plural(day.places.length, 'Punkt', 'Punkte') : 'nichts'} eingetragen. Starten für die große Unterwegs-Ansicht.
          </p>
        </Card>
      )}

      {changeToday ? (
        <Card className="overflow-hidden p-0">
          <ChangeStrip date={changeToday.date} from={changeToday.from ?? '—'} to={changeToday.to} fromHotel={changeToday.fromHotel} toHotel={changeToday.toHotel} daysInOld={changeToday.daysInOld} onOpen={() => open({ kind: 'move', date: changeToday.date })} />
        </Card>
      ) : null}

      {day?.places.length ? (
        <Card className="p-3.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-slate-300">
            <span className="text-[15px] font-semibold text-white">{fmtDate(iso, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            <span className={cx('chip', done === day.places.length && day.places.length ? 'bg-emerald-500/15 text-emerald-100' : 'bg-white/[0.06]')}>
              {done} von {day.places.length} erledigt
            </span>
            <span className="text-slate-400">{fmtDuration(minutes * 60)} verplant</span>
            {ohneZeit.length ? <span className="text-amber-200/80">{plural(ohneZeit.length, 'Punkt', 'Punkte')} ohne Uhrzeit</span> : null}
          </div>
          <div className="mt-2">
            <ProgressBar value={done} max={day.places.length} tone="matcha" />
          </div>
          <div className="mt-2.5 space-y-2">
            {DAY_SLOTS.filter((key) => buckets[key].length).map((key) => (
              <div key={key}>
                <p className="mb-1 text-[11.5px] uppercase tracking-wide text-slate-500">
                  {slotIcon[key]} {slotLabel[key]}
                </p>
                <ul className="space-y-1.5">
                  {buckets[key].map((p) => (
                    <li key={p.id} className={cx('flex items-center gap-2.5 rounded-xl bg-black/20 px-2.5 py-1.5', p.booking_status === 'erledigt' && 'opacity-60')}>
                      <button onClick={() => toggle(p)} className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/15 text-[10px] text-transparent hover:text-white/50" title={p.booking_status === 'erledigt' ? 'wieder offen' : 'erledigt'}>
                        ✓
                      </button>
                      <span className="w-[3rem] shrink-0 text-[12px] tabular-nums text-slate-400">{p.start_time ?? '—'}</span>
                      <CategoryDot category={p.category} size={19} />
                      <button onClick={() => open({ kind: 'place', id: p.id })} className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-[13px] font-medium text-white">{p.name}</span>
                        <span className="block truncate text-[11px] text-slate-500">{[p.city, p.district, p.travel_time].filter(Boolean).join(' · ')}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <Empty
          title="Heute steht noch nichts im Plan"
          hint={pool.length ? `${pool.length} Punkte warten noch auf einen Tag – der oberste kann direkt hierher.` : 'Leg einen Punkt an oder zieh ihn auf der Tagesseite in den Tag.'}
          action={
            <div className="flex flex-wrap justify-center gap-1.5">
              <Button variant="primary" size="sm" onClick={() => open({ kind: 'place', defaults: { date: iso } })}>
                ＋ Aktivität für heute
              </Button>
              {pool.length ? (
                <Button
                  size="sm"
                  onClick={() => {
                    const candidate = pool.find((p) => p.city === day?.cities[0]) ?? pool[0];
                    if (candidate) assign(store, bundle.places, candidate, { date: iso });
                  }}
                >
                  ✨ nächsten Wunsch hierher
                </Button>
              ) : null}
            </div>
          }
        />
      )}

      {nextDays.length ? (
        <section>
          <div className="mb-1.5 flex items-baseline gap-2">
            <h2 className="text-[13.5px] font-semibold text-white">Die nächsten Tage</h2>
            <span className="text-[11.5px] text-slate-500">morgen bis {fmtDate(addDays(iso, Math.min(nextDays.length, 6)), { day: '2-digit', month: '2-digit' })}</span>
            <Link href={`/t/${tripId}/tage`} className="ml-auto text-[11.5px] text-slate-400 underline-offset-2 hover:text-white hover:underline">
              ganzer Tagesplan →
            </Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {nextDays.map((d, i) => {
              const change = changes.find((c) => c.date === d.date);
              const night = stayOn(bundle.hotels, d.date);
              return (
                <Link key={d.date} href={`/t/${tripId}/tage#${d.date}`} className="group">
                  <Card className={cx('h-full p-2.5 transition group-hover:border-white/20', change && 'border-shu-400/30')}>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[13px] font-semibold text-white">{i === 0 ? 'Morgen' : fmtDate(d.date, { weekday: 'short' })}</span>
                      <span className="text-[11.5px] text-slate-500">{fmtDate(d.date, { day: '2-digit', month: '2-digit' })}</span>
                      <span className="ml-auto text-[11.5px] tabular-nums text-slate-400">{d.places.length ? `${d.hours.toFixed(1)} h` : '—'}</span>
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-slate-400">
                      {d.cities.length ? d.cities.join(' / ') : night?.city ?? 'ohne Ort'}
                      {d.places.length ? ` · ${plural(d.places.length, 'Aktivität', 'Aktivitäten')}` : ' · noch frei'}
                    </p>
                    {d.places.length ? <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-slate-300">{d.places.slice(0, 3).map((p) => `${p.start_time ? `${p.start_time} ` : ''}${p.name}`).join(' · ')}</p> : null}
                    {change ? (
                      <p className="mt-1.5 text-[11.5px] text-shu-200">
                        🔀 {change.from} → {change.to}
                      </p>
                    ) : null}
                    {!night ? <p className="mt-1.5 text-[11px] text-amber-200/70">🏨 Nacht ohne Bett</p> : null}
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {upcomingChanges.length ? (
        <Card className="p-3">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-[13px] font-semibold text-white">🔀 Ortswechsel stehen an</h3>
            <span className="text-[11.5px] text-slate-500">{plural(upcomingChanges.length, 'Umzug', 'Umzüge')} in den nächsten {nextDays.length} Tagen</span>
          </div>
          <ul className="space-y-1.5">
            {upcomingChanges.map((c) => (
              <li key={c.date} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-black/20 px-2.5 py-1.5 text-[12.5px]">
                <span className="font-medium tabular-nums text-white">{fmtDate(c.date, { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
                <span className="text-slate-300">
                  {c.from} → {c.to}
                </span>
                <span className="text-slate-500">{c.toHotel ? `🏨 ${c.toHotel}` : `⚠️ 🏨 noch ohne ${c.to}`}</span>
                {c.journey ? <Pill className="ring-white/10">{c.journey.mode ?? 'Fahrt'}</Pill> : <Pill className="bg-amber-500/10 text-amber-100 ring-amber-400/20">Fahrt fehlt</Pill>}
                <button className="btn-quiet ml-auto !px-2 !py-0.5 !text-[11.5px] normal-case tracking-normal" onClick={() => open({ kind: 'move', date: c.date })}>
                  eintragen
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
