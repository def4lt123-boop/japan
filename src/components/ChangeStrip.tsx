'use client';

/**
 * Der schmale Streifen für Tageskarten: er zeigt den Ortswechsel, den die Reise schon
 * enthält – gelesen aus den Betten, deshalb ohne Knopf und ohne Formular.
 */
import React from 'react';
import { fmtDate, plural } from '../lib/format';

export function ChangeStrip({
  date,
  from,
  to,
  fromHotel,
  toHotel,
  nightsInOld,
  journey,
}: {
  date: string;
  from: string;
  to: string;
  fromHotel?: string | null;
  toHotel?: string | null;
  nightsInOld?: number;
  journey?: string | null;
}) {
  return (
    <div
      data-change={date}
      className="flex w-full flex-wrap items-center gap-x-2 gap-y-0.5 border-y border-shu-400/25 bg-shu-500/[0.09] px-3 py-1.5 text-[13px] text-shu-100"
      title={`Erkannt aus den Unterkünften: wer in der Nacht vom ${fmtDate(date, { day: '2-digit', month: '2-digit' })} wo schläft.`}
    >
      <span aria-hidden>🔀</span>
      <span className="min-w-0 flex-1 basis-[9rem] break-words">
        <span className="font-medium">
          {from} → {to}
        </span>
        {fromHotel || toHotel ? (
          <span className="text-slate-400">
            {' '}
            · 🏨 {fromHotel ?? '—'} → {toHotel ?? '—'}
          </span>
        ) : null}
        {nightsInOld ? <span className="text-slate-400"> · {plural(nightsInOld, 'Nacht', 'Nächte')} in {from}</span> : null}
        {journey ? <span className="text-slate-400"> · 🚄 {journey}</span> : null}
      </span>
      <span className="ml-auto text-[13px] uppercase tracking-wide text-slate-400">aus den Betten</span>
    </div>
  );
}
