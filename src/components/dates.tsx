'use client';

/**
 * Datums-Auswahl zum Anklicken statt Tippen:
 *   DateField      – ein Tag (Aktivität, Ausgabe, Etappe)
 *   DateRangeField – erst Starttag klicken, dann Endtag (Hotel, Flug, Reise)
 * Der Kalender klappt unter dem Feld auf – nichts wird vom Modal abgeschnitten.
 */
import React, { useMemo, useState } from 'react';
import { addDays, daysBetween, fmtDate, today } from '../lib/format';
import { cx } from './ui';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const d = new Date(`${s.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};
const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const spanLabel = (n: number, unit: 'Nacht' | 'Tag') => (unit === 'Nacht' ? `${n} ${n === 1 ? 'Nacht' : 'Nächte'}` : `${n} ${n === 1 ? 'Tag' : 'Tage'}`);

function useMonthCursor(initial?: string | null) {
  const base = parse(initial) ?? new Date();
  const [cursor, setCursor] = useState(() => new Date(base.getFullYear(), base.getMonth(), 1));
  const move = (delta: number) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  return { cursor, setCursor, move };
}

function Calendar({
  cursor,
  onMove,
  onPick,
  inRange,
  edges,
  minDate,
  maxDate,
  quick,
  footer,
}: {
  cursor: Date;
  onMove: (delta: number) => void;
  onPick: (d: string) => void;
  /** alle Daten, die farblich als Zeitraum markiert werden (inkl. Ränder) */
  inRange?: [string, string] | null;
  /** Start / Ende des Zeitraums (oder der einzelne gewählte Tag) */
  edges?: { start?: string | null; end?: string | null };
  minDate?: string | null;
  maxDate?: string | null;
  quick?: { label: string; run: () => void }[];
  footer?: React.ReactNode;
}) {
  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7; // Montag = 0
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  const inSpan = (s: string) => Boolean(inRange && inRange[0] && inRange[1] && s >= inRange[0] && s <= inRange[1]);
  const disabled = (s: string) => Boolean((minDate && s < minDate) || (maxDate && s > maxDate));
  const monthOfCursor = cursor.getMonth();

  return (
    <div className="mt-1.5 rounded-xl border border-white/[0.09] bg-ink-900/95 p-2 shadow-[0_18px_50px_-24px_rgba(0,0,0,0.9)]">
      <div className="mb-1 flex items-center gap-1">
        <button type="button" className="btn-quiet !px-1.5" onClick={() => onMove(-1)} aria-label="Voriger Monat">
          ‹
        </button>
        <span className="flex-1 text-center text-[12px] font-semibold text-slate-200">{monthLabel}</span>
        <button type="button" className="btn-quiet !px-1.5" onClick={() => onMove(1)} aria-label="Nächster Monat">
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-[2px] text-center text-[9.5px] uppercase text-slate-500">
        {WD.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="mt-[2px] grid grid-cols-7 gap-[2px]">
        {cells.map((d) => {
          const s = iso(d);
          const isEdge = edges?.start === s || edges?.end === s;
          const off = disabled(s);
          return (
            <button
              key={s}
              type="button"
              disabled={off}
              onClick={() => onPick(s)}
              aria-label={fmtDate(s, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              aria-pressed={isEdge}
              className={cx(
                'h-[26px] rounded-md text-[11.5px] tabular-nums transition',
                d.getMonth() !== monthOfCursor && 'text-slate-600',
                inSpan(s) && !isEdge && 'bg-shu-500/[0.18] text-shu-100',
                isEdge ? 'bg-shu-500 font-semibold text-white' : 'hover:bg-white/[0.09]',
                s === today() && !isEdge && 'ring-1 ring-inset ring-white/25',
                (d.getDay() === 0 || d.getDay() === 6) && !isEdge && !inSpan(s) && 'text-slate-300',
                off && 'cursor-not-allowed opacity-30 hover:bg-transparent',
              )}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
      {quick?.length ? (
        <div className="mt-1.5 flex flex-wrap gap-1 border-t border-white/[0.07] pt-1.5">
          {quick.map((b) => (
            <button key={b.label} type="button" onClick={b.run} className="chip bg-white/[0.05] text-slate-200 ring-white/10 hover:bg-white/[0.1]">
              {b.label}
            </button>
          ))}
        </div>
      ) : null}
      {footer ? <div className="mt-1.5 border-t border-white/[0.07] pt-1.5 text-[11px] text-slate-400">{footer}</div> : null}
    </div>
  );
}

export function DateField({
  label,
  value,
  onChange,
  hint,
  name,
  minDate,
  maxDate,
  startHint = 'Tag wählen',
  quickDates,
  tripBounds,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  hint?: React.ReactNode;
  /** wenn gesetzt: verstecktes <input type=date>, damit der Wert ein echtes Formularfeld ist */
  name?: string;
  minDate?: string | null;
  maxDate?: string | null;
  startHint?: string;
  /** Schnellzugang zu den Reisetagen – erscheint über dem Kalender */
  quickDates?: string[];
  tripBounds?: [string | null, string | null];
}) {
  const [open, setOpen] = useState(false);
  const { cursor, move } = useMonthCursor(value ?? tripBounds?.[0] ?? null);

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="label !mb-0">{label}</span>
        {hint ? <span className="text-[10.5px] text-slate-500">{hint}</span> : null}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cx(
            'input flex items-center justify-between gap-2 text-left',
            !value && 'text-slate-500',
            open && 'border-shu-400/50',
          )}
          aria-expanded={open}
        >
          <span className="min-w-0 flex-1 truncate">{value ? fmtDate(value, { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' }) : startHint}</span>
          <span aria-hidden className="shrink-0 text-[13px] opacity-60">
            📅
          </span>
        </button>
        {value ? (
          <button type="button" className="btn-quiet shrink-0 !px-1.5" title="Datum leeren" onClick={() => onChange(null)}>
            ✕
          </button>
        ) : null}
        {name ? (
          <input
            type="date"
            name={name}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
          />
        ) : null}
      </div>
      {open ? (
        <Calendar
          cursor={cursor}
          onMove={move}
          onPick={(d) => {
            onChange(d);
            setOpen(false);
          }}
          edges={{ start: value }}
          minDate={minDate}
          maxDate={maxDate}
          quick={
            quickDates?.length
              ? quickDates.slice(0, 10).map((d) => ({ label: `${fmtDate(d, { weekday: 'short' })} ${d.slice(8, 10)}.${d.slice(5, 7)}.`, run: () => (onChange(d), setOpen(false)) }))
              : undefined
          }
          footer={
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" className="chip bg-white/[0.05] text-slate-300 ring-white/10 hover:bg-white/10" onClick={() => (onChange(today()), setOpen(false))}>
                heute
              </button>
              {tripBounds?.[0] ? (
                <button type="button" className="chip bg-white/[0.05] text-slate-300 ring-white/10 hover:bg-white/10" onClick={() => (onChange(tripBounds[0]), setOpen(false))}>
                  Reiseanfang
                </button>
              ) : null}
              <span className="ml-auto text-slate-500">
                {tripBounds?.[0] && tripBounds[1] ? `Reise: ${fmtDate(tripBounds[0], { day: '2-digit', month: '2-digit' })}–${fmtDate(tripBounds[1], { day: '2-digit', month: '2-digit' })}` : ''}
              </span>
            </div>
          }
        />
      ) : null}
    </div>
  );
}

export function DateRangeField({
  label,
  start,
  end,
  onChange,
  unit = 'Nacht',
  minDate,
  maxDate,
  hint,
  tripBounds,
}: {
  label: string;
  start: string | null;
  end: string | null;
  onChange: (start: string | null, end: string | null) => void;
  unit?: 'Nacht' | 'Tag';
  minDate?: string | null;
  maxDate?: string | null;
  hint?: React.ReactNode;
  tripBounds?: [string | null, string | null];
}) {
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const { cursor, move } = useMonthCursor(start ?? tripBounds?.[0] ?? null);
  const count = start && end ? Math.max(0, daysBetween(start, end) - 1) : 0;
  const days = start && end ? daysBetween(start, end) : 0;

  const pick = (d: string) => {
    if (!armed || !start || (start && end)) {
      onChange(d, null);
      setArmed(true);
      return;
    }
    const a = d < start ? d : start;
    const b = d < start ? start : d;
    onChange(a, b);
    setArmed(false);
    setOpen(false);
  };

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <span className="label !mb-0">{label}</span>
        <span className={cx('text-[11px]', armed && !end ? 'text-shu-200' : 'text-slate-500')}>
          {armed && !end ? ' jetzt das Ende klicken' : start && end ? `${count} ${unit === 'Nacht' ? (count === 1 ? 'Nacht' : 'Nächte') : `${count} ${unit}e`}` : (hint ?? 'zwei Tage anklicken')}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            setArmed(false);
          }}
          className={cx('input flex items-center justify-between gap-1 text-left min-w-0', !start && 'text-slate-500', armed && 'border-shu-400/60')}
        >
          <span className="min-w-0 flex-1 truncate">
            <span className="mr-1 text-[10px] uppercase tracking-wide text-slate-500">Start</span>
            {start ? fmtDate(start, { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' }) : 'wählen'}
          </span>
          <span aria-hidden className="opacity-60">
            📅
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setArmed(Boolean(start && !end));
          }}
          className={cx('input flex items-center justify-between gap-1 text-left min-w-0', !end && 'text-slate-500')}
        >
          <span className="min-w-0 flex-1 truncate">
            <span className="mr-1 text-[10px] uppercase tracking-wide text-slate-500">Ende</span>
            {end ? fmtDate(end, { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' }) : armed ? 'Tag wählen …' : 'wählen'}
          </span>
          <span aria-hidden className="opacity-60">
            📅
          </span>
        </button>
      </div>
      {start ? (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
          <span className="tabular-nums">
            {fmtDate(start, { day: '2-digit', month: '2-digit', year: 'numeric' })}
            {end ? ` → ${fmtDate(end, { day: '2-digit', month: '2-digit', year: 'numeric' })}` : ''}
            {start && end ? ` · ${days} ${days === 1 ? 'Tag' : 'Tage'}` : ''}
          </span>
          <button type="button" className="chip bg-white/[0.05] text-slate-300 ring-white/10 hover:bg-white/10" onClick={() => (onChange(null, null), setArmed(false))}>
            leeren
          </button>
        </div>
      ) : null}
      {open ? (
        <Calendar
          cursor={cursor}
          onMove={move}
          onPick={pick}
          inRange={start && end ? [start, end] : null}
          edges={{ start, end }}
          minDate={minDate}
          maxDate={maxDate}
          quick={
            start
              ? [
                  ...(unit === 'Nacht' ? [1, 2, 3, 5, 7] : [0, 1, 2, 3, 7]).map((n) => ({
                    label: n ? `+${n} ${spanLabel(n, unit)}` : 'nur dieser Tag',
                    run: () => {
                      onChange(start, addDays(start, n));
                      setArmed(false);
                      setOpen(false);
                    },
                  })),
                  ...(maxDate && maxDate > start
                    ? [
                        {
                          label: `bis Reiseende (${spanLabel(Math.max(0, daysBetween(start, maxDate) - 1), unit)})`,
                          run: () => {
                            onChange(start, maxDate);
                            setArmed(false);
                            setOpen(false);
                          },
                        },
                      ]
                    : []),
                ]
              : undefined
          }
          footer={
            <div className="flex flex-wrap items-center gap-2">
              <span>
                {armed && !end ? (
                  <>
                    <b className="text-shu-200">Start {fmtDate(start, { day: '2-digit', month: '2-digit' })}</b> – jetzt den Endtag anklicken
                  </>
                ) : (
                  <>Erst den Starttag, dann den Endtag klicken</>
                )}
              </span>
              <button
                type="button"
                className="ml-auto chip bg-white/[0.05] text-slate-300 ring-white/10 hover:bg-white/10"
                onClick={() => (onChange(start, start ? addDays(start, unit === 'Nacht' ? 1 : 0) : null), setArmed(false), setOpen(false))}
              >
                ein Tag
              </button>
            </div>
          }
        />
      ) : null}
    </div>
  );
}
