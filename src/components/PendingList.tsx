'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Place } from '../lib/types';
import { useStore } from '../lib/store';
import { assign, dayPlaces } from '../lib/dayplan';
import { categoryMeta } from '../lib/categories';
import { CategoryDot } from './CategoryDot';
import { fmtDate, plural } from '../lib/format';
import { Card, Select, TextInput, cx } from './ui';

type DayLite = { date: string; cities: string[]; places: Place[] };

const key = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();

/**
 * Die Liste oben auf dem Tagesplan: was noch an keinem Tag liegt.
 * Ein Dropdown (der Tag) und ein Klick (✓ hinlegen) – der Punkt landet am Ende
 * der Liste des Tages, den die meisten Plätze frei hat.
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
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [draft, setDraft] = useState<Record<string, string | null>>({});

  /** Tag mit der meisten Luft – gleiche Stadt zuerst */
  const suggestDay = (p: Place): string | null => {
    const same = days.filter((d) => d.cities.some((c) => key(c) === key(p.city)));
    const list = (same.length ? same : days).slice().sort((a, b) => a.places.length - b.places.length || a.date.localeCompare(b.date));
    return list[0]?.date ?? null;
  };

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle ? pool.filter((p) => `${p.name} ${p.city ?? ''} ${p.category ?? ''} ${p.notes ?? ''}`.toLowerCase().includes(needle)) : pool.slice();
    return list.sort((a, b) => (a.priority === b.priority ? a.name.localeCompare(b.name, 'de') : a.priority === 'muss' ? -1 : b.priority === 'muss' ? 1 : 0));
  }, [pool, q]);

  const place = (p: Place) => {
    const date = draft[p.id] ?? suggestDay(p);
    if (!date) {
      store.say('Diese Reise hat noch keine Tage – oben rechts unter ⋯ „Reise bearbeiten“ den Zeitraum eintragen.');
      return;
    }
    if (!assign(store, all, p, { date })) return;
    setDraft((cur) => {
      const next = { ...cur };
      delete next[p.id];
      return next;
    });
  };

  /** ⚡ – verteilt alles ohne Tag gleichmäßig, volle Tage zuletzt */
  const spread = () => {
    if (!days.length) {
      store.say('Erst der Reise einen Zeitraum geben, dann lässt sich verteilen.');
      return;
    }
    const last = new Map(days.map((d) => [d.date, d.places.length]));
    let done = 0;
    for (const p of shown.filter((x) => !x.date)) {
      const same = days.filter((d) => d.cities.some((c) => key(c) === key(p.city)));
      const order = (same.length ? same : days)
        .slice()
        .sort((a, b) => (last.get(a.date) ?? 0) - (last.get(b.date) ?? 0) || a.date.localeCompare(b.date));
      const target = order.find((d) => (last.get(d.date) ?? 0) < 4) ?? order[0];
      if (!target) break;
      if (!assign(store, all, p, { date: target.date })) continue;
      last.set(target.date, (last.get(target.date) ?? 0) + 1);
      done += 1;
    }
    setDraft({});
    store.say(done ? `${plural(done, 'Punkt', 'Punkte')} auf die Tage mit dem meisten Platz gelegt.` : 'Nichts zu verteilen.');
  };

  if (!pool.length) return null;

  return (
    <Card id="pool" className="overflow-visible p-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-amber-400/[0.14] bg-amber-400/[0.06] px-3 py-2">
        <h3 className="text-[13px] font-semibold text-amber-50">
          Noch ohne Tag <span className="tabular-nums text-amber-100/70">{pool.length}</span>
        </h3>
        <p className="text-[11.5px] text-amber-100/70">Tag wählen, ✓ hinlegen – oder nach unten auf einen Tag ziehen</p>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {days.length > 1 ? (
            <button type="button" className="chip bg-amber-400/15 text-amber-50 ring-1 ring-inset ring-amber-300/25 transition hover:bg-amber-400/25" onClick={spread} title="Alle auf die Tage mit dem meisten Platz legen">
              ⚡ {pool.length} verteilen
            </button>
          ) : null}
          <Link href={`/t/${tripId}/aktivitaeten`} className="text-[11.5px] text-amber-100/80 underline-offset-2 hover:text-white hover:underline">
            alle Aktivitäten →
          </Link>
        </div>
      </div>

      <div className="p-2.5">
        {pool.length > 5 ? <TextInput className="mb-2 !py-1 !text-[12.5px]" value={q} onChange={(e) => setQ(e.target.value)} placeholder="in der Liste suchen …" /> : null}
        <ul className="space-y-1.5">
          {(showAll ? shown : shown.slice(0, 6)).map((p) => {
            const meta = categoryMeta(p.category);
            const date = draft[p.id] ?? suggestDay(p);
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
                  className="flex min-w-0 flex-1 cursor-grab items-center gap-2 active:cursor-grabbing"
                  title="Oder direkt auf einen Tag ziehen"
                >
                  <CategoryDot category={p.category} size={19} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-slate-100">{p.name}</span>
                    <span className="block truncate text-[11px] text-slate-500">
                      <span aria-hidden>{meta.icon}</span> {p.city || '—'}
                      {p.priority === 'muss' ? ' · ★ Muss' : p.priority === 'kann' ? ' · Kann' : ''}
                      {p.ticket_status === 'noetig' ? ' · 🎟 offen' : ''}
                    </span>
                  </span>
                </span>

                <span className="flex w-full shrink-0 flex-wrap items-center gap-1 sm:w-auto sm:justify-end">
                  <Select
                    className="!w-auto min-w-[8.5rem] flex-1 !py-1.5 !text-[12px] sm:flex-none sm:!py-1"
                    allowEmpty
                    emptyLabel="Tag wählen"
                    options={days.map((x) => ({ value: x.date, label: `${fmtDate(x.date, { weekday: 'short', day: '2-digit', month: '2-digit' })} · ${plural(x.places.length, 'Punkt', 'Punkte')}` }))}
                    value={date ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, [p.id]: e.target.value || null }))}
                  />
                  {!draft[p.id] && date ? <span className="text-[10.5px] text-slate-500" title="Vorgeschlagen: der Tag mit der meisten Luft">Vorschlag</span> : null}
                  {date && ansEnde ? <span className="text-[11px] text-slate-500">→ Stelle {ansEnde}</span> : null}
                  <button
                    type="button"
                    className={cx('btn !py-1 !text-[12px]', date ? 'bg-matcha-500/25 text-white ring-1 ring-inset ring-shu-400/40 hover:bg-shu-500/35' : 'bg-white/[0.04] text-slate-600 ring-white/10')}
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
          <button type="button" className="mt-2 text-[11.5px] text-slate-400 underline-offset-2 hover:text-white hover:underline" onClick={() => setShowAll((v) => !v)}>
            {showAll ? 'weniger zeigen' : `alle ${shown.length} zeigen`}
          </button>
        ) : null}
        {!shown.length ? <p className="px-1 py-2 text-center text-[12px] text-slate-500">Keine Treffer für „{q}“.</p> : null}
      </div>
    </Card>
  );
}
