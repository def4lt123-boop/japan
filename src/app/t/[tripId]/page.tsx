'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useStore } from '../../../lib/store';
import { useEditor } from '../../../components/EditorProvider';
import { Button, Card, Empty, Money, ProgressBar, SectionTitle, Stat, cx } from '../../../components/ui';
import { costsOf, dayPlan, emptyDays, nightCoverage, nightsBooked } from '../../../lib/stats';
import { fmtDate, fmtDuration, fmtMoney, plural } from '../../../lib/format';
import { STATUS_META, categoryMeta } from '../../../lib/categories';

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
  const days = dayPlan(bundle);
  const planned = bundle.places.filter((p) => p.date);
  const pool = bundle.places.filter((p) => !p.date);
  const hoursTotal = planned.reduce((a, p) => a + (p.duration_min ?? 0), 0) / 60;
  const gaps = nightCoverage(bundle).filter((n) => !n.covered);
  const openMusts = bundle.places.filter((p) => p.booking_status === 'offen' && p.priority === 'muss');
  const openJourneys = bundle.journeys.filter((j) => j.booking_status !== 'gebucht' && j.mode === 'Flug');
  const quietDays = emptyDays(bundle);
  const bookedPct = bundle.places.length ? Math.round((bundle.places.filter((p) => p.booking_status === 'gebucht' || p.booking_status === 'erledigt').length / bundle.places.length) * 100) : 0;
  const maxCityPlaces = Math.max(1, ...costs.byCity.map((c) => c.places));

  return (
    <div className="space-y-5">
      {trip.notes ? (
        <Card className="border-shu-400/25 bg-shu-500/[0.07] px-4 py-3 text-[13px] leading-relaxed text-shu-50">
          <b className="mr-1">Notiz zur Reise:</b>
          {trip.notes}
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Reisedauer" value={days.length ? plural(days.length, 'Tag', 'Tage') : '—'} hint={fmtDate(trip.start_date, { day: '2-digit', month: 'short' })} />
        <Stat label="Orte geplant" value={planned.length} hint={pool.length ? `${pool.length} in der Wünscheliste` : 'Pool leer'} tone={pool.length ? 'warn' : 'good'} />
        <Stat label="Programm" value={`${hoursTotal.toFixed(0)} h`} hint={days.length ? `≈ ${(hoursTotal / Math.max(1, days.length)).toFixed(1)} h pro Tag` : undefined} />
        <Stat label="Nächte gebucht" value={`${nightsBooked(bundle)}/${days.length ? Math.max(0, days.length - 1) : '?'}`} hint={gaps.length ? `${plural(gaps.length, 'Lücke', 'Lücken')} im Plan` : 'jede Nacht hat ein Hotel'} tone={gaps.length ? 'bad' : 'good'} />
        <Stat label="Kosten" value={fmtMoney(costs.total)} hint={trip.budget_eur ? `${Math.round((costs.total / trip.budget_eur) * 100)} % vom Budget` : 'kein Budget gesetzt'} tone={trip.budget_eur && costs.total > trip.budget_eur ? 'bad' : undefined} />
        <Stat label="Buchungsstand" value={`${bookedPct} %`} hint={plural(openMusts.length, 'Muss-Punkt', 'Muss-Punkte') + ' offen'} tone={bookedPct > 80 ? 'good' : undefined} />
      </div>

      {trip.budget_eur ? (
        <Card className="p-4">
          <SectionTitle
            title="Budget"
            hint={`${fmtMoney(costs.total)} verplant von ${fmtMoney(trip.budget_eur)} · ${fmtMoney(costs.perPerson)} pro Person (${plural(trip.travelers, 'Reisender', 'Reisende')})`}
            right={<span className={cx('chip', costs.total > trip.budget_eur ? 'bg-shu-500/15 text-shu-200 ring-shu-400/30' : 'bg-emerald-500/10 text-emerald-200 ring-emerald-400/30')}>{costs.total > trip.budget_eur ? `${fmtMoney(costs.total - trip.budget_eur)} über Budget` : `${fmtMoney(trip.budget_eur - costs.total)} frei`}</span>}
          />
          <ProgressBar value={costs.total} max={trip.budget_eur} />
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {costs.byCategory.map((c) => (
              <div key={c.label} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12.5px] text-slate-300">{c.label}</span>
                  <Money value={c.value} className="text-[13px] font-semibold" />
                </div>
                <div className="mt-1.5">
                  <ProgressBar value={c.value} max={Math.max(1, costs.total)} />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{plural(c.count, 'Eintrag', 'Einträge')}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Card className="p-4">
          <SectionTitle
            title="Offene Punkte"
            icon="📌"
            hint={openMusts.length || openJourneys.length || gaps.length ? 'Das sollte vor der Reise erledigt sein.' : 'Nichts Offenes – gut vorbereitet.'}
            right={
              <Button size="sm" variant="ghost" onClick={() => open({ kind: 'place' })}>
                ＋ Punkt anlegen
              </Button>
            }
          />
          {!openMusts.length && !openJourneys.length && !gaps.length ? (
            <Empty title="Keine offenen Muss-Punkte 🎉" hint="Sobald Einträge den Status „offen“ haben, erscheinen sie hier." />
          ) : (
            <ul className="space-y-1.5">
              {gaps.length ? (
                <li className="rounded-lg border border-shu-500/30 bg-shu-500/[0.08] px-3 py-2 text-[13px]">
                  <b className="text-shu-100">🏨 {plural(gaps.length, 'Nacht', 'Nächte')} ohne Unterkunft</b>
                  <p className="mt-0.5 text-[12px] text-slate-300">
                    {gaps
                      .slice(0, 6)
                      .map((g) => fmtDate(g.date, { day: '2-digit', month: '2-digit' }))
                      .join(', ')}
                    {gaps.length > 6 ? ` … und ${gaps.length - 6} weitere` : ''}
                  </p>
                  <Link href={`/t/${tripId}/unterkuenfte`} className="mt-1 inline-block text-[12px] font-medium text-shu-200 underline-offset-2 hover:underline">
                    → Unterkünfte prüfen
                  </Link>
                </li>
              ) : null}
              {openMusts.map((p) => (
                <li key={p.id}>
                  <button onClick={() => open({ kind: 'place', id: p.id })} className="flex w-full items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-left transition hover:border-white/20 hover:bg-white/[0.05]">
                    <span aria-hidden>{categoryMeta(p.category).icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-slate-100">{p.name}</span>
                      <span className="block text-[11.5px] text-slate-500">
                        {p.city}
                        {p.date ? ` · ${fmtDate(p.date, { day: '2-digit', month: 'short' })}` : ' · noch ohne Tag'}
                        {p.price_eur ? ` · ${fmtMoney(p.price_eur)}` : ''}
                      </span>
                    </span>
                    <span className="chip bg-shu-500/15 text-shu-200 ring-shu-400/30">★ Muss</span>
                  </button>
                </li>
              ))}
              {openJourneys.map((j) => (
                <li key={j.id}>
                  <button onClick={() => open({ kind: 'journey', id: j.id })} className="flex w-full items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-left transition hover:border-white/20 hover:bg-white/[0.05]">
                    <span aria-hidden>✈️</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-slate-100">{j.title}</span>
                      <span className="block text-[11.5px] text-slate-500">Flug · {j.date ? fmtDate(j.date, { day: '2-digit', month: 'short', year: 'numeric' }) : 'ohne Datum'}</span>
                    </span>
                    <span className="chip bg-amber-500/10 text-amber-200 ring-amber-400/30">{STATUS_META[j.booking_status].label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionTitle title="Stationen" icon="📍" hint="Wie viele Orte du pro Stadt eingeplant hast" />
            <ul className="space-y-1.5">
              {costs.byCity.map((c) => (
                <li key={c.city} className="grid grid-cols-[92px_1fr_auto] items-center gap-2 text-[12.5px]">
                  <span className="truncate text-slate-300">{c.city}</span>
                  <span className="h-2 rounded-full bg-white/[0.06]">
                    <span className="block h-full rounded-full bg-shu-400/80" style={{ width: `${Math.max(4, (c.places / maxCityPlaces) * 100)}%` }} />
                  </span>
                  <span className="tabular-nums text-slate-400">
                    {c.places} · {c.hours.toFixed(0)} h {c.cost ? `· ${fmtMoney(c.cost)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
            <Link href={`/t/${tripId}/karte`} className="btn-ghost mt-3 w-full">
              🗺️ Auf der Karte ansehen
            </Link>
          </Card>

          <Card className="p-4">
            <SectionTitle title="Unterkünfte" icon="🏨" hint={`${plural(bundle.hotels.length, 'Eintrag', 'Einträge')} · ${fmtMoney(costs.accommodation)}`} right={<Button size="sm" variant="ghost" onClick={() => open({ kind: 'hotel' })}>＋</Button>} />
            {!bundle.hotels.length ? (
              <Empty title="Noch keine Unterkunft" hint="Nächte + Preis anlegen – das füllt das Budget automatisch." />
            ) : (
              <ul className="space-y-1.5">
                {bundle.hotels
                  .slice()
                  .sort((a, b) => (a.check_in ?? '').localeCompare(b.check_in ?? ''))
                  .map((h) => (
                    <li key={h.id}>
                      <button onClick={() => open({ kind: 'hotel', id: h.id })} className="flex w-full items-center gap-2 rounded-lg border border-white/[0.07] px-2.5 py-1.5 text-left text-[12.5px] hover:bg-white/[0.04]">
                        <span className="min-w-0 flex-1 truncate text-slate-200">{h.name}</span>
                        <span className="whitespace-nowrap text-slate-500">
                          {h.city} · {h.nights ?? '?'} N
                        </span>
                        <Money value={h.price_total_eur} className="text-[12px]" />
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card className="p-4">
        <SectionTitle
          title="Tag für Tag"
          icon="🗓️"
          hint={quietDays.length ? `${plural(quietDays.length, 'Tag', 'Tage')} noch ohne Programm – die Vorschläge unten helfen beim Auffüllen.` : 'Jeder Tag hat Programm.'}
          right={
            <Link href={`/t/${tripId}/tage`} className="btn-ghost">
              Tage planen →
            </Link>
          }
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map((d) => (
            <Link
              key={d.date}
              href={`/t/${tripId}/tage#${d.date}`}
              className={cx(
                'print-block w-[168px] shrink-0 rounded-xl border px-2.5 py-2 transition hover:border-white/25',
                d.places.length ? 'border-white/[0.09] bg-white/[0.03]' : 'border-dashed border-white/[0.12] bg-transparent',
              )}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">{fmtDate(d.date, { weekday: 'short' })}</span>
                <span className="text-[12px] tabular-nums text-slate-300">{fmtDate(d.date, { day: '2-digit', month: '2-digit' })}</span>
              </div>
              <div className="mt-1 truncate text-[12px] text-shu-200">{d.cities[0] ?? d.journeys[0]?.to_city ?? '—'}</div>
              <div className="mt-1.5 space-y-0.5">
                {d.places.slice(0, 3).map((p) => (
                  <div key={p.id} className="truncate text-[11.5px] text-slate-400">
                    {categoryMeta(p.category).icon} {p.name}
                  </div>
                ))}
                {d.places.length > 3 ? <div className="text-[11px] text-slate-500">+{d.places.length - 3} weitere</div> : null}
                {!d.places.length ? <div className="text-[11.5px] text-slate-500">{d.journeys[0]?.title ?? 'frei'}</div> : null}
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                <span>{plural(d.places.length, 'Ort', 'Orte')}</span>
                <span>{d.hours ? fmtDuration(d.hours * 60) : ''}</span>
              </div>
            </Link>
          ))}
          {!days.length ? <Empty title="Kein Zeitraum gesetzt" hint="⚙ Reise bearbeiten → Start- und Enddatum eintragen, dann erscheinen die Tage hier." /> : null}
        </div>
      </Card>
    </div>
  );
}
