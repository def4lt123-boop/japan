'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useStore, useTrip } from '../../../../lib/store';
import { useEditor } from '../../../../components/EditorProvider';
import { Button, Card, Empty, Pill, ProgressBar, SectionTitle, cx } from '../../../../components/ui';
import { dayContext, DAY_SLOTS, dayBuckets, slotIcon, slotLabel, startToday, upcoming } from '../../../../lib/today';
import { assign, minToTime, plannedMinutes, windowsOf } from '../../../../lib/dayplan';
import { locusChanges, stayOn } from '../../../../lib/locus';
import { ChangeStrip } from '../../../../components/Ortswechsel';
import { CategoryDot } from '../../../../components/CategoryDot';
import { dayPlan } from '../../../../lib/stats';
import { categoryMeta, TICKET_META } from '../../../../lib/categories';
import { addDays, fmtDate, fmtDuration, plural } from '../../../../lib/format';
import { today } from '../../../../lib/format';
import type { Place } from '../../../../lib/types';

/**
 * „Heute" – was ist dran, was kommt. Rechnet mit echten Kalenderdaten:
 * der Tag, den die Uhr anzeigt, ist heute.
 */
export default function TodayPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = String(params?.tripId ?? '');
  const store = useStore();
  const bundle = useTrip(tripId);
  const { open } = useEditor();

  const iso = today();
  const ctx = dayContext(bundle.trip, iso);
  const days = useMemo(() => (bundle.trip ? dayPlan(bundle) : []), [bundle]);
  const day = days.find((d) => d.date === iso) ?? null;
  const buckets = dayBuckets(day?.places ?? []);
  const changes = useMemo(() => locusChanges(bundle.places, bundle.hotels, days.map((d) => d.date), bundle.journeys), [bundle, days]);
  const changeToday = changes.find((c) => c.date === iso) ?? null;
  const upcomingChanges = changes.filter((c) => c.date > iso).slice(0, 3);
  const nextDays = upcoming(days, iso, 6);
  const stay = stayOn(bundle.hotels, iso);
  const pool = bundle.places.filter((p) => !p.date);

  if (!store.ready) return <Card className="p-8 text-center text-sm text-slate-400">lädt …</Card>;
  if (!bundle.trip) return null;

  const done = (day?.places ?? []).filter((p) => p.booking_status === 'erledigt').length;
  const minutes = day ? plannedMinutes(day.places) : 0;
  const ohneZeit = (day?.places ?? []).filter((p) => !p.start_time);
  const state = ctx?.state ?? 'vorher';
  const isLive = state === 'live' && day;

  const spanOf = (list: Place[]) => {
    const w = windowsOf(list);
    if (!w.length) return 'keine Uhrzeit gesetzt';
    const a = w[0].win.start;
    const b = Math.max(...w.map((x) => x.win.end));
    return `${minToTime(a)}–${minToTime(b)} Uhr`;
  };

  const toggle = (p: Place) => store.patch('places', p.id, { booking_status: p.booking_status === 'erledigt' ? 'offen' : 'erledigt' });

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Heute"
        icon="☀️"
        hint={
          isLive
            ? `Tag ${ctx?.dayIndex} von ${ctx?.totalDays}${day?.cities.length ? ` · ${day.cities.join(' / ')}` : ''}${stay ? ` · 🏨 ${stay.name}` : ' · 🏨 Nacht ohne Bett'}`
            : state === 'nachher'
              ? 'die Reise liegt hinter dir'
              : ctx?.daysToStart
                ? `Start in ${plural(ctx.daysToStart, 'Tag', 'Tagen')}`
                : 'noch kein Reisezeitraum'
        }
      />

      {state !== 'live' ? (
        <Card className="p-4">
          <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
            <div className="min-w-[15rem] flex-1">
              <h3 className="text-[14px] font-semibold text-white">
                {state === 'nachher' ? 'Vorbei' : 'Unterwegs ab einem anderen Datum'}
              </h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-slate-400">
                {state === 'nachher' ? (
                  <>
                    Der letzte Tag war {fmtDate(bundle.trip.end_date, { day: '2-digit', month: 'long', year: 'numeric' })}. Nachlesen und nachrechnen lässt sich alles in der{' '}
                    <Link className="underline underline-offset-2 hover:text-white" href={`/t/${tripId}/uebersicht`}>
                      Übersicht
                    </Link>
                    .
                  </>
                ) : bundle.trip.start_date ? (
                  <>
                    Diese Reise ist für {fmtDate(bundle.trip.start_date, { day: '2-digit', month: 'long', year: 'numeric' })} geplant. Sobald du losfährst, schiebt{' '}
                    <span className="text-slate-200">▶️ Heute starten</span> jeden Punkt, jede Nacht und jede Fahrt auf den neuen Kalender – Reihenfolge und Abstände bleiben, wie sie sind.
                  </>
                ) : (
                  <>Für diese Reise steht noch kein Zeitraum. Mit Start- und Enddatum erscheinen hier der heutige Tag und die Tage danach.</>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {state === 'vorher' && bundle.trip.start_date ? (
                <>
                  <Button variant="primary" size="sm" onClick={() => startToday(store, bundle)}>
                    ▶️ Heute starten
                  </Button>
                  <Link href={`/t/${tripId}/tage#${bundle.trip.start_date}`} className="btn-ghost !px-2 !py-1 !text-[12px]">
                    Tag 1 ansehen
                  </Link>
                </>
              ) : null}
              {state === 'vorher' && !bundle.trip.start_date ? (
                <Button variant="primary" size="sm" onClick={() => open({ kind: 'trip', id: tripId })}>
                  ✎ Zeitraum setzen
                </Button>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}

      {isLive ? (
        <>
          {changeToday ? (
            <Card className="overflow-hidden p-0">
              <ChangeStrip date={changeToday.date} from={changeToday.from ?? '—'} to={changeToday.to} fromHotel={changeToday.fromHotel} toHotel={changeToday.toHotel} daysInOld={changeToday.daysInOld} onOpen={() => open({ kind: 'move', date: changeToday.date })} />
            </Card>
          ) : null}

          <Card className="p-3.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-slate-300">
              <span className="text-[15px] font-semibold text-white">{fmtDate(iso, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
              <span className="chip bg-white/[0.06]">{spanOf(day?.places ?? [])}</span>
              <span className={cx('chip', done === (day?.places.length ?? 0) && day?.places.length ? 'bg-emerald-500/15 text-emerald-100' : 'bg-white/[0.06]')}>
                {done} von {day?.places.length ?? 0} erledigt
              </span>
              <span className="text-slate-400">{fmtDuration(minutes * 60)} verplant</span>
              {ohneZeit.length ? <span className="text-amber-200/80">{plural(ohneZeit.length, 'Punkt', 'Punkte')} ohne Uhrzeit</span> : null}
              {!stay ? (
                <Link href={`/t/${tripId}/unterkuenfte`} className="ml-auto text-shu-200 underline-offset-2 hover:underline">
                  🏨 Nacht ohne Bett – Unterkunft wählen
                </Link>
              ) : (
                <span className="ml-auto text-slate-500">🛏 {stay.name}</span>
              )}
            </div>
            {day?.places.length ? (
              <div className="mt-2">
                <ProgressBar value={done} max={day.places.length} tone="matcha" />
              </div>
            ) : null}
          </Card>

          {!day.places.length ? (
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
                        const candidate = pool.find((p) => p.city === day.cities[0]) ?? pool[0];
                        if (candidate) assign(store, bundle.places, candidate, { date: iso });
                      }}
                    >
                      ✨ nächsten Wunsch hierher
                    </Button>
                  ) : null}
                </div>
              }
            />
          ) : (
            <div className="space-y-2.5">
              {DAY_SLOTS.filter((key) => buckets[key].length || key !== 'Nacht').map((key) => (
                <Card key={key} className={cx('p-0', !buckets[key].length && 'opacity-70')}>
                  <header className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2">
                    <span aria-hidden>{slotIcon[key]}</span>
                    <h3 className="text-[13px] font-semibold text-white">{slotLabel[key]}</h3>
                    <span className="ml-auto text-[11.5px] text-slate-500">
                      {buckets[key].length ? plural(buckets[key].length, 'Punkt', 'Punkte') : 'frei'}
                    </span>
                    <button className="icon-btn" title={`Aktivität heute ${slotLabel[key].toLowerCase()} anlegen`} onClick={() => open({ kind: 'place', defaults: { date: iso, time_slot: key === 'Ganzer Tag' ? 'Ganzer Tag' : key === 'Nacht' ? 'Nachts' : key } })}>
                      ＋
                    </button>
                  </header>
                  {buckets[key].length ? (
                    <ul className="divide-y divide-white/[0.05]">
                      {buckets[key].map((p) => (
                        <TodayRow key={p.id} place={p} onToggle={() => toggle(p)} onEdit={() => open({ kind: 'place', id: p.id })} />
                      ))}
                    </ul>
                  ) : null}
                </Card>
              ))}
            </div>
          )}
        </>
      ) : null}

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
                <span className="font-medium text-white">{fmtDate(c.date, { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
                <span className="text-slate-300">
                  {c.from} → {c.to}
                </span>
                <span className="text-slate-500">{c.toHotel ? `🏨 ${c.toHotel}` : `⚠️ 🏨 noch ohne ${c.to}`}</span>
                {c.journey ? (
                  <Pill className="ring-white/10">{c.journey.mode ?? 'Fahrt'}{c.journey.departure_time ? ` · ${c.journey.departure_time}` : ''}</Pill>
                ) : (
                  <Pill className="bg-amber-500/10 text-amber-100 ring-amber-400/20">Fahrt fehlt</Pill>
                )}
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

function TodayRow({ place, onToggle, onEdit }: { place: Place; onToggle: () => void; onEdit: () => void }) {
  const meta = categoryMeta(place.category);
  const done = place.booking_status === 'erledigt';
  const ticket = place.ticket_status && place.ticket_status !== 'unklar' && place.ticket_status !== 'keins' ? TICKET_META[place.ticket_status] : null;
  return (
    <li className={cx('flex items-center gap-2.5 px-2.5 py-2 transition', done && 'opacity-60')}>
      <button
        onClick={onToggle}
        className={cx(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[12px] transition',
          done ? 'border-emerald-400/50 bg-emerald-400/20 text-emerald-200' : 'border-white/15 text-transparent hover:border-white/35 hover:text-white/40',
        )}
        title={done ? 'wieder offen' : 'erledigt'}
        aria-label={done ? 'wieder offen' : 'erledigt'}
      >
        ✓
      </button>
      <span className="w-[3.4rem] shrink-0 text-[12px] tabular-nums text-slate-400">{place.start_time ?? (place.time_slot ? 'ca.' : '—')}</span>
      <CategoryDot category={place.category} size={20} className={done ? 'opacity-60 saturate-50' : ''} />
      <button onClick={onEdit} className="min-w-0 flex-1 text-left">
        <span className={cx('block truncate text-[13px] font-medium', done ? 'text-slate-400 line-through' : 'text-white')}>{place.name}</span>
        <span className="block truncate text-[11px] text-slate-500">
          {[place.city, place.district, place.travel_time].filter(Boolean).join(' · ')}
          {place.duration_min ? ` · ${fmtDuration(place.duration_min)}` : ''}
        </span>
      </button>
      {ticket ? (
        <span className="chip shrink-0 bg-white/[0.06] text-slate-300" title={ticket.label}>
          {ticket.short}
        </span>
      ) : null}
      {place.lat === null || place.lat === undefined ? <span className="shrink-0 text-[11px] text-slate-600" title="kein Kartenpunkt">🌍</span> : null}
    </li>
  );
}
