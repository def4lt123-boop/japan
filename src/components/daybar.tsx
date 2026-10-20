'use client';

/**
 * Tagesband: 07–23 Uhr als Leiste. Farbige Abschnitte = verplant (Kategorie-Farbe),
 * Lücken = Zeit, die noch frei ist. Ein Punkt ohne Uhrzeit sitzt dort, wo die
 * Tageszeit ihn vermutet – gestrichelt, damit der Unterschied zu sehen bleibt.
 */
import React from 'react';
import type { Place } from '../lib/types';
import { DAY_END, DAY_START, DAY_SPAN, freeWindows, fmtWindow, plannedMinutes, windowsOf } from '../lib/dayplan';
import { categoryMeta } from '../lib/categories';
import { cx } from './ui';

const pct = (min: number) => ((min - DAY_START) / DAY_SPAN) * 100;

export function DayBar({
  places,
  height = 12,
  ticks = false,
  className,
  onPickSlot,
}: {
  places: Place[];
  height?: number;
  ticks?: boolean;
  className?: string;
  /** Klick in eine Lücke: Zeit vorschlagen (Minuten ab Mitternacht) */
  onPickSlot?: (minute: number) => void;
}) {
  const wins = windowsOf(places);
  const free = freeWindows(places);
  const minutes = plannedMinutes(places);

  return (
    <div className={cx('select-none', className)}>
      <div className="relative w-full overflow-hidden rounded-full bg-white/[0.06]" style={{ height }}>
        {free.map(([a, b]) => (
          <div
            key={`f${a}`}
            className={cx('absolute top-0 h-full rounded-full bg-emerald-400/[0.10]', onPickSlot && 'cursor-pointer hover:bg-emerald-400/25')}
            style={{ left: `${pct(a)}%`, width: `${pct(b) - pct(a)}%` }}
            title={`frei ${fmtWindow(a, b)}${onPickSlot ? ' – klicken' : ''}`}
            onClick={
              onPickSlot
                ? (e) => {
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                    onPickSlot(Math.round((a + (b - a) * ratio) / 15) * 15);
                  }
                : undefined
            }
          />
        ))}
        {wins.map(({ place, win }) => (
          <div
            key={place.id}
            className={cx('absolute top-0 h-full', win.explicit ? '' : 'opacity-55 ring-1 ring-inset ring-white/25')}
            style={{
              left: `${pct(win.start)}%`,
              width: `${Math.max(1.2, pct(win.end) - pct(win.start))}%`,
              background: categoryMeta(place.category).color,
              borderRadius: 999,
            }}
            title={`${place.name} · ${fmtWindow(win.start, win.end)}${win.explicit ? '' : ' (geschätzt, keine Uhrzeit)'}`}
          />
        ))}
      </div>
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
        </p>
      ) : null}
    </div>
  );
}

export default DayBar;
