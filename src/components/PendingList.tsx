'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import type { Place } from '../lib/types';
import { useStore } from '../lib/store';
import { DEFAULT_DURATION, fmtWindow, minToTime, suggestStart, timeToMin } from '../lib/dayplan';
import { categoryMeta } from '../lib/categories';
import { fmtDate } from '../lib/format';
import { Card, Select, TextInput, cx } from './ui';

type DayLite = { date: string; hours: number; cities: string[]; places: Place[] };

/** Halbe-Stunden zum Auswählen – von 07:00 bis 22:30 */
const TIMES: string[] = (() => {
  const out: string[] = [];
  for (let m = 7 * 60; m <= 22 * 60 + 30; m += 30) out.push(minToTime(m));
  return out;
})();

const key = (v: string | null | undefined) => (v ?? '').trim().toLowerCase();

/**
 * Die Liste oben auf dem Tagesplan: was noch an keinem Tag liegt.
 * Tag und Uhrzeit direkt hier wählbar – ein Klick auf „hinlegen“ genügt,
 * weil der Tag mit der meisten Luft (und der passenden Stadt) vorgeschlagen ist.
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
  const [draft, setDraft] = useState<Record<string, { date: string | null; time: string | null }>>({});

  const suggestDay = (p: Place): string | null => {
    const same = days.filter((d) => d.cities.some((c) => key(c) === key(p.city)));
    const list = (same.length ? same : days).slice().sort((a, b) => a.places.length - b.places.length);
    return list[0]?.date ?? null;
  };

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle ? pool.filter((p) => `${p.name} ${p.city ?? ''} ${p.category ?? ''} ${p.notes ?? ''}`.toLowerCase().includes(needle)) : pool.slice();
    return list.sort((a, b) =>
      a.priority === b.priority ? a.name.localeCompare(b.name, 'de') : a.priority === 'muss' ? -1 : b.priority === 'muss' ? 1 : 0,
    );
  }, [pool, q]);

  const patch = (id: string, next: Partial<{ date: string | null; time: string | null }>) =>
    setDraft((d) => ({ ...d, [id]: { date: d[id]?.date ?? null, time: d[id]?.time ?? null, ...next } }));

  const place = (p: Place) => {
    const d = draft[p.id];
    const date = d?.date ?? suggestDay(p);
    if (!date) {
      store.say('Diese Reise hat noch keine Tage – oben rechts unter ⋯ „Reise bearbeiten“ den Zeitraum eintragen.');
      return;
    }
    assign(p, date, d?.time ?? null);
    setDraft((cur) => {
      const next = { ...cur };
      delete next[p.id];
      return next;
    });
  };

  const assign = (p: Place, date: string, time: string | null) => {
    const siblings = all.filter((x) => x.id !== p.id && x.date === date);
    const len = p.duration_min ?? DEFAULT_DURATION;
    const wanted = timeToMin(time ?? p.start_time);
    const at = suggestStart(siblings, len, wanted).start;
    const fullDay = p.time_slot === 'Ganzer Tag';
    store.patch('places', p.id, { date, start_time: fullDay ? (p.start_time ?? null) : minToTime(at) });
    store.say(fullDay ? `„${p.name}“ → ${fmtDate(date, { weekday: 'short', day: 'numeric', month: 'short' })}, ganzer Tag.` : `„${p.name}“ → ${fmtDate(date, { weekday: 'short', day: 'numeric', month: 'short' })} · ${fmtWindow(at, at + len)}.`);
  };

  const preview = (p: Place) => {
    const d = draft[p.id];
    const date = d?.date ?? suggestDay(p);
    if (!date) return null;
    const day = days.find((x) => x.date === date);
    const siblings = (day?.places ?? []).filter((x) => x.id !== p.id);
    const len = p.duration_min ?? DEFAULT_DURATION;
    const wanted = timeToMin(d?.time ?? p.start_time);
    const { start, moved } = suggestStart(siblings, len, wanted);
    return { date, text: fmtWindow(start, start + len), moved, wanted: wanted === null ? null : fmtWindow(wanted, wanted + len) };
  };

  /** ⚡ – verteilt alles Offene auf die Tage mit der meisten Luft */
  const spread = () => {
    const work = all.map((x) => ({ ...x }));
    const load = new Map(days.map((d) => [d.date, d.hours]));
    let done = 0;
    for (const p of shown.filter((x) => !x.date)) {
      const same = days.filter((d) => d.cities.some((c) => key(c) === key(p.city)));
      const order = (same.length ? same : days).slice().sort((a, b) => (load.get(a.date) ?? 0) - (load.get(b.date) ?? 0) || a.date.localeCompare(b.date));
      const target = order.find((d) => (load.get(d.date) ?? 0) < 8) ?? order[0];
      if (!target) break;
      const len = p.duration_min ?? DEFAULT_DURATION;
      const siblings = work.filter((x) => x.id !== p.id && x.date === target.date);
      const at = suggestStart(siblings, len, timeToMin(p.start_time)).start;
      const idx = work.findIndex((x) => x.id === p.id);
      work[idx] = { ...work[idx], date: target.date, start_time: minToTime(at), duration_min: len };
      load.set(target.date, (load.get(target.date) ?? 0) + len / 60);
      store.patch('places', p.id, { date: target.date, start_time: minToTime(at) });
      done += 1;
    }
    setDraft({});
    store.say(done ? `${done} Aktivit${done === 1 ? 'ät' : 'äten'} auf die Tage mit der meisten Luft gelegt.` : 'Nichts zu verteilen.');
  };

  if (!pool.length) return null;

  return (
    <Card id="pool" className="overflow-visible p-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-amber-400/[0.14] bg-amber-400/[0.06] px-3 py-2">
        <h3 className="text-[13px] font-semibold text-amber-50">
          Noch ohne Tag <span className="tabular-nums text-amber-100/70">{pool.length}</span>
        </h3>
        <p className="text-[11.5px] text-amber-100/70">Tag und Uhrzeit wählen oder nach unten auf einen Tag ziehen</p>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {days.length > 1 ? (
            <button type="button" className="chip bg-amber-400/15 text-amber-50 ring-1 ring-inset ring-amber-300/25 transition hover:bg-amber-400/25" onClick={spread} title="Alle auf die Tage mit der meisten freien Zeit legen">
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
            const d = draft[p.id];
            const date = d?.date ?? suggestDay(p);
            const pre = preview(p);
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
                  <span aria-hidden className="shrink-0 text-[15px]">
                    {meta.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-slate-100">{p.name}</span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {p.city || '—'}
                      {p.priority === 'muss' ? ' · ★ Muss' : p.priority === 'kann' ? ' · Kann' : ''}
                      {p.ticket_status === 'noetig' ? ' · 🎟 offen' : ''}
                      {p.duration_min ? ` · ${Math.round(p.duration_min / 30) / 2} h` : ''}
                    </span>
                  </span>
                </span>

                <span className="flex w-full shrink-0 flex-wrap items-center gap-1 sm:w-auto sm:justify-end">
                  <Select
                    className="!w-auto min-w-[7.5rem] flex-1 !py-1.5 !text-[12px] sm:flex-none sm:!py-1"
                    allowEmpty
                    emptyLabel="Tag wählen"
                    options={days.map((x) => ({ value: x.date, label: fmtDate(x.date, { weekday: 'short', day: '2-digit', month: '2-digit' }) }))}
                    value={date ?? ''}
                    onChange={(e) => patch(p.id, { date: e.target.value || null })}
                  />
                  <Select
                    className="!w-auto min-w-[6.5rem] flex-1 !py-1.5 !text-[12px] sm:flex-none sm:!py-1"
                    allowEmpty
                    emptyLabel="Uhrzeit frei"
                    options={TIMES}
                    value={d?.time ?? ''}
                    onChange={(e) => patch(p.id, { time: e.target.value || null })}
                  />
                  {!d?.date && date ? <span className="text-[10.5px] text-slate-500">Vorschlag</span> : null}
                  {pre ? (
                    <span className={cx('text-[11px] tabular-nums', pre.moved ? 'text-amber-200' : 'text-emerald-200/85')} title={pre.moved && pre.wanted ? `${pre.wanted} ist belegt` : 'Zeitfenster an diesem Tag'}>
                      {pre.text}
                      {pre.moved && pre.wanted ? ' ↷' : ''}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className={cx('chip px-2.5 py-1 text-[12.5px] ring-1 transition sm:px-2 sm:py-0.5 sm:text-[12px]', date ? 'bg-shu-500/25 text-white ring-shu-400/40 hover:bg-shu-500/35' : 'bg-white/[0.04] text-slate-600 ring-white/10')}
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
