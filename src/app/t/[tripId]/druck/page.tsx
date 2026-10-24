'use client';

/**
 * Tages-Ausdruck – eine Seite pro Tag, reduziert auf das, was auf Papier zählt:
 * die nummerierte Liste, das Bett der Nacht, Adressen und die Links nach Google Maps.
 * Gedruckt oder als PDF gespeichert; die Knöpfe oben bleiben auf dem Bildschirm.
 */
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTrip } from '../../../../lib/store';
import { Button, Card, Empty, Seg, Select, SectionTitle, cx } from '../../../../components/ui';
import { dayPlan, nightCoverage } from '../../../../lib/stats';
import { hotelForDay, mapsLink, routeUrl } from '../../../../lib/maps';
import { categoryMeta, STATUS_META, TICKET_META } from '../../../../lib/categories';
import { fmtDate, fmtDuration, fmtMoney, plural, today, weekdayShort } from '../../../../lib/format';
import { tintFor } from '../../../../lib/palette';
import type { Place } from '../../../../lib/types';

type Scope = 'alle' | 'ab' | 'einer';

/** Link-Text auf Papier: nur die Domain, der Rest bleibt im Klickziel */
function hostOf(url?: string | null) {
  if (!url) return null;
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 32);
  }
}

export default function PrintPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = String(params?.tripId ?? '');
  const bundle = useTrip(tripId);
  const [scope, setScope] = useState<Scope>('alle');
  const [pick, setPick] = useState('');
  const [withPool, setWithPool] = useState(true);

  const plan = useMemo(() => (bundle.trip ? dayPlan({ ...bundle }) : []), [bundle]);
  const beds = useMemo(() => new Map(nightCoverage({ ...bundle }).map((c) => [c.date, c])), [bundle]);
  const pool = bundle.places.filter((p) => !p.date);

  const days = useMemo(() => {
    if (scope === 'einer') return plan.filter((d) => d.date === (pick || plan[0]?.date));
    if (scope === 'ab') {
      const from = plan.findIndex((d) => d.date >= today());
      return from < 0 ? [] : plan.slice(from);
    }
    return plan;
  }, [plan, scope, pick]);

  if (!bundle.trip) {
    return (
      <Card className="p-6 text-center">
        <p className="text-[13px] text-slate-300">Der Ausdruck braucht eine Reise – über die Reisen-Übersicht auswählen.</p>
        <Link className="btn-primary mt-3 inline-flex" href="/">
          zu den Reisen
        </Link>
      </Card>
    );
  }

  const firstIndex = Math.max(0, plan.findIndex((d) => d.date === days[0]?.date));

  return (
    <div className="space-y-4">
      <div className="no-print">
        <SectionTitle
          title="Tages-Ausdruck"
          icon="🖨️"
          hint="Ein Tag pro Seite – zum Drucken oder als PDF. Punkte in Reihenfolge, das Bett der Nacht, Adresse und Maps-Link."
          right={
            <Button variant="primary" size="sm" onClick={() => window.print()}>
              🖨 Drucken · als PDF sichern
            </Button>
          }
        />
        <Card className="flex flex-wrap items-center gap-3 p-3">
          <Seg
            title="Wie viel soll auf Papier?"
            options={[
              { value: 'alle' as Scope, label: 'ganze Reise' },
              { value: 'ab' as Scope, label: 'ab heute' },
              { value: 'einer' as Scope, label: 'nur ein Tag' },
            ]}
            value={scope}
            onChange={setScope}
          />
          {scope === 'einer' ? (
            <label className="flex items-center gap-2 text-[12px] text-slate-400">
              Tag
              <Select
                className="!w-auto"
                value={pick || plan[0]?.date || ''}
                onChange={(e) => setPick(e.target.value)}
                options={plan.map((d, n) => ({
                  value: d.date,
                  label: `Tag ${n + 1} · ${weekdayShort(d.date)} ${fmtDate(d.date, { day: '2-digit', month: '2-digit' })}`,
                }))}
              />
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-[12px] text-slate-400">
            <input type="checkbox" checked={withPool} onChange={(e) => setWithPool(e.target.checked)} className="h-4 w-4 accent-emerald-400" />
            Wünsche ohne Tag anhängen
          </label>
          <span className="ml-auto text-[12px] text-slate-500">
            {days.length ? `${plural(days.length, 'Seite', 'Seiten')} · ${plural(days.reduce((n, d) => n + d.places.length, 0), 'Punkt', 'Punkte')}` : 'kein Tag im ausgewählten Rahmen'}
          </span>
        </Card>
      </div>

      {days.length === 0 ? (
        <Empty title="Nichts zu drucken" hint="Sobald ein Zeitraum feststeht, erscheint hier ein Tag pro Seite." />
      ) : (
        <div className="space-y-3">
          <div className="paper print-block px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <h1 className="text-[17px] font-semibold tracking-tight">{bundle.trip.name}</h1>
              <span className="text-[12px] text-neutral-500">
                {fmtDate(bundle.trip.start_date)} – {fmtDate(bundle.trip.end_date)}
                {bundle.trip.travelers > 1 ? ` · ${bundle.trip.travelers} Personen` : ''}
              </span>
            </div>
            <p className="mt-0.5 text-[11.5px] text-neutral-500">
              {[bundle.trip.destination, days.length ? `${plural(days.length, 'Tag', 'Tage')} im Ausdruck` : null].filter(Boolean).join(' · ')}
            </p>
          </div>

          {days.map((day, i) => {
            // gezählt wird, was der Nächte-Check weiß – sonst zeigt das Blatt ein Bett,
            // das in der Liste der Reise nirgends auftaucht
            const night = beds.get(day.date) ?? null;
            const hotel = night
              ? night.hotelId
                ? (bundle.hotels.find((h) => h.id === night.hotelId) ?? null)
                : null
              : hotelForDay(bundle.hotels, day.date);
            const noBed = night ? !night.covered : false;
            const stops = day.places.filter((p) => p.lat !== null && p.lng !== null);
            const route =
              stops.length > 1
                ? routeUrl({ origin: stops[0], destination: stops[stops.length - 1], stops: stops.slice(1, -1) })
                : null;
            const tint = tintFor(night?.hotelId ?? hotel?.id ?? null, i);
            return (
              <section
                key={day.date}
                className="paper print-page px-4 py-3.5"
                style={{ boxShadow: `inset 3px 0 0 ${tint.base}` }}
                data-print-day={day.date}
              >
                <header className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-neutral-300 pb-1">
                  <h2 className="text-[14.5px] font-semibold">
                    Tag {firstIndex + i + 1} · {weekdayShort(day.date)} {fmtDate(day.date, { day: '2-digit', month: '2-digit' })}
                  </h2>
                  <span className="text-[11.5px] text-neutral-600">{day.cities.join(' → ') || day.journeys[0]?.to_city || ''}</span>
                </header>

                {day.journeys.length ? (
                  <ul className="mt-1.5 space-y-0.5">
                    {day.journeys.map((j) => (
                      <li key={j.id} className="flex flex-wrap items-baseline gap-x-2 text-[12px]">
                        <span aria-hidden>🚄</span>
                        <span className="font-medium">
                          {j.departure_time ? `${j.departure_time} · ` : ''}
                          {j.title}
                        </span>
                        <span className="text-neutral-600">
                          {[j.from_city, j.to_city].filter(Boolean).join(' → ')}
                          {j.mode ? ` · ${j.mode}` : ''}
                          {j.duration_min ? ` · ${fmtDuration(j.duration_min)}` : ''}
                          {j.price_eur ? ` · ${fmtMoney(j.price_eur)}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {day.places.length ? (
                  <ol className="mt-2 space-y-1.5">
                    {day.places.map((p, n) => (
                      <PrintRow key={p.id} place={p} n={n + 1} />
                    ))}
                  </ol>
                ) : (
                  <p className="mt-2 text-[12px] italic text-neutral-500">für diesen Tag ist nichts eingetragen</p>
                )}

                <div className="mt-2 flex flex-wrap items-start gap-x-2 gap-y-0.5 border-t border-dashed border-neutral-300 pt-1.5 text-[12px]">
                  <span
                    aria-hidden
                    className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: tint.base }}
                    title={noBed ? 'Nacht ohne Bett' : hotel ? `Nacht in ${hotel.name || hotel.city}` : 'Nacht'}
                  />
                  {hotel ? (
                    <span className="min-w-0">
                      <span className="font-medium">🛏️ {hotel.name || 'Unterkunft'}</span>
                      <span className="text-neutral-600">{hotel.city ? ` · ${hotel.city}` : ''}</span>
                      {hotel.address ? <span className="block text-[11px] text-neutral-600">{hotel.address}</span> : null}
                      {hotel.booking_url ? (
                        <a
                          className="block text-[11px] text-blue-700 no-underline underline-offset-2 hover:underline"
                          href={hotel.booking_url}
                          title="Buchung in neuem Tab"
                        >
                          🎫 {hostOf(hotel.booking_url)}
                        </a>
                      ) : null}
                    </span>
                  ) : noBed ? (
                    <span className="text-rose-700">🕳️ für diese Nacht steht kein Bett ein</span>
                  ) : null}
                  {route ? (
                    <a
                      className="ml-auto text-[11px] text-blue-700 no-underline underline-offset-2 hover:underline"
                      href={route}
                      title="die Tagesroute in Google Maps – Stopps in der Reihenfolge der Liste"
                    >
                      🧭 Route des Tages
                    </a>
                  ) : null}
                </div>
              </section>
            );
          })}

          {withPool && pool.length ? (
            <section className="paper print-block px-4 py-3.5">
              <header className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-neutral-300 pb-1">
                <h2 className="text-[14.5px] font-semibold">Noch ohne Tag</h2>
                <span className="text-[11.5px] text-neutral-600">
                  {plural(pool.length, 'Wunsch', 'Wünsche')} – zum Ankreuzen unterwegs
                </span>
              </header>
              <ul className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
                {pool.map((p) => (
                  <li key={p.id} className="flex items-baseline gap-2 text-[12px]">
                    <span aria-hidden className="inline-block h-3 w-3 shrink-0 translate-y-0.5 border border-neutral-400" />
                    <span className="min-w-0 truncate">
                      <span aria-hidden className="mr-1">
                        {categoryMeta(p.category).icon}
                      </span>
                      {p.name}
                      {p.city ? <span className="text-neutral-500"> · {p.city}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="paper print-block px-4 py-3.5">
            <h2 className="text-[14.5px] font-semibold">Notizen</h2>
            <div className="mt-3 space-y-4">
              {Array.from({ length: 6 }, (_, n) => (
                <div key={n} className="border-b border-dashed border-neutral-300" />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function PrintRow({ place, n }: { place: Place; n: number }) {
  const meta = categoryMeta(place.category);
  const status = STATUS_META[place.booking_status];
  const ticket = TICKET_META[place.ticket_status];
  const link = mapsLink(place);
  return (
    <li className="flex gap-2">
      <span className="w-4 shrink-0 text-right text-[11.5px] font-semibold tabular-nums text-neutral-500">{n}</span>
      <div className="min-w-0 flex-1 border-b border-dotted border-neutral-200 pb-1 last:border-0">
        <p className="text-[13px] font-medium leading-snug">
          <span aria-hidden className="mr-1">
            {meta.icon}
          </span>
          {place.name}
          {place.city ? <span className="font-normal text-neutral-500"> · {place.city}</span> : null}
        </p>
        {place.notes ? <p className="mt-0.5 whitespace-pre-line text-[11.5px] leading-snug text-neutral-600">{place.notes}</p> : null}
        <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[11px] text-neutral-500">
          {place.price_eur ? <span className="tabular-nums">{fmtMoney(place.price_eur)}</span> : null}
          <span title={`${status.label} · ${ticket.label}`}>🎫 {ticket.label}</span>
          {place.booking_url ? (
            <a className="text-blue-700 no-underline hover:underline" href={place.booking_url} title="Buchung in neuem Tab">
              ⇩ {hostOf(place.booking_url)}
            </a>
          ) : null}
          <a className="text-blue-700 no-underline hover:underline" href={link} title="in Google Maps öffnen">
            🗺️ {hostOf(link) ?? 'Maps'}
          </a>
        </p>
      </div>
    </li>
  );
}
