'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Place } from '../lib/types';
import { useStore } from '../lib/store';
import { assign, dayPlaces } from '../lib/dayplan';
import { categoryMeta } from '../lib/categories';
import { CategoryDot } from './CategoryDot';
import { fmtDate, fmtDay, knownCity, plural } from '../lib/format';
import { Card, PriorityTag, Select, TextInput, cx } from './ui';
import { Grip, useDrag } from './TouchDrag';

type DayLite = { date: string; places: Place[] };

/**
 * Die Liste oben auf dem Tagesplan: was noch an keinem Tag liegt.
 * Du wählst den Tag selbst – ein Dropdown, ✓ hinlegen, oder nach unten ziehen.
 * Der Punkt kommt ans Ende der Liste dieses Tages.
 */
export function PendingList({
  tripId,
  pool,
  all,
  days,
}: {
  tripId: string;
  pool: Place[];
  all: Place[];
  days: DayLite[];
}) {
  const store = useStore();
  const drag = useDrag();
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [draft, setDraft] = useState<Record<string, string | null>>({});

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle ? pool.filter((p) => `${p.name} ${p.city ?? ''} ${p.category ?? ''} ${p.notes ?? ''}`.toLowerCase().includes(needle)) : pool.slice();
    return list.sort((a, b) => (a.priority === b.priority ? a.name.localeCompare(b.name, 'de') : a.priority === 'muss' ? -1 : b.priority === 'muss' ? 1 : 0));
  }, [pool, q]);

  const place = (p: Place) => {
    const date = draft[p.id];
    if (!date) {
      store.say('Erst den Tag wählen, dann ✓ hinlegen – oder den Punkt direkt auf einen Tag ziehen.');
      return;
    }
    if (!assign(store, all, p, { date })) return;
    setDraft((cur) => {
      const next = { ...cur };
      delete next[p.id];
      return next;
    });
  };

  if (!pool.length) return null;

  return (
    <Card id="pool" data-dropzone="pool" className="overflow-visible p-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-amber-400/[0.14] bg-amber-400/[0.06] px-3 py-2">
        <h3 className="text-[13px] font-semibold text-amber-50">
          Noch ohne Tag <span className="tabular-nums text-amber-100/70">{pool.length}</span>
        </h3>
        <p className="text-[13px] text-amber-100/70">Tag wählen und ✓ hinlegen – oder am Griff ⠿ ziehen, auf dem Handy: halten und loslassen</p>
        <Link href={`/t/${tripId}/aktivitaeten`} className="ml-auto text-[13px] text-amber-100/80 underline-offset-2 hover:text-white hover:underline">
          alle Aktivitäten →
        </Link>
      </div>

      <div className="px-3 py-2.5">
        {pool.length > 5 ? (
          <TextInput className="mb-2 !py-1 !text-[13px]" value={q} onChange={(e) => setQ(e.target.value)} placeholder="in der Liste suchen …" />
        ) : null}
        <ul className="space-y-1.5">
          {(showAll ? shown : shown.slice(0, 6)).map((p) => {
            const meta = categoryMeta(p.category);
            const date = draft[p.id] ?? null;
            const ansEnde = date ? dayPlaces(all, date).length + 1 : 0;
            return (
              <li
                key={p.id}
                className={cx(
                  'flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl border bg-white/[0.02] px-2 py-1.5 transition',
                  date ? 'border-white/[0.08] hover:border-white/20' : 'border-dashed border-white/[0.12]',
                )}
              >
                <span
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', p.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  {...(drag ? drag.hold(p.id, p.name) : {})}
                  className="flex min-w-0 flex-1 cursor-grab touch-pan-y items-center gap-2 active:cursor-grabbing"
                  title="Ziehen – auf dem Handy kurz halten, dann folgt der Punkt dem Finger"
                >
                  {drag ? <Grip grab={drag.grab} id={p.id} label={p.name} className="-ml-1" /> : null}
                  <CategoryDot category={p.category} size={19} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-slate-100">{p.name}</span>
                    <span className="block truncate text-[13px] text-slate-400">
                      <span aria-hidden>{meta.icon}</span> {knownCity(p.city) ?? '—'}
                      <PriorityTag priority={p.priority} className="mx-1" />
                      {p.ticket_status === 'noetig' ? ' · 🎟 offen' : ''}
                    </span>
                  </span>
                </span>

                <span className="flex w-full shrink-0 flex-wrap items-center gap-1 sm:w-auto sm:justify-end">
                  <Select
                    className="!w-auto min-w-[8.5rem] flex-1 !py-1.5 !text-[13px] sm:flex-none sm:!py-1"
                    allowEmpty
                    emptyLabel="Tag wählen"
                    options={days.map((x) => ({ value: x.date, label: `${fmtDay(x.date)} · ${plural(x.places.length, 'Punkt', 'Punkte')}` }))}
                    value={date ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, [p.id]: e.target.value || null }))}
                  />
                  {ansEnde ? <span className="text-[13px] text-slate-400">→ Stelle {ansEnde}</span> : null}
                  <button
                    type="button"
                    className={cx('btn !py-1 !text-[13px]', date ? 'bg-matcha-500/25 text-white ring-1 ring-inset ring-shu-400/40 hover:bg-shu-500/35' : 'bg-white/[0.04] text-slate-400 ring-white/10')}
                    title={date ? `Auf ${fmtDate(date, { weekday: 'short', day: 'numeric', month: 'short' })} legen` : 'Erst einen Tag wählen'}
                    onClick={() => place(p)}
                  >
                    ✓ hinlegen
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
        {shown.length > 6 ? (
          <button type="button" className="mt-2 text-[13px] text-slate-400 underline-offset-2 hover:text-white hover:underline" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'weniger zeigen' : `alle ${shown.length} zeigen`}
          </button>
        ) : null}
        {!shown.length ? <p className="px-1 py-2 text-center text-[13px] text-slate-400">Keine Treffer für „{q}“.</p> : null}
      </div>
    </Card>
  );
}
