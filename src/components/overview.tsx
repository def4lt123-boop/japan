'use client';

/**
 * Grafische Bausteine der Reise-Übersicht:
 *  TripRibbon   – Band über alle Reisetage (Unterkünfte, Nächte, Etappen, Auslastung)
 *  DayBoard     – Karte pro Tag mit Zeitachse 07–23, Ablageziel für Punkte ohne Tag
 *  GapPanel     – "was noch fehlen würde" inkl. Planungsgrad-Ring
 *  CapacityPanel– "was noch frei / verfügbar ist" (Tagesluft, Stadt-Balance, offene Buchungen)
 */
import React, { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useEditor } from './EditorProvider';
import { Button, Card, Empty, LinkTag, Money, ProgressBar, SectionTitle, cx } from './ui';
import { DAY_CAPACITY, type CityLoad, type DayCell, type GapItem, type Sample, type Stay, cityLoad, loadLabel, loadTone } from '../lib/overview';
import { tintFor } from '../lib/palette';
import { STATUS_META, TICKET_META, categoryMeta } from '../lib/categories';
import { assign } from '../lib/dayplan';
import { fmtDate, fmtDuration, fmtMoney, plural } from '../lib/format';
import type { Place } from '../lib/types';

const STAY_TONE: Record<string, string> = {
  gebucht: 'bg-emerald-500/25 border-emerald-400/50 text-emerald-50',
  erledigt: 'bg-sky-500/25 border-sky-400/50 text-sky-50',
  reserviert: 'bg-amber-500/25 border-amber-400/50 text-amber-50',
  offen: 'bg-white/[0.06] border-white/20 text-slate-100',
};
const MODE_ICON: Record<string, string> = { Flug: '✈️', Shinkansen: '🚄', Zug: '🚆', Bus: '🚌', Fähre: '⛴️', 'U-Bahn': '🚇', Auto: '🚗', 'zu Fuß': '🚶' };
const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/* ============================================================ Das Band */

export function TripRibbon({ tripId, cells, stays }: { tripId: string; cells: DayCell[]; stays: Stay[] }) {
  const n = cells.length;
  if (!n) return null;
  const colOf = (date: string) => cells.findIndex((c) => c.date === date) + 2;
  const lastCol = n + 2;

  const colStyle = (row: number, from: number, to?: number): React.CSSProperties => ({
    gridRow: row,
    gridColumn: `${from} / ${Math.max(from + 1, Math.min(lastCol, to ?? from + 1))}`,
  });
  const dayCol = (date: string) => Math.max(2, colOf(date));

  // Zeilen: 1 Kopf · 2 Unterkünfte · 3 Nächte · 4 Etappen · 5 Auslastung
  let row = 2;
  const stayRow0 = row;
  row += Math.max(1, stays.length);
  const nightRow = row++;
  const travelRow = row++;
  const loadRow = row++;

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-white/[0.07] px-4 py-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
            <span aria-hidden>🎌</span> Die Reise auf einem Blick
          </h2>
          <p className="mt-0.5 text-[12.5px] text-slate-400">
            Bett, Routen und Tagesluft über {plural(n, 'Tag', 'Tage')} · {plural(stays.length, 'Unterkunft', 'Unterkünfte')} · Spalten anklicken = zum Tag springen
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
          {Object.entries(STAY_TONE).map(([k, v]) => (
            <span key={k} className={cx('chip border ring-0', v.split(' ').slice(0, 2).join(' '))}>
              {STATUS_META[k as keyof typeof STATUS_META]?.label ?? k}
            </span>
          ))}
          <span className="chip bg-white/[0.05] text-slate-300 ring-white/10">▨ freier Tag</span>
        </div>
      </div>

      <div className="overflow-x-auto px-2 pb-2 pt-1">
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: `148px repeat(${n}, minmax(27px, 1fr))`, minWidth: 148 + n * 27 }}>
          {/* Kopf: Tage */}
          <div className="flex items-end gap-1 pb-1 pl-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500" style={{ gridRow: 1, gridColumn: 1 }}>
            <span className="truncate normal-case tracking-normal text-slate-400">
              {fmtDate(cells[0].date, { day: '2-digit', month: '2-digit' })} – {fmtDate(cells[n - 1].date, { day: '2-digit', month: '2-digit', year: 'numeric' })}
            </span>
          </div>
          {cells.map((c, i) => (
            <a
              key={c.date}
              href={`#day-${c.date}`}
              title={`${fmtDate(c.date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${plural(c.count, 'Aktivität', 'Aktivitäten')}${c.count ? '' : ' · kein Programm'}${c.hotel ? ` · 🛏 ${c.hotel.name}` : ''}`}
              style={colStyle(1, i + 2)}
              className={cx(
                'rounded-md px-0.5 pb-1 pt-0.5 text-center transition hover:bg-white/10',
                c.weekend ? 'bg-shu-500/[0.13]' : 'bg-transparent',
              )}
            >
              <span className={cx('block text-[9.5px] font-semibold uppercase', c.weekend ? 'text-shu-200' : 'text-slate-500')}>{c.weekday.replace('.', '')}</span>
              <span className={cx('block text-[12px] font-semibold tabular-nums', c.empty ? 'text-slate-500' : 'text-slate-100')}>{Number(c.date.slice(8, 10))}</span>
              {Number(c.date.slice(8, 10)) === 1 ? <span className="block text-[8.5px] text-slate-500">{fmtDate(c.date, { month: 'short' })}</span> : null}
            </a>
          ))}

          {/* Unterkünfte als Balken */}
          <div className="flex items-center pl-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500" style={{ gridRow: `${stayRow0} / span ${Math.max(1, stays.length)}`, gridColumn: 1 }}>
            Schlafen
          </div>
          {stays.map((s, i) => {
            const startCol = s.from < cells[0].date ? 2 : dayCol(s.from);
            const endIdx = cells.findIndex((c) => c.date >= s.to);
            const endCol = endIdx === -1 ? lastCol : Math.max(startCol + 1, Math.min(lastCol, endIdx + 2));
            return (
              <div key={`${s.hotelId ?? s.city}-${i}`} className="relative" style={colStyle(stayRow0 + i, startCol, endCol)}>
                <a
                  href={`/t/${tripId}/unterkuenfte`}
                  title={`${s.city} · ${s.hotel ?? 'Quartier offen'} · ${s.nights} Nächte${s.price_eur ? ` · ${fmtMoney(s.price_eur)}` : ''}${s.perNight ? ` (${fmtMoney(s.perNight)}/Nacht)` : ''}`}
                  className={cx('flex h-[22px] items-center gap-1 overflow-hidden rounded-md border px-1.5 text-[11px] font-medium transition hover:brightness-125', STAY_TONE[s.booking_status] ?? STAY_TONE.offen)}
                >
                  <span aria-hidden>🏨</span>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: tintFor(s.hotelId ?? s.city).edge }} aria-hidden />
                  <span className="truncate">{s.hotel ?? 'noch offen'}</span>
                  <span className="ml-auto shrink-0 tabular-nums text-[10px] opacity-80">{s.nights}N</span>
                </a>
              </div>
            );
          })}
          {!stays.length ? (
            <div className="rounded-md border border-dashed border-shu-400/40 bg-shu-500/[0.07] px-2 text-[11px] text-shu-100" style={colStyle(stayRow0, 2, lastCol)}>
              noch keine Unterkunft mit Ein-/Auscheck-Datum angelegt
            </div>
          ) : null}

          {/* Nächte: gedeckt oder Lücke */}
          <div className="flex items-center pl-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500" style={{ gridRow: nightRow, gridColumn: 1 }}>
            Nächte
          </div>
          {cells.map((c, i) => {
            const last = i === n - 1;
            return (
              <div
                key={`n-${c.date}`}
                title={last ? 'Abreisetag – keine Nacht' : c.nightGap ? 'Nacht ohne Unterkunft' : `🛏 ${c.hotel?.name ?? ''}`}
                style={colStyle(nightRow, i + 2)}
                className={cx(
                  'h-[14px] rounded-[4px]',
                  last ? 'bg-transparent' : c.nightGap ? 'border border-dashed border-shu-400/70 bg-shu-500/20' : c.checkIn ? 'bg-matcha-500/60' : 'bg-matcha-500/25',
                )}
              />
            );
          })}

          {/* Etappen & Umzüge */}
          <div className="flex items-center pl-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500" style={{ gridRow: travelRow, gridColumn: 1 }}>
            Unterwegs
          </div>
          {cells.map((c, i) => (
            <div key={`j-${c.date}`} style={colStyle(travelRow, i + 2)} className="flex h-[18px] items-center justify-center gap-0.5 text-[11px]">
              {c.journeys.map((j) => (
                <span key={j.id} title={`${j.title}${j.departure_time ? ` · ${j.departure_time}` : ' · ohne Uhrzeit'}`} className={cx(j.booking_status !== 'gebucht' && 'rounded bg-amber-500/20 px-0.5')}>
                  {MODE_ICON[j.mode ?? ''] ?? '🧳'}
                </span>
              ))}
              {c.checkIn && !c.journeys.length ? <span title="Ankunft / Check-in">🔑</span> : null}
              {c.checkOut && !c.journeys.length ? <span title="Check-out">🧷</span> : null}
            </div>
          ))}

          {/* Auslastung */}
          <div className="flex items-end pl-1 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500" style={{ gridRow: loadRow, gridColumn: 1 }}>
            Auslastung
          </div>
          {cells.map((c, i) => (
            <a
              key={`l-${c.date}`}
              href={`#day-${c.date}`}
              title={`${plural(c.count, 'Punkt', 'Punkte')} geplant${c.free ? ` · ${c.free} passen noch dazu` : ''}`}
              style={colStyle(loadRow, i + 2)}
              className="flex h-[30px] items-end overflow-hidden rounded-md bg-white/[0.04] hover:bg-white/[0.09]"
            >
              <span className={cx('block w-full rounded-t', loadTone(c.load))} style={{ height: `${Math.max(6, Math.min(100, c.load * 100))}%` }} />
            </a>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/[0.07] px-4 py-2 text-[11px] text-slate-500">
        <span>🔑 Check-in</span>
        <span>🧷 Check-out</span>
        <span className="text-matcha-200/80">▰ Nacht gedeckt</span>
        <span className="text-shu-200">▨ Nacht ohne Bett</span>
        <span>Höhe der Säulen = Punkte pro Tag (${DAY_CAPACITY} gelten als voll, mehr wird rot) – nur der Reihe nach, keine Uhrzeiten</span>
      </div>
    </Card>
  );
}

/* ============================================================ Tageskarten */

export function DayBoard({ tripId, cells, pool }: { tripId: string; cells: DayCell[]; pool: Place[] }) {
  const store = useStore();
  const { open } = useEditor();
  const [onlyGaps, setOnlyGaps] = useState(false);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const drop = (date: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;
    const moved = store.places.find((x) => x.id === id);
    if (!moved || moved.date === date) return;
    assign(store, store.places, moved, { date });
  };

  const shown = useMemo(() => (onlyGaps ? cells.filter((c) => c.empty || c.nightGap || c.issues.length) : cells), [cells, onlyGaps]);
  const noDates = !cells.length;

  const placeFromPool = (p: Place, date: string) => {
    store.patch('places', p.id, { date });
    store.say(`„${p.name}“ → ${fmtDate(date, { weekday: 'short', day: '2-digit', month: '2-digit' })}`);
  };

  return (
    <Card className="p-4">
      <SectionTitle
        title="Jeder Tag im Bild"
        icon="🗓️"
        hint="ein Feld pro Tag · die Zahl = Punkte an diesem Tag · rot umrandet = ein Muss ist noch offen · Felder sind Ablage-Ziele"
        right={
          <>
            <Button size="sm" variant={onlyGaps ? 'primary' : 'ghost'} onClick={() => setOnlyGaps((v) => !v)} title="Nur Tage zeigen, die leer oder voll sind">
              nur Baustellen
            </Button>
            <a href={`/t/${tripId}/tage`} className="btn-ghost !py-1 !text-[12px]">
              ausführlich planen →
            </a>
          </>
        }
      />
      {pool.length && !noDates ? (
        <div className="no-print mb-3 rounded-xl border border-amber-400/20 bg-amber-500/[0.05] p-2">
          <p className="mb-1.5 px-1 text-[11.5px] text-amber-100/90">
            <b>Ziehen &amp; fallen lassen:</b> {plural(pool.length, 'Punkt', 'Punkte')} noch ohne Tag – auf eine Tageskarte ablegen. Die komplette Liste ist unter „Aktivitäten“.
          </p>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {pool.map((item) => {
              const meta = categoryMeta(item.category);
              return (
                <button
                  key={item.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', item.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  title={`${meta.label}${item.city ? ` · ${item.city}` : ''} – auf einen Tag ziehen`}
                  className="flex shrink-0 cursor-grab items-center gap-1.5 rounded-lg border border-white/10 bg-ink-800/80 px-2 py-1 text-[12px] text-slate-200 transition hover:border-amber-400/40 hover:bg-ink-700 active:cursor-grabbing"
                >
                  <span aria-hidden>{meta.icon}</span>
                  <span className="max-w-[190px] truncate">{item.name}</span>
                  {item.priority === 'muss' ? <span className="text-[10px] text-shu-300">★</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {noDates ? (
        <Empty
          title="Noch kein Reise-Zeitraum"
          hint="Start- und Enddatum oben rechts in den Reise-Einstellungen eintragen – dann erscheinen Band und Tageskarten automatisch."
          action={
            <Button size="sm" variant="primary" onClick={() => open({ kind: 'trip', id: tripId })}>
              Zeitraum setzen
            </Button>
          }
        />
      ) : !shown.length ? (
        <Empty title="Kein Tag mit Lücken 🎉" hint="Jeder Tag hat ein Bett und Programm. Nimm die Ansicht raus, um alles zu sehen." action={<Button size="sm" onClick={() => setOnlyGaps(false)}>alle Tage zeigen</Button>} />
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {shown.map((c) => {
            const hasRoom = c.empty || c.load < 0.75;
            const matching = pool.filter((p) => c.city && norm(p.city) === norm(c.city));
            const tips = hasRoom ? (matching.length ? matching.slice(0, 2) : pool.slice(0, 2)) : [];
            return (
              <div
                key={c.date}
                id={`day-${c.date}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(c.date);
                }}
                onDragLeave={() => setDragOver((cur) => (cur === c.date ? null : cur))}
                onDrop={drop(c.date)}
                className={cx(
                  'print-block scroll-mt-24 rounded-xl border bg-black/[0.18] p-2.5 transition',
                  c.nightGap ? 'border-shu-400/40' : c.empty ? 'border-dashed border-white/[0.14]' : 'border-white/[0.08]',
                  dragOver === c.date && 'drop-live',
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-semibold text-white">
                      <span className="tabular-nums text-slate-400">T{c.index + 1}</span> {fmtDate(c.date, { weekday: 'short', day: '2-digit', month: '2-digit' })}
                    </p>
                    <p className="mt-0.5 truncate text-[11.5px] text-slate-400">{c.city ?? '—'}</p>
                  </div>
                  <span className={cx('chip shrink-0 ring-1', c.load > 1.05 ? 'bg-shu-500/15 text-shu-100 ring-shu-400/30' : c.load > 0.6 ? 'bg-matcha-500/15 text-matcha-100 ring-matcha-400/30' : c.count ? 'bg-white/[0.05] text-slate-300 ring-white/10' : 'bg-white/[0.04] text-slate-500 ring-white/10')}>
                    {loadLabel(c)}
                  </span>
                </div>

                {/* was an diesem Tag ansteht – der Reihe nach */}
                <div className="mt-2 space-y-0.5">
                  {c.places.slice(0, 4).map((b, i) => {
                    const meta = categoryMeta(b.category);
                    return (
                      <button
                        key={b.id}
                        onClick={() => open({ kind: 'place', id: b.id })}
                        title={`${i + 1}. ${b.name} · ${meta.label}${b.price_eur ? ` · ${fmtMoney(b.price_eur)}` : ''} · ${(TICKET_META[(b.ticket_status ?? 'unklar') as keyof typeof TICKET_META] ?? TICKET_META.unklar).label}`}
                        className={cx(
                          'flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-[11.5px] transition hover:bg-white/[0.07]',
                          b.priority === 'muss' && b.booking_status === 'offen' && 'ring-1 ring-inset ring-shu-300/50',
                        )}
                      >
                        <span className="w-3 shrink-0 text-right tabular-nums text-slate-500">{i + 1}</span>
                        <span aria-hidden style={{ color: meta.color }}>
                          {meta.icon}
                        </span>
                        <span className={cx('min-w-0 flex-1 truncate', b.booking_status === 'erledigt' ? 'text-slate-500 line-through' : 'text-slate-200')}>{b.name}</span>
                        {b.priority === 'muss' ? <span className="shrink-0 text-[10px] text-shu-300">★</span> : null}
                      </button>
                    );
                  })}
                  {!c.places.length ? <p className="px-1 py-1.5 text-[11px] text-slate-600">{c.journeys.length ? 'Reisetag' : 'noch nichts geplant'}</p> : null}
                  {c.places.length > 4 ? <p className="px-1 text-[10.5px] tabular-nums text-slate-500">+{c.places.length - 4} weitere</p> : null}
                </div>

                {/* Bett */}
                <p className={cx('mt-1.5 flex items-center gap-1 truncate text-[11.5px]', c.nightGap ? 'text-shu-200' : 'text-slate-400')}>
                  {c.nightGap ? (
                    <>
                      <span aria-hidden>⚠️</span> Nacht ohne Unterkunft
                    </>
                  ) : c.hotel ? (
                    <>
                      <span aria-hidden>🛏</span>
                      <span className="truncate">{c.hotel.name}</span>
                      {c.checkOut ? <span className="text-slate-600">· Check-out</span> : null}
                    </>
                  ) : (
                    <>
                      <span aria-hidden>🛏</span> Abreise-Tag
                    </>
                  )}
                  <button className="ml-auto shrink-0 text-[11px] text-shu-200 underline-offset-2 hover:underline" onClick={() => open(c.hotel ? { kind: 'hotel', id: c.hotel.id } : { kind: 'hotel', defaults: { check_in: c.date, city: c.city ?? '' } })}>
                    {c.hotel ? 'ändern' : 'anlegen'}
                  </button>
                </p>

                {/* Etappen */}
                {c.journeys.map((j) => (
                  <button key={j.id} onClick={() => open({ kind: 'journey', id: j.id })} className="mt-1 flex w-full items-center gap-1.5 rounded-md bg-white/[0.04] px-1.5 py-1 text-left text-[11.5px] text-slate-200 hover:bg-white/[0.08]">
                    <span aria-hidden>{MODE_ICON[j.mode ?? ''] ?? '🧳'}</span>
                    <span className="min-w-0 flex-1 truncate">{j.title}</span>
                    <span className="shrink-0 tabular-nums text-slate-500">{j.departure_time ?? 'Zeit?'}</span>
                  </button>
                ))}

                {/* Punkte ohne Tag – hier ablegen */}
                {tips.length ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <span className="text-[10.5px] text-slate-500">passt hier:</span>
                    {tips.map((p) => (
                      <button key={p.id} onClick={() => placeFromPool(p, c.date)} title={`${categoryMeta(p.category).label}${p.duration_min ? ` · ${fmtDuration(p.duration_min)}` : ''} – auf diesen Tag legen`} className="chip bg-amber-500/10 text-amber-100/90 ring-amber-400/25 hover:bg-amber-500/20">
                        {categoryMeta(p.category).icon} {p.name.length > 22 ? `${p.name.slice(0, 21)}…` : p.name} ＋
                      </button>
                    ))}
                  </div>
                ) : null}

                {c.issues.length ? (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {c.issues.map((i) => (
                      <span key={i} className="chip bg-white/[0.04] text-slate-400 ring-white/10">
                        {i}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-1.5 flex items-center gap-1 border-t border-white/[0.06] pt-1.5">
                  <Button size="sm" variant="quiet" onClick={() => open({ kind: 'place', defaults: { date: c.date, city: c.city ?? '' } })}>
                    ＋ Eintrag
                  </Button>
                  <span className="ml-auto text-[10.5px] tabular-nums text-slate-500">{loadLabel(c)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ============================================================ Baustellen */

const TONE = {
  bad: { bar: 'bg-shu-500', text: 'text-shu-200', chip: 'bg-shu-500/15 text-shu-100 ring-shu-400/30' },
  warn: { bar: 'bg-amber-400', text: 'text-amber-200', chip: 'bg-amber-500/10 text-amber-100 ring-amber-400/25' },
  ok: { bar: 'bg-matcha-500', text: 'text-matcha-100', chip: 'bg-emerald-500/10 text-emerald-200 ring-emerald-400/30' },
};

function ReadinessRing({ items }: { items: GapItem[] }) {
  const pct = items.length ? Math.round((items.reduce((a, i) => a + Math.min(1, i.total ? i.done / i.total : 1), 0) / items.length) * 100) : 0;
  const color = pct >= 85 ? '#5fbf8f' : pct >= 55 ? '#e8b04a' : '#f04e23';
  return (
    <div className="flex items-center gap-3">
      <div
        className="relative grid h-[74px] w-[74px] shrink-0 place-items-center rounded-full"
        style={{ background: `conic-gradient(${color} ${pct * 3.6}deg, rgba(255,255,255,0.08) 0deg)` }}
        title={`${pct} % der Planungs-Punkte erfüllt`}
      >
        <span className="grid h-[56px] w-[56px] place-items-center rounded-full bg-ink-900 text-[16px] font-semibold tabular-nums text-white">{pct}%</span>
      </div>
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold text-white">Planungsgrad</p>
        <p className="text-[11.5px] leading-snug text-slate-400">
          {items.filter((i) => i.severity === 'bad').length} kritisch · {items.filter((i) => i.severity === 'warn').length} in Arbeit · {items.filter((i) => i.severity === 'ok').length} fein
        </p>
      </div>
    </div>
  );
}

export function GapPanel({ tripId, items }: { tripId: string; items: GapItem[] }) {
  const { open } = useEditor();
  const [showDone, setShowDone] = useState(false);
  const openItems = items.filter((i) => i.severity !== 'ok');
  const doneItems = items.filter((i) => i.severity === 'ok');
  const shown = showDone ? items : openItems.length ? openItems : items;

  const jump = (s: Sample) => {
    if (s.kind === 'place') open({ kind: 'place', id: s.id, defaults: s.defaults });
    else if (s.kind === 'hotel') open({ kind: 'hotel', id: s.id, defaults: s.defaults });
    else open({ kind: 'journey', id: s.id });
  };

  return (
    <Card className="p-4">
      <SectionTitle
        title="Was noch fehlen würde"
        icon="🧾"
        hint={openItems.length ? 'Punkt anklicken → Formular öffnet sich direkt mit dem Eintrag.' : 'Alle Haken gesetzt – die Reise ist durchgeplant.'}
        right={
          doneItems.length ? (
            <Button size="sm" variant="ghost" onClick={() => setShowDone((v) => !v)}>
              {showDone ? 'Fertiges ausblenden' : `${plural(doneItems.length, 'Punkt', 'Punkte')} fertig`}
            </Button>
          ) : null
        }
      />
      <div className="mb-3">
        <ReadinessRing items={items} />
      </div>
      <ul className="space-y-1.5">
        {shown.map((i) => {
          const tone = TONE[i.severity];
          return (
            <li key={i.key} className={cx('rounded-lg border px-2.5 py-2', i.severity === 'ok' ? 'border-white/[0.06] bg-white/[0.02]' : 'border-white/[0.09] bg-white/[0.03]')}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span aria-hidden className="text-[13px]">
                  {i.icon}
                </span>
                <span className="text-[13px] font-medium text-slate-100">{i.label}</span>
                <span className={cx('chip ring-1', tone.chip)}>
                  {i.done}/{i.total}
                </span>
                <a href={`/t/${tripId}${i.href}`} className="ml-auto text-[11.5px] text-slate-400 underline-offset-2 hover:text-slate-100 hover:underline">
                  {i.href.replace('/', '')} →
                </a>
              </div>
              <div className="mt-1.5">
                <ProgressBar value={i.done} max={Math.max(1, i.total)} tone={i.severity === 'ok' ? 'matcha' : 'shu'} />
              </div>
              <p className={cx('mt-1 text-[11.5px]', i.severity === 'ok' ? 'text-slate-500' : tone.text)}>{i.hint}</p>
              {i.samples.length ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {i.samples.map((s, k) => (
                    <button key={`${i.key}-${k}`} onClick={() => jump(s)} className="chip bg-black/25 text-slate-300 ring-white/10 hover:bg-black/40 hover:text-white">
                      {s.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ============================================================ Was noch frei ist */

export function CapacityPanel({
  tripId,
  cells,
  cities,
  pool,
  openBookings,
}: {
  tripId: string;
  cells: DayCell[];
  cities: CityLoad[];
  pool: Place[];
  openBookings: { id: string; kind: 'place' | 'hotel' | 'journey'; label: string; sub: string; price: number | null; url: string | null }[];
}) {
  const store = useStore();
  const { open } = useEditor();
  const freeDays = cells.filter((c) => c.empty && !c.travelOnly);
  const lightDays = cells.filter((c) => c.count > 0 && c.count * 2 < DAY_CAPACITY).length;
  const maxPlaces = Math.max(1, ...cities.map((c) => c.places));

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <SectionTitle
          title="Was noch verfügbar ist"
          icon="🈳"
          hint={pool.length ? `${plural(pool.length, 'Punkt', 'Punkte')} warten auf einen Tag · ${plural(freeDays.length, 'Tag', 'Tage')} noch ganz frei` : 'Jeder Wunsch hat einen Tag – es bleiben trotzdem Plätze frei.'}
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: 'Tage ganz frei', value: freeDays.length, hint: freeDays.length ? fmtDate(freeDays[0].date, { day: '2-digit', month: '2-digit' }) + ' bis ' + fmtDate(freeDays[freeDays.length - 1].date, { day: '2-digit', month: '2-digit' }) : '—' },
            { label: 'Tage fast frei', value: lightDays, hint: 'ein oder zwei Punkte' },
            {
              label: 'Plätze insgesamt',
              value: `${cells.reduce((a, c) => a + c.free, 0)}`,
              hint: `${plural(cells.length, 'Tag', 'Tage')} à ${DAY_CAPACITY} Punkte`,
            },
            { label: 'Ohne Tag', value: pool.length, hint: pool.length ? 'in der Aktivitätsliste' : 'alles platziert' },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-2">
              <p className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">{s.label}</p>
              <p className="mt-0.5 text-[17px] font-semibold leading-tight text-white">{s.value}</p>
              <p className="text-[11px] text-slate-500">{s.hint}</p>
            </div>
          ))}
        </div>

        {freeDays.length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {freeDays.slice(0, 14).map((c) => (
              <a key={c.date} href={`#day-${c.date}`} className="chip bg-white/[0.05] text-slate-200 ring-white/10 hover:bg-white/[0.1]">
                {fmtDate(c.date, { weekday: 'short', day: '2-digit', month: '2-digit' })}
                {c.city ? ` · ${c.city}` : ''}
              </a>
            ))}
          </div>
        ) : null}

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Wo noch Platz ist</p>
            <ul className="space-y-1">
              {cities.map((c) => (
                <li key={c.city} className="grid grid-cols-[76px_1fr_auto] items-center gap-2 text-[12px]">
                  <span className="truncate text-slate-300" title={`${c.places} Punkte an ${plural(c.days, 'Tag', 'Tagen')} · ${c.nights ? plural(c.nights, 'Nacht', 'Nächte') : 'keine Unterkunft'}`}>
                    {c.city}
                  </span>
                  <span className="flex h-2.5 items-center gap-[2px] overflow-hidden rounded-full bg-white/[0.06]">
                    <span
                      className={cx('block h-full rounded-full', c.fit === 'tight' ? 'bg-shu-500' : c.fit === 'loose' ? 'bg-matcha-500/70' : 'bg-shu-400/80')}
                      style={{ width: `${Math.max(5, (c.places / maxPlaces) * 100)}%` }}
                    />
                  </span>
                  <span className="whitespace-nowrap tabular-nums text-slate-400">
                    {c.places} ·{' '}
                    <span className={c.fit === 'tight' ? 'text-shu-200' : c.fit === 'loose' ? 'text-matcha-200/90' : 'text-slate-300'}>{c.perDay}/Tag</span>
                    {c.noHotel ? <span className="text-amber-200/90"> · Bett?</span> : <span className="text-slate-500"> · {c.nights}N</span>}
                    {c.pool ? <span className="text-slate-500"> · +{c.pool} Pool</span> : null}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
              Punkte pro Stadt geteilt durch geplante Tage. <b className="text-matcha-200/90">Unter 1,6 pro Tag</b> ist noch Raum für die Liste, <b className="text-shu-200">über 3,5</b> wird es ein Hetz-Programm. „Bett?“ heißt: Stadt ohne Unterkunft eingetragen.
            </p>
          </div>

          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Offene Buchungen · Verfügbarkeit prüfen</p>
            {!openBookings.length ? (
              <Empty title="Alles gebucht ✅" hint="Keine Unterkunft und keine Fahrt wartet noch auf eine Buchung." />
            ) : (
              <ul className="space-y-1">
                {openBookings.slice(0, 7).map((b) => (
                  <li key={`${b.kind}-${b.id}`} className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5">
                    <span aria-hidden>{b.kind === 'hotel' ? '🏨' : b.kind === 'journey' ? '🎫' : categoryMeta('Organisation').icon}</span>
                    <button onClick={() => open(b.kind === 'hotel' ? { kind: 'hotel', id: b.id } : b.kind === 'journey' ? { kind: 'journey', id: b.id } : { kind: 'place', id: b.id })} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-[12.5px] font-medium text-slate-100">{b.label}</span>
                      <span className="block truncate text-[11px] text-slate-500">{b.sub}</span>
                    </button>
                    <Money value={b.price} className="text-[12px]" />
                    {b.url ? (
                      <LinkTag href={b.url} title="Buchungsseite öffnen">
                        ↗
                      </LinkTag>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {openBookings.length > 7 ? <p className="mt-1 text-[11px] text-slate-500">… und {openBookings.length - 7} weitere offene Punkte.</p> : null}
          </div>
        </div>
      </Card>
    </div>
  );
}
