'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useStore, useTrip } from '../../../../lib/store';
import { useEditor } from '../../../../components/EditorProvider';
import { PlaceCard } from '../../../../components/PlaceCard';
import { Button, Card, Empty, SectionTitle, TextInput, cx } from '../../../../components/ui';
import { dayPlan, nightCoverage } from '../../../../lib/stats';
import { categoryMeta } from '../../../../lib/categories';
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
  const [poolQ, setPoolQ] = useState('');

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

  const bestDayFor = (city: string | null) => {
    const key = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();
    const same = days.filter((d) => d.cities.some((c) => key(c) === key(city)));
    const list = (same.length ? same : days).slice().sort((a, b) => a.places.length - b.places.length);
    return list[0]?.date ?? null;
  };
  const poolShown = useMemo(() => {
    const q = poolQ.trim().toLowerCase();
    const list = q ? pool.filter((p) => `${p.name} ${p.city} ${p.category ?? ''} ${p.notes ?? ''}`.toLowerCase().includes(q)) : pool;
    return list.slice().sort((a, b) => (a.priority === b.priority ? a.name.localeCompare(b.name, 'de') : a.priority === 'muss' ? -1 : b.priority === 'muss' ? 1 : 0));
  }, [pool, poolQ]);

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
        hint="Neue Einträge entstehen ohne Tag und warten rechts in der Leiste – von dort auf einen Tag ziehen (Touch: ◀ ▶ am Karteikasten). Ein Tag gilt als voll über 8 h Programm."
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

      <div className={cx('grid items-start gap-3', pool.length ? '2xl:grid-cols-[minmax(0,1fr)_312px]' : '')}>
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
        <aside
          className="no-print sticky top-2 max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-xl border border-white/[0.07] bg-ink-900/70 p-2.5 backdrop-blur"
          onDragOver={(e) => {
            e.preventDefault();
            setDropTarget('pool');
          }}
          onDragLeave={() => setDropTarget((cur) => (cur === 'pool' ? null : cur))}
          onDrop={drop(null)}
        >
          <div className="mb-1.5 flex items-center gap-1.5">
            <h3 className="text-[13px] font-semibold text-white">✨ Wünscheliste <span className="tabular-nums text-slate-400">{pool.length}</span></h3>
            <Link href={`/t/${tripId}/wuenscheliste`} className="ml-auto text-[11.5px] text-slate-400 underline-offset-2 hover:text-white hover:underline">
              alle →
            </Link>
          </div>
          <p className="mb-1.5 text-[11px] leading-snug text-slate-500">Nach rechts auf einen Tag ziehen. Das Pfeil-Symbol legt den Punkt auf den Tag mit der meisten Luft.</p>
          <TextInput className="!py-1 !text-[12px]" value={poolQ} onChange={(e) => setPoolQ(e.target.value)} placeholder="suchen …" />
          <ul className={cx('mt-1.5 space-y-1', dropTarget === 'pool' && 'drop-live rounded-lg')}>
            {poolShown.slice(0, 40).map((item) => {
              const meta = categoryMeta(item.category);
              const target = bestDayFor(item.city);
              return (
                <li key={item.id} className="flex items-stretch gap-1 rounded-lg border border-white/[0.07] bg-white/[0.02] transition hover:border-white/20">
                  <span
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', item.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    className="flex min-w-0 flex-1 cursor-grab items-start gap-1.5 px-2 py-1.5 active:cursor-grabbing"
                    title={`${meta.label} – auf einen Tag ziehen`}
                  >
                    <span aria-hidden className="mt-px">{meta.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium text-slate-100">{item.name}</span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {item.city || '—'}
                        {item.priority === 'muss' ? ' · ★ Muss' : item.priority === 'kann' ? ' · Kann' : ''}
                        {item.ticket_status === 'noetig' ? ' · 🎟 offen' : item.ticket_status === 'gekauft' ? ' · 🎟 ✓' : ''}
                        {item.price_eur ? ` · ${item.price_eur} €` : ''}
                      </span>
                    </span>
                  </span>
                  <button
                    className="shrink-0 rounded-r-lg px-1.5 text-[13px] text-slate-400 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-30"
                    disabled={!target}
                    title={target ? `Auf ${target.split('-').reverse().join('.')} legen (meiste freie Zeit)` : 'Kein Tag verfügbar'}
                    onClick={() => {
                      if (!target) return;
                      store.patch('places', item.id, { date: target });
                      store.say(`„${item.name}“ → ${fmtDate(target, { weekday: 'short', day: '2-digit', month: '2-digit' })}`);
                    }}
                  >
                    →
                  </button>
                </li>
              );
            })}
          </ul>
          {poolShown.length > 40 ? <p className="mt-1 text-[11px] text-slate-500">… {poolShown.length - 40} weitere – „alle“ oben.</p> : null}
          {!poolShown.length ? <p className="px-1 py-3 text-center text-[12px] text-slate-500">Keine Treffer für „{poolQ}“.</p> : null}
        </aside>
      ) : null}
      </div>
    </div>
  );
}
