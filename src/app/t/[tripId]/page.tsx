'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useStore } from '../../../lib/store';
import { useEditor } from '../../../components/EditorProvider';
import { Button, Card, Empty, Money, ProgressBar, SectionTitle, Stat, cx } from '../../../components/ui';
import { CapacityPanel, DayBoard, GapPanel, TripRibbon } from '../../../components/overview';
import { costsOf, nightsBooked } from '../../../lib/stats';
import { capacity, cityLoad, dayCells, gapList, staysOf } from '../../../lib/overview';
import { fmtDate, fmtDuration, fmtMoney, fmtRange, plural } from '../../../lib/format';
import { STATUS_META } from '../../../lib/categories';

export default function OverviewPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = String(params?.tripId ?? '');
  const store = useStore();
  const { open } = useEditor();
  const trip = store.trips.find((t) => t.id === tripId);
  const bundle = {
    trip: trip!,
    places: store.places.filter((p) => p.trip_id === tripId),
    hotels: store.hotels.filter((h) => h.trip_id === tripId),
    journeys: store.journeys.filter((j) => j.trip_id === tripId),
    expenses: store.expenses.filter((e) => e.trip_id === tripId),
  };
  if (!trip) return null;

  const costs = costsOf(bundle);
  const cells = dayCells(bundle);
  const stays = staysOf(bundle);
  const gaps = gapList(bundle);
  const pool = bundle.places.filter((p) => !p.date);
  const cap = capacity(cells);
  const cities = cityLoad(bundle);
  const openBookings = [
    ...bundle.hotels.filter((h) => h.booking_status === 'offen' || h.booking_status === 'reserviert').map((h) => ({ id: h.id, kind: 'hotel' as const, label: h.name, sub: `${h.city} · ${fmtRange(h.check_in, h.check_out)}`, price: h.price_total_eur, url: h.booking_url })),
    ...bundle.journeys.filter((j) => j.booking_status === 'offen').map((j) => ({ id: j.id, kind: 'journey' as const, label: j.title, sub: `${j.date ? fmtDate(j.date, { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'ohne Datum'} · ${j.departure_time ?? 'Uhrzeit offen'}`, price: j.price_eur, url: null })),
    ...bundle.places.filter((p) => p.priority === 'muss' && p.booking_status === 'offen' && p.date).map((p) => ({ id: p.id, kind: 'place' as const, label: p.name, sub: `${p.city || '—'} · ${fmtDate(p.date, { weekday: 'short', day: '2-digit', month: '2-digit' })}`, price: p.price_eur, url: p.booking_url })),
  ];
  const nightList = cells.filter((c) => c.nightGap);
  const planned = bundle.places.filter((p) => p.date);
  const hoursTotal = planned.reduce((a, p) => a + (p.duration_min ?? 0), 0) / 60;

  return (
    <div className="space-y-4">
      {trip.notes ? (
        <Card className="border-shu-400/25 bg-shu-500/[0.07] px-4 py-2.5 text-[12.5px] leading-relaxed text-shu-50">
          <b className="mr-1">Notiz:</b>
          {trip.notes}
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Reisedauer" value={cells.length ? plural(cells.length, 'Tag', 'Tage') : '—'} hint={fmtRange(trip.start_date, trip.end_date)} />
        <Stat
          label="Programm"
          value={cap.avgDayMin ? `${(cap.avgDayMin / 60).toFixed(1)} h/Tag` : '—'}
          hint={hoursTotal ? `${hoursTotal.toFixed(0)} h gesamt · ${fmtDuration(cap.totalFreeMin)} Luft` : 'noch nichts mit Dauer'}
          tone={cap.avgDayMin > 8 * 60 ? 'bad' : undefined}
        />
        <Stat
          label="Nächte mit Bett"
          value={`${nightsBooked(bundle)}/${Math.max(0, cells.length - 1)}`}
          hint={nightList.length ? `${plural(nightList.length, 'Lücke', 'Lücken')}:${nightList[0].date.slice(8)}.${nightList[0].date.slice(5, 7)}.` : 'jede Nacht abgedeckt'}
          tone={nightList.length ? 'bad' : 'good'}
        />
        <Stat
          label="Offene Wünsche"
          value={pool.length}
          hint={pool.length ? `${plural(pool.filter((p) => p.priority === 'muss').length, 'Muss-Punkt', 'Muss-Punkte')} davon Muss` : 'alles verplant'}
          tone={pool.length ? 'warn' : 'good'}
        />
        <Stat
          label="Kosten"
          value={fmtMoney(costs.total)}
          hint={trip.budget_eur ? `${Math.round((costs.total / trip.budget_eur) * 100)} % von ${fmtMoney(trip.budget_eur)}` : 'kein Budget gesetzt'}
          tone={trip.budget_eur && costs.total > trip.budget_eur ? 'bad' : undefined}
        />
        <Stat label="Unterkünfte" value={stays.length} hint={`${plural(bundle.hotels.length, 'Eintrag', 'Einträge')} · ${fmtMoney(costs.accommodation)}`} />
      </div>

      <TripRibbon tripId={tripId} cells={cells} stays={stays} />

      <DayBoard tripId={tripId} cells={cells} pool={pool} />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <GapPanel tripId={tripId} items={gaps} />

        <div className="space-y-4">
          {trip.budget_eur ? (
            <Card className="p-4">
              <SectionTitle
                title="Budget"
                icon="💸"
                hint={`${fmtMoney(costs.total)} von ${fmtMoney(trip.budget_eur)} · ${fmtMoney(costs.perPerson)} pro Person`}
                right={
                  <span className={cx('chip', costs.total > trip.budget_eur ? 'bg-shu-500/15 text-shu-200 ring-shu-400/30' : 'bg-emerald-500/10 text-emerald-200 ring-emerald-400/30')}>
                    {costs.total > trip.budget_eur ? `${fmtMoney(costs.total - trip.budget_eur)} über` : `${fmtMoney(trip.budget_eur - costs.total)} frei`}
                  </span>
                }
              />
              <ProgressBar value={costs.total} max={trip.budget_eur} />
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {costs.byCategory.map((c) => (
                  <div key={c.label} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[12.5px] text-slate-300">{c.label}</span>
                      <Money value={c.value} className="text-[13px] font-semibold" />
                    </div>
                    <div className="mt-1.5">
                      <ProgressBar value={c.value} max={Math.max(1, costs.total)} />
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">{plural(c.count, 'Eintrag', 'Einträge')}</p>
                  </div>
                ))}
              </div>
              <Link href={`/t/${tripId}/kosten`} className="btn-ghost mt-3 w-full">
                Kosten im Detail →
              </Link>
            </Card>
          ) : (
            <Card className="p-4">
              <SectionTitle title="Budget fehlt noch" icon="💸" hint="Startbetrag setzen – die Übersicht rechnet dann mit Auslastung und Reserver." />
              <Button variant="primary" onClick={() => open({ kind: 'trip', id: tripId })}>
                Budget eintragen
              </Button>
            </Card>
          )}

          <Card className="p-4">
            <SectionTitle
              title="Bett pro Nacht"
              icon="🏨"
              hint={stays.length ? `${plural(stays.length, 'Abschnitt', 'Abschnitte')} · ${nightsBooked(bundle)} Nächte · ${fmtMoney(costs.accommodation)}` : 'Noch keine Unterkünfte'}
              right={
                <Button size="sm" variant="ghost" onClick={() => open({ kind: 'hotel' })}>
                  ＋
                </Button>
              }
            />
            {!stays.length ? (
              <Empty title="Keine Unterkunft geplant" hint="Ein-/Auscheck-Datum genügt – der Balken oben und die Tageskarten füllen sich automatisch." action={<Button size="sm" variant="primary" onClick={() => open({ kind: 'hotel' })}>Unterkunft anlegen</Button>} />
            ) : (
              <ul className="space-y-1.5">
                {stays.map((s) => (
                  <li key={`${s.hotelId ?? s.city}-${s.from}`}>
                    <button onClick={() => (s.hotelId ? open({ kind: 'hotel', id: s.hotelId }) : open({ kind: 'hotel', defaults: { city: s.city, check_in: s.from, check_out: s.to, nights: s.nights } }))} className="flex w-full items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5 text-left transition hover:border-white/20">
                      <span className="grid w-9 shrink-0 place-items-center rounded-md bg-white/[0.05] text-[11px] font-semibold tabular-nums text-slate-300">{s.nights}N</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-slate-100">{s.hotel ?? 'Quartier offen'}</span>
                        <span className="block truncate text-[11px] text-slate-500">
                          {s.city} · {fmtDate(s.from, { day: '2-digit', month: '2-digit' })}–{fmtDate(s.to, { day: '2-digit', month: '2-digit' })}
                          {s.perNight ? ` · ${fmtMoney(s.perNight)}/Nacht` : ''}
                        </span>
                      </span>
                      <Money value={s.price_eur} className="text-[12.5px]" />
                      <span className={cx('chip shrink-0 ring-1', STATUS_META[(s.booking_status as keyof typeof STATUS_META) ?? 'offen']?.color)}>{STATUS_META[(s.booking_status as keyof typeof STATUS_META) ?? 'offen']?.label ?? s.booking_status}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/t/${tripId}/unterkuenfte`} className="btn-ghost mt-2.5 w-full">
              Unterkünfte verwalten →
            </Link>
          </Card>
        </div>
      </div>

      <CapacityPanel tripId={tripId} cells={cells} cities={cities} pool={pool} openBookings={openBookings} />
    </div>
  );
}
