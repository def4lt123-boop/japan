'use client';

import React, { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useStore, useTrip } from '../../../../lib/store';
import { useEditor } from '../../../../components/EditorProvider';
import { Button, Card, Empty, LinkTag, Money, Pill, ProgressBar, SectionTitle, Stat, cx } from '../../../../components/ui';
import { STATUS_META, mapsUrl } from '../../../../lib/categories';
import { eachDate, fmtDate, fmtMoney, plural } from '../../../../lib/format';
import { nightCoverage } from '../../../../lib/stats';

export default function HotelsPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = String(params?.tripId ?? '');
  const store = useStore();
  const bundle = useTrip(tripId);
  const { open } = useEditor();
  const [sortBy, setSortBy] = useState<'datum' | 'preis'>('datum');

  const trip = bundle.trip;
  const hotels = useMemo(() => {
    const list = [...bundle.hotels];
    return sortBy === 'datum' ? list.sort((a, b) => (a.check_in ?? '').localeCompare(b.check_in ?? '')) : list.sort((a, b) => (b.price_per_night_eur ?? 0) - (a.price_per_night_eur ?? 0));
  }, [bundle.hotels, sortBy]);

  const nights = bundle.hotels.reduce((a, h) => a + (h.nights ?? 0), 0);
  const total = bundle.hotels.reduce((a, h) => a + (h.price_total_eur ?? 0), 0);
  const perNight = nights ? total / nights : 0;
  const coverage = useMemo(() => (trip ? nightCoverage({ ...bundle, trip }) : []), [bundle, trip]);
  const gaps = coverage.filter((c) => !c.covered);
  const palette = new Map<string, string>();
  const hue = (i: number) => `hsl(${(i * 47 + 18) % 360} 62% 46%)`;
  hotels.forEach((h, i) => palette.set(h.name, hue(i)));

  if (!trip) return null;

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Unterkünfte & Preise"
        icon="🏨"
        hint="Nächte, Preise pro Nacht, Buchungsstatus – und ob jede Nacht der Reise abgedeckt ist."
        right={
          <>
            <Button size="sm" variant="ghost" onClick={() => setSortBy((s) => (s === 'datum' ? 'preis' : 'datum'))}>
              {sortBy === 'datum' ? '↓ Preis' : '↑ Datum'}
            </Button>
            <Button size="sm" variant="primary" onClick={() => open({ kind: 'hotel' })}>
              ＋ Unterkunft
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Stat label="Nächte" value={nights} hint={`${plural(coverage.length, 'Nacht der Reise', 'Nächte der Reise')}`} tone={gaps.length ? 'bad' : 'good'} />
        <Stat label="Gesamt" value={fmtMoney(total)} hint={trip.travelers ? `${fmtMoney(total / Math.max(1, trip.travelers))} pro Person` : undefined} />
        <Stat label="Ø pro Nacht" value={fmtMoney(perNight)} hint={`${hotels.length} Unterkünfte`} />
        <Stat label="Offen" value={hotels.filter((h) => h.booking_status === 'offen').length} hint={gaps.length ? `${plural(gaps.length, 'Loch', 'Löcher')} im Plan` : 'alles gebucht'} tone={gaps.length ? 'bad' : undefined} />
      </div>

      {coverage.length ? (
        <Card className="p-4">
          <SectionTitle title="Nächte-Check" icon="🛏️" hint={gaps.length ? 'Diese Nächte haben noch kein Hotel.' : 'Jede Nacht ist einem Hotel zugeordnet.'} />
          <div className="flex flex-wrap gap-1">
            {coverage.map((c) => (
              <div
                key={c.date}
                title={`${fmtDate(c.date, { weekday: 'long', day: '2-digit', month: 'long' })} · ${c.covered ? c.hotel : 'kein Hotel'}`}
                className={cx('w-[46px] rounded-md border px-1 py-1 text-center', c.covered ? 'border-white/10' : 'border-dashed border-shu-400/60 bg-shu-500/10')}
                style={c.covered ? { background: `${palette.get(c.hotel ?? '')}33` } : undefined}
              >
                <div className="text-[10px] uppercase text-slate-400">{fmtDate(c.date, { weekday: 'narrow' })}</div>
                <div className={cx('text-[12px] font-semibold tabular-nums', c.covered ? 'text-slate-100' : 'text-shu-200')}>{fmtDate(c.date, { day: '2-digit', month: '2-digit' })}</div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {hotels.map((h) => (
              <span key={h.id} className="chip bg-white/[0.04] text-slate-300 ring-white/10" title={h.name}>
                <span className="h-2 w-2 rounded-full" style={{ background: palette.get(h.name) }} />
                {h.name}
              </span>
            ))}
          </div>
        </Card>
      ) : null}

      {!hotels.length ? (
        <Empty
          title="Noch keine Unterkunft erfasst"
          hint="Nächte und Preis rein – das fließt direkt in die Kosten-Übersicht und den Nächte-Check."
          action={
            <Button variant="primary" onClick={() => open({ kind: 'hotel' })}>
              ＋ Erste Unterkunft anlegen
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {hotels.map((h) => {
            const coveredNights = coverage.filter((c) => c.hotel === h.name).length;
            const perPersonNight = h.price_per_night_eur && trip.travelers ? h.price_per_night_eur / trip.travelers : null;
            return (
              <Card key={h.id} className="print-block p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-semibold text-white">{h.name}</h3>
                    <p className="mt-0.5 text-[12.5px] text-slate-400">
                      {h.city}
                      {h.check_in ? ` · ${fmtDate(h.check_in)} → ${fmtDate(h.check_out)}` : ''} · {h.nights ?? '?'} Nächte
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className={cx('chip ring-1', STATUS_META[h.booking_status].color)}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_META[h.booking_status].dot }} />
                      {STATUS_META[h.booking_status].label}
                    </span>
                    <Button size="sm" variant="quiet" onClick={() => open({ kind: 'hotel', id: h.id })}>
                      ✎
                    </Button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[12.5px] sm:grid-cols-4">
                  <Price label="Gesamt" value={fmtMoney(h.price_total_eur)} strong />
                  <Price label="pro Nacht" value={h.price_per_night_eur ? fmtMoney(h.price_per_night_eur) : h.nights && h.price_total_eur ? fmtMoney(h.price_total_eur / h.nights) : '—'} />
                  <Price label="pro Person/Nacht" value={perPersonNight ? fmtMoney(perPersonNight) : '—'} />
                  <Price label="im Plan" value={coverage.length ? `${coveredNights} / ${h.nights ?? '?'} Nächte` : '—'} tone={coverage.length && h.nights && coveredNights < h.nights ? 'warn' : undefined} />
                </div>

                {h.nights && trip.start_date && trip.end_date ? (
                  <div className="mt-2.5">
                    <ProgressBar value={coveredNights} max={h.nights} tone="matcha" />
                  </div>
                ) : null}

                {h.address ? <p className="mt-2.5 text-[12px] text-slate-400">{h.address}</p> : null}
                {h.notes ? <p className="mt-2 whitespace-pre-line text-[12.5px] leading-snug text-slate-300/90">{h.notes}</p> : null}

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {h.lat !== null && h.lng !== null ? (
                    <Pill className="bg-white/[0.04] text-slate-400 ring-white/10" title="Koordinaten aus der Datenbank">
                      {h.lat!.toFixed(4)}, {h.lng!.toFixed(4)}
                    </Pill>
                  ) : (
                    <Pill className="bg-amber-500/10 text-amber-200/90 ring-amber-400/25">keine Koordinaten</Pill>
                  )}
                  {h.lat !== null && h.lng !== null ? <LinkTag href={mapsUrl({ lat: h.lat, lng: h.lng, name: h.name, city: h.city, maps_query: h.address ?? null })}>📍 Maps</LinkTag> : null}
                  {h.booking_url ? <LinkTag href={h.booking_url.startsWith('http') ? h.booking_url : `https://${h.booking_url}`}>🔗 Buchung</LinkTag> : null}
                  <button
                    className="btn-quiet !text-[12px]"
                    onClick={async () => {
                      const q = [h.name, h.city].filter(Boolean).join(' ');
                      const { geocode } = await import('../../../../lib/geocode');
                      const hit = await geocode(q);
                      if (hit) {
                        store.patch('hotels', h.id, { lat: Math.round(hit.lat * 1e6) / 1e6, lng: Math.round(hit.lng * 1e6) / 1e6 });
                        store.say(`${h.name}: ${hit.label.slice(0, 70)}`);
                      } else store.say(`Nichts gefunden für „${q}“`);
                    }}
                  >
                    🌍 Koordinaten suchen
                  </button>
                  <button className="btn-quiet ml-auto !text-[12px] text-red-300/80" onClick={() => window.confirm(`„${h.name}“ löschen?`) && store.remove('hotels', h.id)}>
                    🗑
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="p-4">
        <SectionTitle title="Kosten pro Nacht" icon="📈" hint="Schnellvergleich aller Unterkünfte – aufsteigend nach Preis/Nacht" />
        <ul className="space-y-1">
          {[...hotels]
            .filter((h) => (h.price_per_night_eur ?? (h.price_total_eur && h.nights ? h.price_total_eur / h.nights : null)) !== null)
            .sort((a, b) => {
              const pa = a.price_per_night_eur ?? (a.price_total_eur ?? 0) / (a.nights || 1);
              const pb = b.price_per_night_eur ?? (b.price_total_eur ?? 0) / (b.nights || 1);
              return pa - pb;
            })
            .map((h) => {
              const perNight = h.price_per_night_eur ?? (h.price_total_eur ?? 0) / (h.nights || 1);
              const max = Math.max(...hotels.map((x) => x.price_per_night_eur ?? (x.price_total_eur ?? 0) / (x.nights || 1)), 1);
              return (
                <li key={h.id} className="grid grid-cols-[minmax(0,1fr)_120px_70px] items-center gap-2 text-[12.5px]">
                  <span className="truncate text-slate-200">
                    {h.name} <span className="text-slate-500">· {h.city}</span>
                  </span>
                  <span className="h-2 rounded-full bg-white/[0.06]">
                    <span className="block h-full rounded-full bg-ai-500" style={{ width: `${Math.max(3, (perNight / max) * 100)}%` }} />
                  </span>
                  <Money value={perNight} className="text-right text-[12px]" />
                </li>
              );
            })}
        </ul>
      </Card>
    </div>
  );
}

function Price({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'warn' }) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-2 py-1.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={cx('mt-0.5 tabular-nums', strong ? 'text-[15px] font-semibold text-white' : 'text-[13px]', tone === 'warn' && 'text-amber-200')}>{value}</div>
    </div>
  );
}
