'use client';

/**
 * Die Ideen für einen Tag: von unten als Blech, darin alles, was noch ohne Tag ist.
 * Ein Tipp legt den Punkt ans Ende dieses Tages, darunter entsteht eine neue Aktivität.
 * Auf dem Desktop steht dieselbe Liste als Paneel in der Mitte.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Place } from '../lib/types';
import { categoryMeta } from '../lib/categories';
import { fmtMoney, knownCity, plural } from '../lib/format';
import { Button, PriorityTag, Select, TextInput, cx } from './ui';

export function DayPickerSheet({
  date,
  label,
  city,
  pool,
  onPick,
  onNew,
  onClose,
}: {
  date: string;
  label: string;
  city?: string | null;
  pool: Place[];
  onPick: (p: Place) => void;
  onNew: () => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [ort, setOrt] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const alt = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = alt;
    };
  }, [onClose]);

  const städte = useMemo(
    () => Array.from(new Set(pool.map((p) => knownCity(p.city)).filter((c): c is string => Boolean(c)))).sort((a, b) => a.localeCompare(b, 'de')),
    [pool],
  );

  // was zum Tag passt, steht oben: erst die Stadt des Tages, dann die Muss-Ideen
  const shown = useMemo(() => {
    const suche = q.trim().toLowerCase();
    const liste = pool.filter((p) => {
      if (ort && knownCity(p.city) !== ort) return false;
      if (!suche) return true;
      return [p.name, p.city, p.notes, p.category].filter(Boolean).join(' ').toLowerCase().includes(suche);
    });
    const rang = (p: Place) => (p.priority === 'muss' ? 0 : p.priority === 'soll' ? 1 : 2);
    return [...liste].sort(
      (a, b) =>
        (knownCity(a.city) === city ? 0 : 1) - (knownCity(b.city) === city ? 0 : 1) ||
        rang(a) - rang(b) ||
        a.name.localeCompare(b.name, 'de'),
    );
  }, [pool, q, ort, city]);

  return createPortal(
    <div
      className="no-print fixed inset-0 z-[1000] flex items-end justify-center bg-black/70 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={`Ideen für ${label}`}
    >
      <div className="day-sheet card max-h-[82vh] w-full overflow-y-auto rounded-t-2xl md:mx-auto md:mt-[7vh] md:max-h-[76vh] md:w-[min(34rem,100%)] md:rounded-2xl" data-ideen-sheet={date}>
        <div className="sticky top-0 z-10 border-b border-white/[0.07] bg-ink-800/95 px-3 pt-1.5 pb-2 backdrop-blur">
          <span className="mx-auto mb-1.5 block h-1 w-9 rounded-full bg-white/20 md:hidden" aria-hidden />
          <div className="flex items-center gap-2">
            <h3 className="min-w-0 flex-1 text-[14px] font-semibold text-white">
              <span aria-hidden>✨</span> {label}
            </h3>
            <span className="chip shrink-0 tabular-nums">{plural(pool.length, 'Idee', 'Ideen')} ohne Tag</span>
            <button className="icon-btn shrink-0" onClick={onClose} aria-label="schließen">
              ✕
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <div className="relative min-w-[9rem] flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-slate-400">🔎</span>
              <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Idee suchen …" className="!py-1.5 pl-9" />
            </div>
            {städte.length > 1 ? (
              <Select
                className={cx('!w-auto min-w-0 max-w-[46vw]', ort && 'border-shu-400/60')}
                allowEmpty
                emptyLabel="Alle Städte"
                options={städte}
                value={ort}
                onChange={(e) => setOrt(e.target.value)}
              />
            ) : null}
          </div>
        </div>

        {shown.length ? (
          <ul className="space-y-1.5 p-2">
            {shown.map((p) => {
              const meta = categoryMeta(p.category);
              return (
                <li key={p.id}>
                  <button
                    data-idee={p.id}
                    onClick={() => onPick(p)}
                    className="flex w-full items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-2.5 py-2 text-left transition hover:border-shu-400/40 hover:bg-white/[0.06]"
                    title={`${p.name} ans Ende von ${label} legen`}
                  >
                    <span aria-hidden className="shrink-0">
                      {meta.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-slate-100">{p.name}</span>
                      <span className="block truncate text-[13px] text-slate-400">
                        {knownCity(p.city) ?? 'ohne Stadt'} · <PriorityTag priority={p.priority} />
                        {p.price_eur ? ` · ${fmtMoney(p.price_eur)}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-lg bg-shu-500/15 px-2 py-1 text-[13px] text-shu-100 ring-1 ring-inset ring-shu-400/30">hinlegen</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-3 py-4 text-[13px] leading-snug text-slate-400">
            {pool.length ? 'Keine Idee passt zu Suche oder Stadt – oben zurücksetzen oder unten eine neue anlegen.' : '🎉 Jede Idee hat schon einen Tag. Was noch fehlt, entsteht hier.'}
          </p>
        )}

        <div className="sheet-foot sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-white/[0.07] bg-ink-800/95 px-3 py-2 backdrop-blur">
          <Button variant="primary" onClick={onNew}>
            ＋ Neue Aktivität anlegen
          </Button>
          <span className="ml-auto hidden text-[13px] text-slate-400 sm:block">ein Tipp legt den Punkt nach unten</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
