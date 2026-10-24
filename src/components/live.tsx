'use client';

/**
 * Die Unterwegs-Schicht: für die Hosentasche gebaut, mit genau einer Bewegung pro Klick.
 *
 * Ein Ring mit der Tagesnummer sagt, wo in der Reise du stehst. Die farbige Leiste darunter
 * ist die ganze Reise – ein Feld pro Tag, so gefärbt wie das Bett der Nacht. Getippt wird
 * nur ✓; alles andere klappt die Zeile selbst auf.
 */
import React, { useEffect, useRef, useState } from 'react';
import { categoryMeta, mapsUrl } from '../lib/categories';
import { fmtDate, plural } from '../lib/format';
import type { Place } from '../lib/types';
import { cx } from './ui';

/* ── Fortschritt ──────────────────────────────────────────────────────────── */

/** Tagesnummer im Ring: der Ring ist der Fortschritt des Tages */
export function DayRing({ tag, total, done, count, color, size = 62 }: { tag: number; total: number; done: number; count: number; color: string; size?: number }) {
  const r = (size - 7) / 2;
  const circ = 2 * Math.PI * r;
  const pct = count > 0 ? Math.min(1, done / count) : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} data-ring={String(count ? pct : 0)}>
      <svg width={size} height={size} aria-hidden className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={5} />
        {count ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ * (1 - pct)}
            className="ring-fill"
          />
        ) : null}
      </svg>
      <span className="absolute inset-0 grid place-items-center leading-none">
        <b className="text-[19px] font-semibold text-white tabular-nums">{tag}</b>
        <span className="mt-0.5 text-[8px] uppercase tracking-wider text-slate-400">von {total || '?'}</span>
      </span>
    </div>
  );
}

/** Die ganze Reise als Leiste – ein Feld pro Tag, gefärbt nach dem Bett der Nacht */
export function TripBar({
  days,
  viewed,
  today,
  colorFor,
  onPick,
}: {
  days: string[];
  viewed: string;
  today: string;
  colorFor: (date: string) => { color: string; bed: boolean; last?: boolean };
  onPick: (date: string) => void;
}) {
  return (
    <div className="flex items-stretch gap-[3px]" data-tripbar={days.length} role="group" aria-label="die ganze Reise – ein Feld pro Tag">
      {days.map((d) => {
        const { color, bed, last } = colorFor(d);
        const isViewed = d === viewed;
        const isToday = d === today;
        return (
          <button
            key={d}
            type="button"
            data-tripday={d}
            data-bed={last ? 'abreise' : bed ? 'ja' : 'nein'}
            onClick={() => onPick(d)}
            title={`${fmtDate(d, { weekday: 'short', day: '2-digit', month: '2-digit' })}${last ? ' · Abreise, keine Nacht' : bed ? '' : ' · Nacht ohne Bett'}${isToday ? ' · heute' : ''}`}
            aria-label={`Tag ${fmtDate(d, { day: '2-digit', month: '2-digit' })}`}
            aria-current={isToday ? 'date' : undefined}
            className={cx('trip-seg', isViewed && 'is-viewed', isToday && 'is-today', last && 'is-last')}
            style={{ background: bed ? color : undefined }}
          />
        );
      })}
    </div>
  );
}

/* ── Tag blättern ──────────────────────────────────────────────────────────── */

export function DayNav({
  viewed,
  isToday,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onToday,
  label,
}: {
  viewed: string;
  isToday: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5" data-daynav>
      <button type="button" className="day-arrow" onClick={onPrev} disabled={!canPrev} aria-label="einen Tag zurück">
        ◀
      </button>
      <div className="min-w-0 flex-1 text-center">
        <p className="truncate text-[13px] font-semibold text-white">{label}</p>
        <p className="text-[10.5px] uppercase tracking-wider text-slate-400">{fmtDate(viewed, { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
      </div>
      <button type="button" className="day-arrow" onClick={onNext} disabled={!canNext} aria-label="einen Tag vor">
        ▶
      </button>
      {!isToday ? (
        <button type="button" className="btn-today pop-in" onClick={onToday} title="zurück zum laufenden Tag">
          heute
        </button>
      ) : null}
    </div>
  );
}

/* ── der eine Auftrag: als nächstes ────────────────────────────────────────── */

export function NextUpCard({
  place,
  nr,
  total,
  offen,
  onDone,
  route,
  note,
  eyebrow,
  when = 'heute',
  cardRef,
}: {
  place: Place;
  nr: number;
  total: number;
  offen: number;
  onDone: () => void;
  /** die Tagesroute als fertiger Link – nur ab zwei Stopps */
  route?: { href: string; stops: number } | null;
  /** auf anderen Tagen als heute ist es kein „als nächstes“, sondern der erste Punkt */
  eyebrow?: string;
  /** „heute“ oder das Datum des betrachteten Tages */
  when?: string;
  note?: string | null;
  cardRef?: React.Ref<HTMLDivElement>;
}) {
  const meta = categoryMeta(place.category);
  const ticket = place.ticket_status === 'noetig';
  return (
    <div ref={cardRef} className="card nextup" data-nextup={place.id} style={{ '--nc': meta.color } as React.CSSProperties}>
      <span className="nextup-rail" aria-hidden />
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {eyebrow ?? `als nächstes · stelle ${nr} von ${total}`}
      </p>
      <div className="mt-2 flex items-start gap-3">
        <span className="nextup-icon" aria-hidden style={{ background: `${meta.color}2b`, boxShadow: `inset 0 0 0 1px ${meta.color}70` }}>
          {meta.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold leading-snug text-white">{place.name}</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-slate-300">
            {place.city || '—'}
            {note ? <span className="text-slate-400"> · {note}</span> : null}
          </p>
          {ticket ? (
            <p className="mt-1 inline-flex rounded-lg bg-amber-400/15 px-1.5 py-0.5 text-[11.5px] text-amber-100">
              🎫 Ticket nötig{place.ticket_note ? ` – ${place.ticket_note}` : ''}
            </p>
          ) : null}
        </div>
        <button type="button" className="big-check" onClick={onDone} data-done={place.id} aria-label={`${place.name} erledigt`} title="erledigt abhaken">
          ✓
        </button>
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <a href={mapsUrl(place)} target="_blank" rel="noreferrer" className="btn-primary !flex-1 !px-3 !py-2.5 !text-[13.5px]">
          🗺️ Hinfinden
        </a>
        {route ? (
          <a href={route.href} target="_blank" rel="noreferrer" className="btn-ghost !px-3 !py-2.5 !text-[13px]" title="der ganze Tag als Route">
            🧭 {plural(route.stops, 'Stopp', 'Stopps')}
          </a>
        ) : null}
      </div>
      {offen > 1 ? <p className="mt-2 text-center text-[11px] text-slate-500">noch {plural(offen - 1, 'Punkt', 'Punkte')} {when}</p> : null}
    </div>
  );
}

/** derselbe Auftrag, wenn die Karte hoch gescrollt ist – immer mit dem Daumen erreichbar */
export function StickyNext({ place, visible, onDone }: { place: Place | null; visible: boolean; onDone: () => void }) {
  const meta = categoryMeta(place?.category);
  return (
    <div className={cx('sticky-next', visible && place && 'is-on')} data-sticky={visible && place ? 'on' : 'off'}>
      <div className="card flex items-center gap-2.5 p-2.5" style={{ borderColor: `${meta.color}55`, background: 'rgba(26,31,43,0.94)' }}>
        <span className="nextup-icon !h-8 !w-8 !text-[15px]" aria-hidden style={{ background: `${meta.color}2b`, boxShadow: `inset 0 0 0 1px ${meta.color}70` }}>
          {meta.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium text-white">{place?.name ?? ''}</p>
          <p className="truncate text-[10.5px] uppercase tracking-wide text-slate-400">als nächstes · tippe ✓</p>
        </div>
        <button type="button" className="big-check !h-11 !w-11" onClick={onDone} aria-label="erledigt" title="erledigt">
          ✓
        </button>
      </div>
    </div>
  );
}

/** die Karte ist außerhalb des Blicks? dann darf die Leiste unten helfen */
export function useOutOfView(active: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [out, setOut] = useState(false);
  useEffect(() => {
    setOut(false);
    if (!active || typeof IntersectionObserver === 'undefined') return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => setOut(!entries.some((e) => e.isIntersecting)), { threshold: 0, rootMargin: '-10px 0px -40% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [active]);
  return { ref, out };
}

/* ── eine Zeile im Vorbeigehen ─────────────────────────────────────────────── */

export function LiveRow({
  place,
  nr,
  total,
  index,
  expanded,
  justDone,
  onExpand,
  onToggle,
  onEdit,
  onUp,
  onDown,
}: {
  place: Place;
  nr: number;
  total: number;
  index: number;
  expanded: boolean;
  justDone: boolean;
  onExpand: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onUp?: () => void;
  onDown?: () => void;
}) {
  const done = place.booking_status === 'erledigt';
  const meta = categoryMeta(place.category);
  const ticket = place.ticket_status && place.ticket_status !== 'unklar' && place.ticket_status !== 'keins' ? place.ticket_status : null;
  return (
    <li
      className={cx('live-row rise', done && 'is-done', justDone && 'done-sweep')}
      style={{ ['--d' as string]: `${Math.min(index, 9) * 34}ms`, ['--rc' as string]: meta.color } as React.CSSProperties}
      data-row={place.id}
      data-done={done ? 'ja' : 'nein'}
    >
      <div className="flex items-center gap-3 py-2.5">
        <button
          type="button"
          onClick={onToggle}
          className={cx('tick', done && 'is-on', justDone && 'check-pop')}
          aria-label={done ? 'wieder offen' : 'erledigt'}
          title={done ? 'wieder offen' : 'erledigt'}
        >
          <span aria-hidden>✓</span>
        </button>
        <button type="button" onClick={onExpand} className="min-w-0 flex-1 text-left" aria-expanded={expanded}>
          <span className="flex items-baseline gap-2">
            <span className={cx('text-[11px] tabular-nums', done ? 'text-slate-600' : 'text-slate-400')}>
              {nr}/{total}
            </span>
            <span className={cx('min-w-0 flex-1 truncate text-[15.5px] font-medium leading-snug', done ? 'text-slate-500 line-through' : 'text-white')}>
              {place.name}
            </span>
            <span className={cx('shrink-0 text-[11px] text-slate-500 transition-transform', expanded && 'rotate-180')} aria-hidden>
              ⌄
            </span>
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11.5px] text-slate-400">
            <span aria-hidden style={{ color: meta.color }}>
              {meta.icon}
            </span>
            <span>{meta.label}</span>
            {place.city ? <span className="text-slate-600">· {place.city}</span> : null}
            {ticket ? <span className={cx('chip !py-0 !text-[10px]', ticket === 'gekauft' ? 'bg-emerald-500/15 text-emerald-100' : 'bg-amber-500/15 text-amber-100')}>{ticket === 'gekauft' ? '🎫 gekauft' : '🎫 besorgen'}</span> : null}
            {place.price_eur ? <span className="text-slate-500">· {place.price_eur} €</span> : null}
          </span>
        </button>
      </div>
      {expanded ? (
        <div className="row-detail pop-in">
          {place.notes ? <p className="text-[12.5px] leading-relaxed text-slate-300">{place.notes}</p> : <p className="text-[12.5px] text-slate-500">keine Notiz</p>}
          {place.ticket_note ? <p className="text-[12.5px] text-amber-100/90">🎫 {place.ticket_note}</p> : null}
          {place.price_note ? <p className="text-[12.5px] text-slate-400">💶 {place.price_note}</p> : null}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <a href={mapsUrl(place)} target="_blank" rel="noreferrer" className="btn-ghost !px-2.5 !py-1.5 !text-[12.5px]">
              🗺️ Karte
            </a>
            {place.booking_url ? (
              <a href={place.booking_url.startsWith('http') ? place.booking_url : `https://${place.booking_url}`} target="_blank" rel="noreferrer" className="btn-ghost !px-2.5 !py-1.5 !text-[12.5px]">
                🔗 Buchung
              </a>
            ) : null}
            <span className="ml-auto flex items-center gap-0.5">
              <button type="button" className="icon-btn" onClick={onEdit} title="bearbeiten">
                ✎
              </button>
              <button type="button" className="icon-btn" onClick={onUp} disabled={!onUp} title="eine Stelle früher">
                ▲
              </button>
              <button type="button" className="icon-btn" onClick={onDown} disabled={!onDown} title="eine Stelle später">
                ▼
              </button>
            </span>
          </div>
        </div>
      ) : null}
    </li>
  );
}

/* ── die nächsten Tage als Chips ───────────────────────────────────────────── */

export function PlanChip({
  date,
  label,
  count,
  city,
  color,
  change,
  noBed,
  onOpen,
  index,
}: {
  date: string;
  label: string;
  count: number;
  city: string | null;
  color: string;
  change?: { from: string; to: string } | null;
  noBed?: boolean;
  onOpen: () => void;
  index: number;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      data-chip={date}
      className="plan-chip rise"
      style={{ ['--d' as string]: `${120 + index * 60}ms`, ['--cc' as string]: color } as React.CSSProperties}
    >
      <span className="flex items-baseline gap-1.5">
        <b className="text-[13px] font-semibold text-white">{label}</b>
        <span className="text-[10.5px] text-slate-400">{fmtDate(date, { day: '2-digit', month: '2-digit' })}</span>
      </span>
      <span className="mt-1 block min-w-0 truncate text-[11.5px] text-slate-300">{count ? plural(count, 'Punkt', 'Punkte') : 'frei'}</span>
      <span className="mt-1 flex items-center gap-1 text-[10.5px] text-slate-400">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
        <span className="min-w-0 truncate">{city ?? 'ohne Ort'}</span>
      </span>
      {change ? <span className="mt-1 block min-w-0 truncate text-[10.5px] text-shu-200">🔀 {change.from} → {change.to}</span> : null}
      {noBed ? <span className="mt-1 block text-[10.5px] text-amber-200/80">🏨 ohne Bett</span> : null}
    </button>
  );
}
