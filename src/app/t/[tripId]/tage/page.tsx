'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useStore, useTrip } from '../../../../lib/store';
import { useEditor } from '../../../../components/EditorProvider';
import { PlaceCard } from '../../../../components/PlaceCard';
import { Button, Card, Empty, SectionTitle, cx } from '../../../../components/ui';
import { dayPlan, nightCoverage } from '../../../../lib/stats';
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

  const days = bundle.trip ? dayPlan(bundle) : [];
  const pool = bundle.places.filter((p) => !p.date);
  const coverage = new Map(bundle.trip ? nightCoverage(bundle).map((n) => [n.date, n]) : []);
  const dateIndex = new Map(days.map((d, i) => [d.date, i]));

  const moveDay = (placeId: string, from: string | null, dir: -1 | 1) => {
    if (!from) return;
    const idx = dateIndex.get(from);
    if (idx === undefined) return;
    const next = days[idx + dir];
    if (!next) {
      store.patch('places', placeId, { date: null });
      store.say('Zurück in der Wünscheliste.');
      return;
    }
    store.patch('places', placeId, { date: next.date });
  };

  const drop = (date: string | null) => (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    setDropTarget(null);
    if (!id) return;
    const place = bundle.places.find((p) => p.id === id);
    if (!place || place.date === date) return;
    store.patch('places', id, { date });
    store.say(date ? `„${place.name}“ → ${fmtDate(date, { weekday: 'short', day: '2-digit', month: '2-digit' })}` : `„${place.name}“ in die Wünscheliste verschoben.`);
  };

  if (!store.ready) return <Card className="p-8 text-center text-sm text-slate-400">lädt …</Card>;
  if (!bundle.trip) return null;

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Tagesplan"
        icon="🗓️"
        hint="Karten mit der Maus zwischen Tagen ziehen (Touch: ◀ ▶). Ein Tag gilt als voll, wenn mehr als 8 h Programm geplant sind."
        right={
          <>
            <Button size="sm" variant="ghost" onClick={() => window.print()}>
              🖨 Drucken
            </Button>
            <Button size="sm" variant="primary" onClick={() => open({ kind: 'place' })}>
              ＋ Eintrag
            </Button>
          </>
        }
      />

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
              title={`${plural(d.places.length, 'Ort', 'Orte')} · ${d.hours.toFixed(1)} h`}
            >
              <span className="font-semibold">{fmtDate(d.date, { weekday: 'short' })}</span>
              <span className="tabular-nums">{fmtDate(d.date, { day: '2-digit', month: '2-digit' })}</span>
              <span className={cx('rounded px-1 tabular-nums', d.hours > 8 ? 'bg-shu-500/25 text-shu-100' : d.places.length ? 'bg-white/[0.07] text-slate-300' : 'text-slate-600')}>{d.places.length}</span>
            </a>
          ))}
          {pool.length ? (
            <a href="#pool" className="flex shrink-0 items-center gap-1.5 rounded-lg bg-amber-500/10 px-2 py-1 text-[12px] text-amber-100 ring-1 ring-inset ring-amber-400/25 hover:bg-amber-500/20">
              ✨ Pool <span className="tabular-nums">{pool.length}</span>
            </a>
          ) : null}
        </div>
      </div>

      {!days.length ? (
        <Empty
          title="Für diese Reise ist noch kein Zeitraum gesetzt"
          hint="Oben rechts auf ⚙ klicken und Start-/Enddatum eintragen. Danach erscheinen hier die Tage zum Befüllen."
          action={
            <Button variant="primary" onClick={() => open({ kind: 'trip', id: tripId })}>
              Reise-Datum setzen
            </Button>
          }
        />
      ) : null}

      <div className="grid gap-3 2xl:grid-cols-2">
        {days.map((d) => {
          const night = coverage.get(d.date);
          const over = d.hours > 8;
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
              className={cx('print-block scroll-mt-16 p-0 transition', dropTarget === d.date && 'drop-live', over && 'border-shu-400/30')}
            >
              <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-white/[0.07] px-3 py-2">
                <span className="text-[13px] font-semibold text-white">{fmtDate(d.date, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                <span className="text-[12px] text-slate-400">
                  {d.cities.length ? `· ${d.cities.join(' / ')}` : d.journeys[0]?.to_city ? `· ${d.journeys[0].to_city}` : ''}
                </span>
                <span className="ml-auto flex items-center gap-1.5 text-[11.5px] text-slate-400">
                  <span className={cx('chip ring-1', over ? 'bg-shu-500/15 text-shu-100 ring-shu-400/30' : 'bg-white/[0.05] text-slate-300 ring-white/10')}>
                    {plural(d.places.length, 'Ort', 'Orte')} · {d.hours ? fmtDuration(d.hours * 60) : '0 Min'}
                  </span>
                  <button className="btn-quiet !px-1.5" title="Ort an diesem Tag anlegen" onClick={() => open({ kind: 'place', defaults: { date: d.date } })}>
                    ＋
                  </button>
                </span>
              </header>

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

              <div className="space-y-2 p-2.5">
                {d.places.length ? (
                  d.places.map((p) => <PlaceCard key={p.id} place={p} onMove={(dir) => moveDay(p.id, d.date, dir)} />)
                ) : (
                  <div className="rounded-lg border border-dashed border-white/[0.12] px-3 py-5 text-center text-[12.5px] text-slate-500">
                    Noch nichts geplant – Karte hierher ziehen oder{' '}
                    <button className="text-shu-200 underline-offset-2 hover:underline" onClick={() => open({ kind: 'place', defaults: { date: d.date } })}>
                      neuen Eintrag anlegen
                    </button>
                    {pool.length ? (
                      <>
                        {' '}
                        oder{' '}
                        <button
                          className="text-shu-200 underline-offset-2 hover:underline"
                          onClick={() => {
                            const candidate = pool.find((p) => p.priority === 'muss') ?? pool[0];
                            if (candidate) store.patch('places', candidate.id, { date: d.date });
                          }}
                        >
                          nächsten Pool-Ort hierher legen
                        </button>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {pool.length ? (
        <Card id="pool" className="scroll-mt-16 p-4" onDragOver={(e) => { e.preventDefault(); setDropTarget('pool'); }} onDragLeave={() => setDropTarget(null)} onDrop={drop(null)}>
          <SectionTitle title={`Wünscheliste / Pool (${pool.length})`} icon="✨" hint="Diese Einträge haben noch keinen Tag. Zieh sie auf einen Tag oben." right={<Link href={`/t/${tripId}/wuenscheliste`} className="btn-ghost">alle ansehen →</Link>} />
          <div className={cx('grid gap-2 md:grid-cols-2 2xl:grid-cols-3', dropTarget === 'pool' && 'drop-live rounded-xl')}>
            {pool.slice(0, 12).map((p) => (
              <PlaceCard key={p.id} place={p} dense showDate />
            ))}
          </div>
          {pool.length > 12 ? <p className="mt-2 text-[12px] text-slate-500">… und {pool.length - 12} weitere in der Wünscheliste.</p> : null}
        </Card>
      ) : null}
    </div>
  );
}
