'use client';

/**
 * Tagesband: 07–23 Uhr als Leiste. Farbige Abschnitte = verplant (Kategorie-Farbe),
 * Lücken = Zeit, die noch frei ist. Ein Punkt ohne Uhrzeit sitzt dort, wo die
 * Tageszeit ihn vermutet – gestrichelt, damit der Unterschied zu sehen bleibt.
 *
 * Mit `onMove`/`onResize` wird das Band zum Zeitplan-Werkzeug: einen Block ziehen
 * verschiebt ihn (auf 15-Minuten-Schritte), am rechten Rand zieht man die Dauer, ein
 * Klick in eine Lücke behält die alte Bedeutung. Pfeiltasten auf einem Block gehen
 * 15 Minuten, mit ⇧ eine Stunde.
 */
import React, { useRef, useState } from 'react';
import type { Place } from '../lib/types';
import { DAY_END, DAY_START, DAY_SPAN, freeWindows, fmtWindow, minToTime, plannedMinutes, windowsOf } from '../lib/dayplan';
import { categoryMeta } from '../lib/categories';
import { cx } from './ui';

const pct = (min: number) => ((min - DAY_START) / DAY_SPAN) * 100;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const snap = (v: number) => Math.round(v / 15) * 15;

type Drag = { id: string; mode: 'move' | 'resize'; originStart: number; originEnd: number; fromX: number; start: number; end: number; moved: boolean };

export function DayBar({
  places,
  height = 12,
  ticks = false,
  className,
  onPickSlot,
  onMove,
  onResize,
}: {
  places: Place[];
  height?: number;
  ticks?: boolean;
  className?: string;
  /** Klick in eine Lücke: Zeit vorschlagen (Minuten ab Mitternacht) */
  onPickSlot?: (minute: number) => void;
  /** Block gezogen: neuer Anfang (Minuten ab Mitternacht) */
  onMove?: (placeId: string, minute: number) => void;
  /** Rand gezogen: neue Dauer in Minuten */
  onResize?: (placeId: string, minutes: number) => void;
}) {
  const wins = windowsOf(places);
  const free = freeWindows(places);
  const minutes = plannedMinutes(places);
  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const grabbable = Boolean(onMove || onResize);

  const fromDelta = (e: React.PointerEvent, origin: Drag) => {
    const box = trackRef.current?.getBoundingClientRect();
    if (!box || !box.width) return 0;
    return snap(((e.clientX - origin.fromX) / box.width) * DAY_SPAN);
  };

  const begin = (e: React.PointerEvent, id: string, mode: 'move' | 'resize', start: number, end: number, whole = false) => {
    if (!grabbable || whole) return;
    if (mode === 'move' && !onMove) return;
    if (mode === 'resize' && !onResize) return;
    const el = e.currentTarget as HTMLElement;
    if (typeof el.setPointerCapture === 'function' && typeof e.pointerId === 'number') {
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* Zeiger schon wieder weg – ziehen klappt trotzdem */
      }
    }
    setDrag({ id, mode, originStart: start, originEnd: end, fromX: e.clientX, start, end, moved: false });
  };

  const dragTo = (e: React.PointerEvent) => {
    if (!drag) return;
    const delta = fromDelta(e, drag);
    const len = drag.originEnd - drag.originStart;
    if (drag.mode === 'move') {
      const start = clamp(drag.originStart + delta, DAY_START, DAY_END - len);
      setDrag({ ...drag, start, end: start + len, moved: drag.moved || start !== drag.originStart });
    } else {
      const end = clamp(drag.originEnd + delta, drag.originStart + 15, DAY_END);
      setDrag({ ...drag, end, moved: drag.moved || end !== drag.originEnd });
    }
  };

  const finish = () => {
    const d = drag;
    setDrag(null);
    if (!d || !d.moved) return;
    if (d.mode === 'move') onMove?.(d.id, d.start);
    else onResize?.(d.id, d.end - d.start);
  };

  const nudge = (e: React.KeyboardEvent, place: Place, start: number, end: number) => {
    if (!onMove || drag) return;
    const step = e.shiftKey ? 60 : 15;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      onMove(place.id, clamp(snap(start + (e.key === 'ArrowRight' ? step : -step)), DAY_START, DAY_END - (end - start)));
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      onMove(place.id, DAY_START);
    }
  };

  return (
    <div className={cx('relative select-none', className)}>
      <div ref={trackRef} className={cx('w-full overflow-hidden rounded-full bg-white/[0.06]', drag && 'cursor-grabbing')} style={{ height }}>
        {free.map(([a, b]) => (
          <div
            key={`f${a}`}
            className={cx('absolute top-0 h-full rounded-full bg-emerald-400/[0.10]', onPickSlot && !drag && 'cursor-pointer hover:bg-emerald-400/25')}
            style={{ left: `${pct(a)}%`, width: `${pct(b) - pct(a)}%` }}
            title={`frei ${fmtWindow(a, b)}${onPickSlot ? ' – klicken' : ''}`}
            onClick={
              onPickSlot
                ? (e) => {
                    if (drag) return;
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                    onPickSlot(clamp(snap(a + (b - a) * ratio), DAY_START, DAY_END));
                  }
                : undefined
            }
          />
        ))}
        {wins.map(({ place, win }) => {
          const active = drag?.id === place.id;
          const start = active ? drag!.start : win.start;
          const end = active ? drag!.end : win.end;
          const color = categoryMeta(place.category).color;
          const whole = place.time_slot === 'Ganzer Tag' || win.fullDay;
          return (
            <div
              key={place.id}
              role={onMove ? 'slider' : undefined}
              aria-label={onMove ? `${place.name} – ${fmtWindow(start, end)}, mit den Pfeiltasten verschieben` : undefined}
              aria-valuetext={onMove ? `${minToTime(start)} Uhr` : undefined}
              tabIndex={onMove ? 0 : undefined}
              className={cx(
                'absolute top-0 h-full outline-none',
                win.explicit || active ? '' : 'opacity-55',
                active ? 'z-10 shadow-[0_0_0_2px_rgba(255,255,255,0.85)]' : '',
                grabbable && !whole ? 'cursor-grab' : '',
              )}
              style={{
                left: `${pct(start)}%`,
                width: `${Math.max(1.2, pct(end) - pct(start))}%`,
                background: color,
                borderRadius: 999,
                border: active ? '1px solid rgba(255,255,255,.9)' : win.explicit ? 'none' : '1px dashed rgba(255,255,255,.35)',
                touchAction: grabbable ? 'pan-y' : undefined,
              }}
              title={`${place.name} · ${fmtWindow(win.start, win.end)}${win.explicit ? '' : ' (geschätzt, keine Uhrzeit)'}${onMove ? ' – ziehen zum Verschieben, am rechten Rand für die Dauer' : ''}`}
              onPointerDown={(e) => begin(e, place.id, 'move', win.start, win.end, whole)}
              onPointerMove={dragTo}
              onPointerUp={finish}
              onPointerCancel={finish}
              onKeyDown={(e) => nudge(e, place, win.start, win.end)}
            >
              {onResize && !whole ? (
                <span
                  role="separator"
                  aria-label="Dauer ändern"
                  className="absolute right-0 top-0 h-full w-2 cursor-ew-resize rounded-r-full"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.5))' }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    begin(e, place.id, 'resize', win.start, win.end, whole);
                  }}
                  onPointerMove={(e) => {
                    e.stopPropagation();
                    dragTo(e);
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    finish();
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      {drag ? (
        <span
          className="pointer-events-none absolute z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink-800 px-1.5 py-0.5 text-[10.5px] font-medium tabular-nums text-white shadow-lg ring-1 ring-white/20"
          style={{ left: `${clamp(pct(drag.mode === 'move' ? drag.start : drag.end), 6, 94)}%`, top: height + 3 }}
        >
          {drag.mode === 'move' ? fmtWindow(drag.start, drag.end) : `${Math.round((drag.end - drag.start) / 60 * 10) / 10} h`}
        </span>
      ) : null}
      {ticks ? (
        <div className="mt-0.5 flex justify-between text-[9.5px] tabular-nums text-slate-500">
          {[7, 10, 13, 16, 19, 22].map((h) => (
            <span key={h}>{h} Uhr</span>
          ))}
        </div>
      ) : null}
      {!wins.length ? <p className="mt-0.5 text-[10.5px] text-slate-500">Ganzer Tag frei · {fmtWindow(DAY_START, DAY_END)}</p> : null}
      {wins.length ? (
        <p className="mt-0.5 text-[10.5px] text-slate-500">
          {minutes >= DAY_SPAN ? 'voll' : `${Math.round(minutes / 60)} h verplant`}
          {free.length ? ` · frei ${free.map(([a, b]) => `${Math.round(a / 60)}–${Math.round(b / 60)}h`).join(', ')}` : ' · nichts mehr frei'}
          {onMove ? ' · Block ziehen = Zeit, rechter Rand = Dauer' : ''}
        </p>
      ) : null}
    </div>
  );
}

export default DayBar;
